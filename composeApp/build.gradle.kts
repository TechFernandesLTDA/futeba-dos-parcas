plugins {
    kotlin("multiplatform")
    id("com.android.library")  // Changed from application - this is a KMP shared module, not standalone app
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

    sourceSets {
        commonMain.dependencies {
            // Compose Multiplatform
            implementation(compose.runtime)
            implementation(compose.foundation)
            implementation(compose.material3)
            implementation(compose.ui)
            implementation(compose.components.resources)
            implementation(compose.components.uiToolingPreview)

            // Shared module - business logic
            implementation(project(":shared"))

            // Navigation
            implementation("org.jetbrains.androidx.navigation:navigation-compose:2.8.0-alpha10")

            // ViewModel
            implementation("org.jetbrains.androidx.lifecycle:lifecycle-viewmodel-compose:2.8.3")
        }

        androidMain.dependencies {
            // Android-specific dependencies
            implementation("androidx.activity:activity-compose:1.12.3")
            implementation("androidx.compose.ui:ui-tooling-preview:1.10.2")
        }

        iosMain.dependencies {
            // iOS-specific dependencies if needed
        }
    }
}

android {
    namespace = "com.futebadosparcas.compose"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        // No applicationId - this is a library module, not a standalone app
        // versionCode/versionName removed - inherited from main app module
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
