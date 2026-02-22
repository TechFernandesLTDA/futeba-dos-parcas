import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl

plugins {
    kotlin("multiplatform")
    id("com.android.library")
    kotlin("plugin.serialization")
    id("app.cash.sqldelight") version "2.2.1"
}

// Forçar Kotlin stdlib 2.2.10 para evitar mismatch com compiler
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
    ).forEach {
        it.binaries.framework {
            baseName = "shared"
            isStatic = true
        }
    }

    // Web target (wasmJs) - Fase 0: infraestrutura
    // SQLDelight 2.2.1 já suporta wasmJs nativamente
    // Ktor 2.x não tem variante wasmJs - migração para Ktor 3.x na Fase 2
    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        browser()
    }

    sourceSets {
        // ========================
        // commonMain: apenas libs com suporte universal (incluindo wasmJs)
        // ========================
        val commonMain by getting {
            dependencies {
                // Coroutines - suporta wasmJs
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.9.0")

                // Serialization - suporta wasmJs
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

                // DateTime - suporta wasmJs
                implementation("org.jetbrains.kotlinx:kotlinx-datetime:0.6.1")
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
            }
        }

        // ========================
        // nativeAndAndroidMain: sourceset intermediário para Android + iOS
        // Ktor 2.x fica aqui (sem suporte wasmJs) - migrar para Ktor 3.x na Fase 2
        // SQLDelight 2.2.1 já está no commonMain via plugin (suporta wasmJs)
        // ========================
        val nativeAndAndroidMain by creating {
            dependsOn(commonMain)
            dependencies {
                // Ktor Client - não tem variante wasmJs no 2.x
                implementation("io.ktor:ktor-client-core:2.3.8")
                implementation("io.ktor:ktor-client-content-negotiation:2.3.8")
                implementation("io.ktor:ktor-serialization-kotlinx-json:2.3.8")
                implementation("io.ktor:ktor-client-logging:2.3.8")

                // SQLDelight 2.2.1 - suporta wasmJs via web-worker-driver
                implementation("app.cash.sqldelight:runtime:2.2.1")
                implementation("app.cash.sqldelight:coroutines-extensions:2.2.1")

                // GitLive Firebase Kotlin SDK 2.4.0 - suporta Android + iOS
                // wasmJs NAO suportado - ver wasmJsMain para stubs
                val gitLiveVersion = "2.4.0"
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
                implementation("io.ktor:ktor-client-okhttp:2.3.8")

                // SQLDelight Android driver
                implementation("app.cash.sqldelight:android-driver:2.2.1")

                // Firebase Android SDK - fornecido via GitLive SDK (transitivo)
                // GitLive traz firebase-firestore, firebase-auth, firebase-storage transitivamente
                // kotlinx-coroutines-play-services: necessário para Tasks.await() em código legado
                // TODO: Fase 2 - remover após migração completa para GitLive suspend functions
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.9.0")

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
                implementation("io.ktor:ktor-client-darwin:2.3.8")

                // SQLDelight native driver
                implementation("app.cash.sqldelight:native-driver:2.2.1")
            }
        }

        // ========================
        // wasmJsMain: Web - stubs de Fase 0
        // Firebase e HTTP reais: Fase 2 (GitLive SDK + Ktor 3.x)
        // SQLDelight: Fase 3 (web-worker-driver quando migrar para 2.2.1)
        // ========================
        val wasmJsMain by getting {
            // Coroutines, serialization, datetime disponíveis via commonMain
            // SQLDelight 2.2.1 suporta wasmJs nativamente (runtime incluído automaticamente pelo plugin)
            // TODO: Fase 2 - adicionar GitLive Firebase SDK (suporta wasmJs)
            // TODO: Fase 2 - adicionar Ktor 3.x (suporta wasmJs nativo)
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
            schemaOutputDirectory.set(file("src/commonMain/sqldelight/databases"))
            verifyMigrations.set(true)
            deriveSchemaFromMigrations.set(true)
        }
    }
}
