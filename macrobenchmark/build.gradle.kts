// Módulo de macrobenchmark para medir startup e scroll em condições realistas.
// Usa com.android.test (módulo de teste Android puro, sem APK de produção).
// Benchmarks executam no APK do build type "benchmark" do :app.
//
// Para rodar localmente:
//   ./gradlew :macrobenchmark:connectedBenchmarkAndroidTest \
//     -Pandroid.testInstrumentationRunnerArguments.androidx.benchmark.profiling.mode=None
//
// Para compilar sem executar (verificação CI):
//   ./gradlew :macrobenchmark:compileBenchmarkKotlin

plugins {
    id("com.android.test")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.futebadosparcas.macrobenchmark"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        targetSdk = 36
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Desabilita profiling por padrão para runs de CI/emulador.
        testInstrumentationRunnerArguments["androidx.benchmark.profiling.mode"] = "None"
        testInstrumentationRunnerArguments["androidx.benchmark.suppressErrors"] =
            "EMULATOR,DEBUGGABLE"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }


    // Aponta para o módulo :app como alvo dos benchmarks
    targetProjectPath = ":app"

    // Mantém o runner do benchmark fora do processo do app alvo. Sem isso,
    // o Macrobenchmark mata o próprio processo ao force-stop do app medido.
    experimentalProperties["android.experimental.self-instrumenting"] = true

    // Build type que espelha o "benchmark" configurado no :app
    buildTypes {
        create("benchmark") {
            isDebuggable = false
            // Usa a assinatura debug para facilitar execução em emulador/CI
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }
}

dependencies {
    // JUnit 4 runner padrão para testes Android
    implementation("junit:junit:4.13.2")
    implementation("androidx.test.ext:junit:1.2.1")
    implementation("androidx.test.espresso:espresso-core:3.6.1")

    // UiAutomator para interações de UI durante benchmarks
    implementation("androidx.test.uiautomator:uiautomator:2.3.0")

    // Macrobenchmark — mesma versão usada no módulo baselineprofile
    implementation("androidx.benchmark:benchmark-macro-junit4:1.4.1")
}

// Kotlin 2.4: kotlinOptions {} virou erro; usar compilerOptions DSL.
kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}
