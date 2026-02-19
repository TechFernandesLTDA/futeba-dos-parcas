import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.targets.js.webpack.KotlinWebpackConfig

plugins {
    kotlin("multiplatform")
    id("com.android.library")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.compose")
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
                devServer = (devServer ?: KotlinWebpackConfig.DevServer()).apply {
                    static = (static ?: mutableListOf()).apply {
                        add(rootDirPath)
                        add(projectDirPath)
                    }
                }
            }
        }
        binaries.executable()
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
        }

        androidMain.dependencies {
            // Android-specific dependencies
            implementation("androidx.activity:activity-compose:1.12.3")
            implementation("androidx.compose.ui:ui-tooling-preview:1.10.2")
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
