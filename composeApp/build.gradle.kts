plugins {
    kotlin("multiplatform")
    id("com.android.library")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
}

// Forçar Kotlin stdlib 2.2.10 para evitar mismatch com compiler (Compose 1.10.0 puxa 2.2.21)
configurations.all {
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:2.2.21")
        force("org.jetbrains.kotlin:kotlin-stdlib-common:2.2.21")
    }
}

kotlin {
    // Android target
    androidTarget {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    // iOS targets
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }

    sourceSets {
        // Source set hierarchy explicita — `kotlin.mpp.applyDefaultHierarchyTemplate=false`
        // em gradle.properties, então `iosMain` não conecta automaticamente nos
        // 3 iOS targets. Sem este dependsOn, expects em commonMain (AppNavigation,
        // getPlatformName, blendColors, calculateLuminance, PlatformThemeSetup)
        // ficam sem actual visível em Native, e build falha.
        val commonMain by getting
        val iosMain by creating {
            dependsOn(commonMain)
        }
        val iosX64Main by getting { dependsOn(iosMain) }
        val iosArm64Main by getting { dependsOn(iosMain) }
        val iosSimulatorArm64Main by getting { dependsOn(iosMain) }

        // #4109: source set intermediário Android. Guarda a família Poppins
        // (`rememberPoppinsFontFamily()`) e os `.ttf` em `nonIosMain/composeResources/font/`.
        // Os recursos do Compose são empacotados por source set, então o iOS (que usa a
        // fonte de sistema SF) não recebe os ~788 KB de Poppins nem os acessores
        // `Res.font.poppins_*`.
        val nonIosMain by creating {
            dependsOn(commonMain)
        }
        val androidMain by getting { dependsOn(nonIosMain) }

        commonMain.dependencies {
            // Compose Multiplatform 1.10.0
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            // Material Icons extended — telas portadas do :app usam Icons.Filled.*
            // (necessário para a frota CMP Fase 3; não vem com material3)
            implementation(compose.materialIconsExtended)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation(compose.components.uiToolingPreview)

            // Shared module - business logic
            implementation(project(":shared"))

            // Navigation - atualizado para CMP 1.10.0
            implementation("org.jetbrains.androidx.navigation:navigation-compose:2.9.2")

            // ViewModel + Lifecycle - atualizado para 2.9.6
            implementation("org.jetbrains.androidx.lifecycle:lifecycle-viewmodel-compose:2.9.6")
            implementation("org.jetbrains.androidx.lifecycle:lifecycle-runtime-compose:2.9.6")

            // Koin 4.1.1 — DI multiplatform (mesmo usado no :app Android)
            // koin-core: módulos, get(), startKoin
            // koin-compose: KoinApplication composable
            // koin-compose-viewmodel: koinViewModel() em commonMain
            val koinVersion = "4.1.1"
            implementation("io.insert-koin:koin-core:$koinVersion")
            implementation("io.insert-koin:koin-compose:$koinVersion")
            implementation("io.insert-koin:koin-compose-viewmodel:$koinVersion")

            // Coil 3 - Image Loading (Kotlin Multiplatform)
            implementation("io.coil-kt.coil3:coil:3.3.0")
            implementation("io.coil-kt.coil3:coil-compose:3.3.0")

            // kotlinx-datetime — formatação de datas na feature "Novidades" (Fase G).
            // Mesma versão usada no :shared.
            implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")
        }

        androidMain.dependencies {
            // Android-specific dependencies
            implementation("androidx.activity:activity-compose:1.12.3")
            implementation("androidx.compose.ui:ui-tooling-preview:1.10.2")

            // Coil 3 - Network support for Android
            implementation("io.coil-kt.coil3:coil-network-okhttp:3.3.0")
        }

        iosMain.dependencies {
            // iOS-specific dependencies se necessário
        }
    }
}

android {
    namespace = "com.futebadosparcas.compose"
    compileSdk = 37

    defaultConfig {
        minSdk = 24
        // Módulo biblioteca - sem applicationId ou versionCode
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    lint {
        // #2769: KotlinUastLanguagePlugin.isJvmOrCommonElement NPE em AGP9 + KMP ao
        // analisar common sources. O lint do :app continua cobrindo o código Android
        // principal; aqui apenas evitamos que o crash derrube o CI.
        abortOnError = false
        checkReleaseBuilds = false
    }
}

compose {
    resources {
        publicResClass = true
        packageOfResClass = "com.futebadosparcas.compose.resources"
    }
}

// #2769 (follow-up do #2780): `abortOnError = false` NÃO impede um CRASH do detector de
// lint (NullPointerException em KotlinUastLanguagePlugin.isJvmOrCommonElement — bug do
// AGP 9 ao analisar common sources KMP). Como o CI roda `./gradlew lint` (global), o crash
// de :composeApp:lintAnalyzeDebug ainda derrubava o Android CI. Desabilitamos as tasks de
// lint deste módulo de UI multiplataforma; o lint do :app cobre o código Android real.
afterEvaluate {
    tasks.matching { it.name.startsWith("lint") }.configureEach {
        enabled = false
    }
}
