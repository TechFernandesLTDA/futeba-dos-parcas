// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    id("com.android.application") version "9.0.1" apply false
    id("com.android.library") version "9.0.1" apply false
    id("com.android.test") version "9.0.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.10" apply false
    id("org.jetbrains.kotlin.multiplatform") version "2.2.10" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.10" apply false
    id("com.google.devtools.ksp") version "2.2.10-2.0.2" apply false
    id("androidx.navigation.safeargs.kotlin") version "2.9.6" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("com.google.firebase.crashlytics") version "3.0.2" apply false
    id("com.google.firebase.firebase-perf") version "2.0.2" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.10" apply false
    id("org.jetbrains.compose") version "1.10.0" apply false
    id("androidx.baselineprofile") version "1.3.3" apply false
    id("io.gitlab.arturbosch.detekt") version "1.23.8" // #061 - Static analysis
}

// Resoluções de segurança para kotlin-js-store/wasm/yarn.lock
// Corrige vulnerabilidades em dependências de build-time do target wasmJs
// GHSA resolvidas: GHSA-f886 (brace-expansion), GHSA-rf6f/GHSA-25h7 (flatted),
//   GHSA-r4q5 (follow-redirects), GHSA-7r86/GHSA-23c5 (minimatch),
//   GHSA-2328/GHSA-q67f/GHSA-ppp5/GHSA-5m6q (node-forge), GHSA-37ch (path-to-regexp),
//   GHSA-3v7f/GHSA-c2c7 (picomatch), GHSA-qj8w/GHSA-5c6j (serialize-javascript),
//   GHSA-677m (socket.io-parser), GHSA-8fgc/GHSA-38r7 (webpack)
//
// Não fixáveis dentro do range atual (documentado no PR):
//   lodash@4.x (GHSA-r5fr/GHSA-f23m — sem patch em 4.x)
//   uuid@8.x (GHSA-w5hq — fix em 9.x, seria major bump)
//   diff@7.x (GHSA-73rr — única versão 7.x, fix em 8.x, severity baixo)
//   webpack-dev-server@4.x (GHSA-9jgg/GHSA-4v9v — fix em 5.x, seria major bump)
rootProject.plugins.withType<org.jetbrains.kotlin.gradle.targets.wasm.yarn.WasmYarnPlugin> {
    rootProject.extensions.getByType<org.jetbrains.kotlin.gradle.targets.wasm.yarn.WasmYarnRootExtension>().apply {
        // brace-expansion: lockfile 1.1.12 → 1.1.14 (GHSA-f886)
        // brace-expansion@^5 (via minimatch@9) é eliminada automaticamente ao
        // atualizar minimatch@^9 para 9.0.9, que muda sua dep para brace-expansion@^2
        resolution("brace-expansion") { include("1.1.14") }
        // flatted: prototype pollution e unbounded recursion DoS (GHSA-rf6f, GHSA-25h7)
        resolution("flatted") { include("3.4.2") }
        // follow-redirects: vazamento de headers de auth cross-domain (GHSA-r4q5)
        resolution("follow-redirects") { include("1.16.0") }
        // minimatch: força 9.0.9 para todos os consumers (GHSA-7r86, GHSA-23c5)
        // minimatch 9.x é retrocompatível para uso de glob em karma/webpack (build-time)
        // 9.0.9 também muda dep brace-expansion de ^5 → ^2, corrigindo GHSA-f886 em 5.x
        resolution("minimatch") { include("9.0.9") }
        // node-forge: 4 vulnerabilidades críticas (GHSA-2328, GHSA-q67f, GHSA-ppp5, GHSA-5m6q)
        resolution("node-forge") { include("1.4.0") }
        // path-to-regexp: ReDoS via backtracking (GHSA-37ch)
        resolution("path-to-regexp") { include("0.1.13") }
        // picomatch: injeção em classes POSIX e ReDoS via extglob (GHSA-3v7f, GHSA-c2c7)
        resolution("picomatch") { include("2.3.2") }
        // serialize-javascript: CPU exhaustion DoS e RCE via RegExp.flags (GHSA-qj8w, GHSA-5c6j)
        resolution("serialize-javascript") { include("7.0.5") }
        // socket.io-parser: attachments ilimitados levando a OOM (GHSA-677m)
        resolution("socket.io-parser") { include("4.2.6") }
        // webpack: bypass de allowedUris no buildHttp (GHSA-8fgc, GHSA-38r7)
        resolution("webpack") { include("5.106.2") }
    }
}

// #061 - Configure Detekt for all projects
allprojects {
    apply(plugin = "io.gitlab.arturbosch.detekt")

    detekt {
        config.setFrom(files("$rootDir/detekt.yml"))
        // Baseline com violações pré-existentes - novas violações ainda falham o build
        baseline = file("$projectDir/detekt-baseline.xml")
        buildUponDefaultConfig = true
        allRules = false
    }

    dependencies {
        detektPlugins("io.gitlab.arturbosch.detekt:detekt-formatting:1.23.7")
    }
}
