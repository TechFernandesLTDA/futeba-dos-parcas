plugins {
    kotlin("multiplatform")
    id("com.android.library")
    kotlin("plugin.serialization")
    id("app.cash.sqldelight") version "2.2.1"
}

kotlin {
    // Opt-in global para APIs experimentais usadas por todo o sourceset
    // Resolve a maioria dos erros de cinterop em iosMain (CoreLocation, CoreCrypto, Security framework, etc)
    sourceSets.all {
        languageSettings.optIn("kotlinx.cinterop.ExperimentalForeignApi")
        languageSettings.optIn("kotlinx.cinterop.BetaInteropApi")
    }

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
    ).forEach {
        it.binaries.framework {
            baseName = "shared"
            isStatic = true
        }
    }

    sourceSets {
        // ========================
        // commonMain: apenas libs com suporte universal
        // ========================
        val commonMain by getting {
            dependencies {
                // Coroutines
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")

                // Serialization
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.11.0")

                // DateTime
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.8.0")
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }

        // ========================
        // nativeAndAndroidMain: sourceset intermediário para Android + iOS
        // Ktor 3.x fica aqui (Android + iOS)
        // SQLDelight 2.2.1 já está no commonMain via plugin
        // ========================
        val nativeAndAndroidMain by creating {
            dependsOn(commonMain)
            dependencies {
                // Ktor Client
                implementation("io.ktor:ktor-client-core:3.6.0")
                implementation("io.ktor:ktor-client-content-negotiation:3.6.0")
                implementation("io.ktor:ktor-serialization-kotlinx-json:3.6.0")
                implementation("io.ktor:ktor-client-logging:3.6.0")

                // SQLDelight 2.2.1
                implementation("app.cash.sqldelight:runtime:2.2.1")
                implementation("app.cash.sqldelight:coroutines-extensions:2.2.1")

                // GitLive Firebase Kotlin SDK 2.4.0 - suporta Android + iOS
                // Android + iOS apenas
                val gitLiveVersion = "2.7.0"
                implementation("dev.gitlive:firebase-auth:$gitLiveVersion")
                implementation("dev.gitlive:firebase-firestore:$gitLiveVersion")
                implementation("dev.gitlive:firebase-storage:$gitLiveVersion")
                implementation("dev.gitlive:firebase-functions:$gitLiveVersion")
            }
        }

        // ========================
        // androidMain: Android específico
        // ========================
        val androidMain by getting {
            dependsOn(nativeAndAndroidMain)
            dependencies {
                // Ktor Android engine
                implementation("io.ktor:ktor-client-okhttp:3.6.0")

                // SQLDelight Android driver
                implementation("app.cash.sqldelight:android-driver:2.2.1")

                // Firebase Android SDK - fornecido via GitLive SDK (transitivo)
                // GitLive traz firebase-firestore, firebase-auth, firebase-storage transitivamente
                // kotlinx-coroutines-play-services: necessário para Tasks.await() em código legado
                // TODO: Fase 2 - remover após migração completa para GitLive suspend functions
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.11.0")

                // AndroidX Security Crypto (para SecureStorage)
                implementation("androidx.security:security-crypto:1.1.0")
            }
        }

        // ========================
        // iosMain: iOS específico
        // ========================
        val iosX64Main by getting
        val iosArm64Main by getting
        val iosSimulatorArm64Main by getting

        val iosMain by creating {
            dependsOn(nativeAndAndroidMain)
            iosX64Main.dependsOn(this)
            iosArm64Main.dependsOn(this)
            iosSimulatorArm64Main.dependsOn(this)

            dependencies {
                // Ktor iOS engine
                implementation("io.ktor:ktor-client-darwin:3.6.0")

                // SQLDelight native driver
                implementation("app.cash.sqldelight:native-driver:2.2.1")
            }
        }
    }
}

extensions.configure<com.android.build.api.dsl.LibraryExtension>("android") {
    namespace = "com.futebadosparcas.shared"
    compileSdk = 37

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
            schemaOutputDirectory.set(file("src/commonMain/sqldelight/databases"))
            verifyMigrations.set(true)
            deriveSchemaFromMigrations.set(true)
        }
    }
}
