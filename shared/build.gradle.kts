plugins {
    kotlin("multiplatform")
    id("com.android.library")
    kotlin("plugin.serialization")
    id("app.cash.sqldelight") version "2.0.1"
}

kotlin {
    // Android target
    androidTarget {
        compilations.all {
            @Suppress("DEPRECATION")
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }

    // iOS targets
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach {
        it.binaries.framework {
            baseName = "shared"
            isStatic = true
        }
    }

    sourceSets {
        val commonMain by getting {
            dependencies {
                // Ktor Client
                implementation("io.ktor:ktor-client-core:2.3.8")
                implementation("io.ktor:ktor-client-content-negotiation:2.3.8")
                implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.8")
                implementation("io.ktor:ktor-client-logging:2.3.8")

                // SQLDelight
                implementation("app.cash.sqldelight:runtime:2.0.1")
                implementation("app.cash.sqldelight:coroutines-extensions:2.0.1")

                // Coroutines (alinhado com app module 1.9.0)
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")

                // Serialization (alinhado com Kotlin 2.2.x)
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

                // DateTime
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }

        val androidMain by getting {
            dependencies {
                // Ktor Android engine
                implementation("io.ktor:ktor-client-okhttp:2.3.8")

                // SQLDelight Android driver
                implementation("app.cash.sqldelight:android-driver:2.0.1")

                // Firebase Android SDK (para androidMain only)
                implementation("com.google.firebase:firebase-firestore-ktx:24.10.0")
                implementation("com.google.firebase:firebase-auth-ktx:22.3.0")
                implementation("com.google.firebase:firebase-storage-ktx:20.2.1")
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

                // AndroidX Security Crypto (para SecureStorage)
                implementation("androidx.security:security-crypto:1.1.0")
            }
        }

        val iosX64Main by getting
        val iosArm64Main by getting
        val iosSimulatorArm64Main by getting

        val iosMain by creating {
            dependsOn(commonMain)
            iosX64Main.dependsOn(this)
            iosArm64Main.dependsOn(this)
            iosSimulatorArm64Main.dependsOn(this)

            dependencies {
                // Ktor iOS engine
                implementation("io.ktor:ktor-client-darwin:2.3.8")

                // SQLDelight native driver
                implementation("app.cash.sqldelight:native-driver:2.0.1")
            }
        }
    }
}

extensions.configure<com.android.build.api.dsl.LibraryExtension>("android") {
    namespace = "com.futebadosparcas.shared"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

sqldelight {
    databases {
        create("FutebaDatabase") {
            packageName.set("com.futebadosparcas.db")
            // Migração automática: SQLDelight 2.x lê arquivos .sqm
            schemaOutputDirectory.set(file("src/commonMain/sqldelight/databases"))
            verifyMigrations.set(true)
            deriveSchemaFromMigrations.set(true)
        }
    }
}
