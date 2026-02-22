import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig

plugins {
    kotlin("multiplatform")
    id("com.android.library")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
}

// Forçar Kotlin stdlib 2.2.10 para evitar mismatch com compiler (Compose 1.10.0 puxa 2.2.21)
configurations.all {
    resolutionStrategy {
        force("org.jetbrains.kotlin:kotlin-stdlib:2.2.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-common:2.2.10")
        force("org.jetbrains.kotlin:kotlin-stdlib-wasm-js:2.2.10")
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

    // Web target (wasmJs) - Fase 0: infraestrutura CMP 1.10.0
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        // moduleName removido (deprecated em Kotlin 2.2.x - usar outputModuleName no futuro)
        browser {
            val rootDirPath = project.rootDir.path
            val projectDirPath = project.projectDir.path
            commonWebpackConfig {
                outputFileName = "composeApp.js"
                
                // Issue #181: Otimizações de webpack para produção
                cssSupport {
                    enabled.set(true)
                }
                
                devServer = (devServer ?: KotlinWebpackConfig.DevServer()).apply {
                    static = (static ?: mutableListOf()).apply {
                        add(rootDirPath)
                        add(projectDirPath)
                    }
                    // Dev server optimizations
                    port = 8080
                }
            }
            testTask {
                useKarma {
                    useChromeHeadless()
                }
            }
        }
        binaries.executable()
        
        // Issue #181: Configurações de tree shaking e otimizações
        compilerOptions {
            freeCompilerArgs.addAll(
                "-Xwasm-enable-api-mt",
                "-opt-in=kotlin.ExperimentalStdlibApi"
            )
        }
    }

    sourceSets {
        commonMain.dependencies {
            // Compose Multiplatform 1.10.0
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation(compose.components.uiToolingPreview)

            // Shared module - business logic
            implementation(project(":shared"))

            // Navigation - atualizado para CMP 1.10.0
            implementation("org.jetbrains.androidx.navigation:navigation-compose:2.9.1")

            // ViewModel + Lifecycle - atualizado para 2.9.6
            implementation("org.jetbrains.androidx.lifecycle:lifecycle-viewmodel-compose:2.9.6")
            implementation("org.jetbrains.androidx.lifecycle:lifecycle-runtime-compose:2.9.6")

            // Coil 3 - Image Loading (Kotlin Multiplatform)
            implementation("io.coil-kt.coil3:coil:3.0.4")
            implementation("io.coil-kt.coil3:coil-compose:3.0.4")
        }

        androidMain.dependencies {
            // Android-specific dependencies
            implementation("androidx.activity:activity-compose:1.12.3")
            implementation("androidx.compose.ui:ui-tooling-preview:1.10.2")

            // Coil 3 - Network support for Android
            implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")
        }

        iosMain.dependencies {
            // iOS-specific dependencies se necessário
        }

        // Web (wasmJs) - dependências específicas serão adicionadas nas Fases 4-6
        wasmJsMain.dependencies {
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
        }

        wasmJsTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

android {
    namespace = "com.futebadosparcas.compose"
    compileSdk = 36

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
}

compose {
    resources {
        publicResClass = true
        packageOfResClass = "com.futebadosparcas.compose.resources"
    }
}

// Issue #181: Task para análise de bundle size
tasks.register("analyzeBundleSize") {
    group = "verification"
    description = "Analisa o tamanho do bundle wasmJs"
    
    doLast {
        val wasmOutputDir = file("build/dist/wasmJs/productionExecutable")
        if (wasmOutputDir.exists()) {
            wasmOutputDir.walkTopDown()
                .filter { it.isFile }
                .forEach { file ->
                    val sizeKB = file.length() / 1024.0
                    println("${file.name}: ${"%.2f".format(sizeKB)} KB")
                }
            
            val totalSize = wasmOutputDir.walkTopDown()
                .filter { it.isFile }
                .sumOf { it.length() } / (1024.0 * 1024.0)
            println("\nTotal bundle size: ${"%.2f".format(totalSize)} MB")
        } else {
            println("Bundle directory not found. Run 'wasmJsBrowserProductionWebpack' first.")
        }
    }
}
