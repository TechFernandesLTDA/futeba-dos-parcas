import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp")
    id("androidx.navigation.safeargs.kotlin")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    id("com.google.firebase.firebase-perf")
    id("org.jetbrains.kotlin.plugin.compose")
    id("kotlin-parcelize")
    kotlin("plugin.serialization")
    id("androidx.baselineprofile")
}

val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(FileInputStream(localPropertiesFile))
}

// Fail-fast da assinatura de release. Sem STORE_FILE em local.properties (ou com o
// arquivo ausente), o signingConfig "release" fica sem storeFile e o BundleTool
// quebra com NullPointerException em :app:signReleaseBundle, sem dizer o motivo.
// Os workflows (deploy-production/deploy-beta/release) materializam o keystore a
// partir do secret KEYSTORE_BASE64 em $RUNNER_TEMP/release.jks e gravam STORE_FILE
// em local.properties; em build local, crie local.properties com STORE_FILE,
// STORE_PASSWORD, KEY_ALIAS e KEY_PASSWORD.
val releaseStoreFilePath: String? = localProperties.getProperty("STORE_FILE")
gradle.taskGraph.whenReady {
    val signedReleaseTask = allTasks.firstOrNull {
        it.project.path == ":app" &&
            (it.name == "bundleRelease" || it.name == "signReleaseBundle" || it.name == "packageReleaseBundle")
    }
    if (signedReleaseTask != null &&
        (releaseStoreFilePath.isNullOrBlank() || !file(releaseStoreFilePath).exists())
    ) {
        throw GradleException(
            "Keystore de release ausente: STORE_FILE=" + (releaseStoreFilePath ?: "(nao definido)") +
                " em local.properties. Em CI, o passo 'Decode and save keystore' deve gravar " +
                "\$RUNNER_TEMP/release.jks a partir do secret KEYSTORE_BASE64 antes de ./gradlew bundleRelease."
        )
    }
}

android {
    namespace = "com.futebadosparcas"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.futebadosparcas"
        minSdk = 24
        targetSdk = 36
        versionCode = 81
        versionName = "1.40.0"

        val mapsApiKey = localProperties.getProperty("MAPS_API_KEY") ?: ""
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val keystoreFile = localProperties.getProperty("STORE_FILE")
            if (keystoreFile != null) {
                storeFile = file(keystoreFile)
                storePassword = localProperties.getProperty("STORE_PASSWORD")
                keyAlias = localProperties.getProperty("KEY_ALIAS")
                keyPassword = localProperties.getProperty("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true  // #029 - Remove unused resources
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Incluir símbolos de debug nativos para análise de crashes no Play Console
            ndk {
                debugSymbolLevel = "FULL"
            }
        }
        // Build type "benchmark": espelha release para medir performance realista,
        // mas usa assinatura debug para facilitar execução em emulador/CI.
        // Usado pelo módulo :macrobenchmark (#1078).
        create("benchmark") {
            initWith(buildTypes.getByName("release"))
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
            // Desabilita minificação para resultados mais estáveis em CI
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
        compose = true
    }

    packaging {
        jniLibs {
            keepDebugSymbols += setOf("**/libandroidx.graphics.path.so")
        }
    }

    testOptions {
        // Make Android framework methods return default values instead of throwing
        unitTests.isReturnDefaultValues = true

        unitTests.all {
            it.useJUnitPlatform()
            // Contratos de recursos nao podem depender do diretorio temporario do Windows.
            it.systemProperty("futeba.repoRoot", rootProject.projectDir.absolutePath)
            it.maxHeapSize = "2g"
            // Fix encoding issues for paths with special characters (ç, etc.)
            it.jvmArgs(
                "-Xmx2g",
                "-Dfile.encoding=UTF-8",
                "-Dsun.jnu.encoding=UTF-8",
                "-Dconsole.encoding=UTF-8",
                "-Dstdout.encoding=UTF-8",
                "-Dstderr.encoding=UTF-8"
            )
            // Set working directory to temp to avoid path issues with special chars on Windows
            if (System.getProperty("os.name").lowercase().contains("win")) {
                val tempDir = file("C:/TEMP")
                if (tempDir.exists()) {
                    it.workingDir = tempDir
                }
            }
        }
    }

    lint {
        // Detectar strings hardcoded em XML layouts
        enable += "HardcodedText"
        // Detectar uso incorreto de locale em String.format
        enable += "DefaultLocale"
        // Nivel de severidade
        warningsAsErrors = false
        abortOnError = false
        // Relatorio HTML
        htmlReport = true
        htmlOutput = file("build/reports/lint-results.html")
        // Checagens baseline (para CI/CD)
        baseline = file("lint-baseline.xml")
        // Nota: Para strings hardcoded em Compose, usar ktlint ou detekt
    }

}

dependencies {
    // Shared KMP Module
    implementation(project(":shared"))

    // kotlinx.serialization (migração gradual de Gson)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Core Library Desugaring
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")

    // Core Android
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.exifinterface:exifinterface:1.4.2")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.14.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.2")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.2.0")

    // Jetpack Compose (Modern UI)
    val composeBom = platform("androidx.compose:compose-bom:2025.09.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material3:material3-window-size-class")
    // Versão gerida pelo Compose BOM (2025.09.01 → 1.4.0). Sem pin manual para evitar divergência. #2681
    implementation("androidx.compose.material3:material3-adaptive-navigation-suite")
    implementation("androidx.compose.material3.adaptive:adaptive")
    implementation("androidx.compose.material3.adaptive:adaptive-layout")
    implementation("androidx.compose.material3.adaptive:adaptive-navigation")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.graphics:graphics-shapes:1.0.1")
    implementation("androidx.activity:activity-compose:1.12.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.5")
    implementation("androidx.compose.runtime:runtime-livedata") // Interop with LiveData if needed
    implementation("com.google.accompanist:accompanist-themeadapter-material3:0.36.0") // Bridge M3 XML Theme to Compose
    implementation("com.google.accompanist:accompanist-swiperefresh:0.36.0") // Pull-to-refresh para Compose

    // Compose Multiplatform Resources
    implementation(project(":shared"))



    // Architecture Components
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-livedata-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7") // Para collectAsStateWithLifecycle
    implementation("androidx.navigation:navigation-fragment-ktx:2.9.7")
    implementation("androidx.navigation:navigation-ui-ktx:2.9.7")
    implementation("androidx.preference:preference-ktx:1.2.1")
    implementation("androidx.viewpager2:viewpager2:1.1.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

    // Dependency Injection - Koin
    val koinVersion = "4.1.1"
    implementation("io.insert-koin:koin-core:$koinVersion")
    implementation("io.insert-koin:koin-android:$koinVersion")
    implementation("io.insert-koin:koin-compose:$koinVersion")
    implementation("io.insert-koin:koin-compose-viewmodel:$koinVersion")
    implementation("io.insert-koin:koin-compose-viewmodel-navigation:$koinVersion")
    implementation("io.insert-koin:koin-androidx-workmanager:$koinVersion")
    // Firebase - usando BoM para gerenciar versoes
    implementation(platform("com.google.firebase:firebase-bom:33.7.0"))
    implementation("com.google.firebase:firebase-analytics")
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-storage")
    implementation("com.google.firebase:firebase-functions")
    implementation("com.google.firebase:firebase-crashlytics")
    implementation("com.google.firebase:firebase-perf")
    implementation("com.google.firebase:firebase-appcheck-playintegrity")
    implementation("com.google.firebase:firebase-appcheck-debug")
    implementation("com.google.firebase:firebase-config")

    // Credentials para Google Sign-In
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.2.0")

    // Image Loading - Coil 3 Kotlin Multiplatform
    implementation("io.coil-kt.coil3:coil:3.3.0")
    implementation("io.coil-kt.coil3:coil-compose:3.3.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.3.0")

    // Shimmer Effect
    implementation("com.facebook.shimmer:shimmer:0.5.0")

    // Google Maps & Places
    implementation("com.google.android.gms:play-services-maps:19.0.0")
    implementation("com.google.maps.android:maps-compose:4.4.1")
    implementation("com.google.android.gms:play-services-location:21.4.0")
    implementation("com.google.android.libraries.places:places:4.1.0")

    // Video playback - clipes curtos de jogos (#3238)
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-ui:1.5.1")

    // Charts
    implementation("com.github.PhilJay:MPAndroidChart:v3.1.0")
    implementation("com.patrykandpatrick.vico:compose:1.14.0")
    implementation("com.patrykandpatrick.vico:compose-m3:1.14.0")
    implementation("com.patrykandpatrick.vico:core:1.14.0")

    // Date/Time
    implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.5.0") // For shared module interop
    // implementation("com.jakewharton.threetenabp:threetenabp:1.4.7") // Migrated to java.time

    // Security - Encrypted SharedPreferences
    implementation("androidx.security:security-crypto:1.1.0")
    
    // Biometric Authentication
    implementation("androidx.biometric:biometric:1.1.0")

    // Splash Screen
    implementation("androidx.core:core-splashscreen:1.2.0")

    // Testing - JUnit 5 (Jupiter)
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.1")
    testImplementation("org.junit.jupiter:junit-jupiter-params:5.10.1")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.10.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.1")

    // JUnit 4 for Android Instrumentation Tests
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")

    // MockK for Kotlin
    testImplementation("io.mockk:mockk:1.14.11")
    androidTestImplementation("io.mockk:mockk-android:1.14.11")

    // Turbine for Flow testing
    testImplementation("app.cash.turbine:turbine:1.2.1")

    // Coroutines Test
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    androidTestImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")

    // Truth for better assertions
    testImplementation("com.google.truth:truth:1.4.5")
    androidTestImplementation("com.google.truth:truth:1.4.5")

    // Compose UI Testing
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    // Koin Testing
    testImplementation("io.insert-koin:koin-test:$koinVersion")
    testImplementation("io.insert-koin:koin-test-junit4:$koinVersion")
    androidTestImplementation("io.insert-koin:koin-test:$koinVersion")
    androidTestImplementation("io.insert-koin:koin-test-junit4:$koinVersion")

    // Arch Core Testing (for InstantTaskExecutorRule)
    testImplementation("androidx.arch.core:core-testing:2.2.0")


    // Room Database
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    implementation("androidx.datastore:datastore-preferences:1.2.0")
    ksp("androidx.room:room-compiler:$roomVersion")
    androidTestImplementation("androidx.room:room-testing:$roomVersion")

    // Paging 3 - For efficient large list loading
    val pagingVersion = "3.4.0"
    implementation("androidx.paging:paging-runtime-ktx:$pagingVersion")
    implementation("androidx.paging:paging-compose:$pagingVersion")
    testImplementation("androidx.paging:paging-common-ktx:$pagingVersion")

    // WorkManager (for background cache cleanup)
    implementation("androidx.work:work-runtime-ktx:2.11.1")

    // Gson for Object Conversion
    implementation("com.google.code.gson:gson:2.14.0")

    // Lottie Animations
    implementation("com.airbnb.android:lottie:6.7.1")

    // Baseline Profile - ProfileInstaller para aplicar profiles em runtime
    implementation("androidx.profileinstaller:profileinstaller:1.4.1")
    "baselineProfile"(project(":baselineprofile"))

    // CircleImageView
    implementation("de.hdodenhof:circleimageview:3.1.0")

    // Networking
    implementation("com.squareup.retrofit2:retrofit:3.0.0")
    implementation("com.squareup.retrofit2:converter-gson:3.0.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
}

// KSP não precisa de configuração adicional como o Kapt precisava
