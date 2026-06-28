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
// Todos os pacotes abaixo são build-time only (toolchain wasmJs) — sem impacto em runtime Android.
//
// PR #380 (minor bumps dentro do range semver):
//   GHSA-f886 (brace-expansion), GHSA-rf6f/GHSA-25h7 (flatted),
//   GHSA-r4q5 (follow-redirects), GHSA-7r86/GHSA-23c5 (minimatch),
//   GHSA-2328/GHSA-q67f/GHSA-ppp5/GHSA-5m6q (node-forge), GHSA-37ch (path-to-regexp),
//   GHSA-3v7f/GHSA-c2c7 (picomatch), GHSA-qj8w/GHSA-5c6j (serialize-javascript),
//   GHSA-677m (socket.io-parser), GHSA-8fgc/GHSA-38r7 (webpack)
//
// Este PR (major bumps necessários):
//   GHSA-r5fr/GHSA-f23m (lodash 4.17.23 → 4.18.1 — acima do range afetado <= 4.17.23)
//   GHSA-w5hq (uuid 8.x → 14.0.0 — advisory afeta < 14.0.0)
//   GHSA-9jgg/GHSA-4v9v/GHSA-mx8g (webpack-dev-server 4.x → 5.2.5)
//   GHSA-73rr (diff 7.x → 9.0.0 — advisory afeta >= 6.0.0, < 8.0.3)
//   GHSA-qx2v (postcss 8.5.6 → 8.5.13 — advisory afeta < 8.5.10)
//   GHSA-w7jw (shell-quote 1.8.3 → 1.8.4)
//   GHSA-96hv (ws 8.18.x → 8.21.0)
//   GHSA-h67p (js-yaml 4.1.x → 4.2.0)
//   GHSA-v6wh (launch-editor 2.13.x → 2.14.1)
//   GHSA-64mm (http-proxy-middleware 2.0.9 → 2.0.10)
//
// WONTFIX justificado:
//   lodash 5.x — não existe no npm (latest estável é 4.18.1); bump 4.17.23 → 4.18.1 resolve GHSAs
rootProject.plugins.withType<org.jetbrains.kotlin.gradle.targets.wasm.yarn.WasmYarnPlugin> {
    rootProject.extensions.getByType<org.jetbrains.kotlin.gradle.targets.wasm.yarn.WasmYarnRootExtension>().apply {
        // brace-expansion: lockfile 1.1.12 → 1.1.14 (GHSA-f886)
        // brace-expansion@^5 (via minimatch@9) é eliminada automaticamente ao
        // atualizar minimatch@^9 para 9.0.9, que muda sua dep para brace-expansion@^2
        resolution("brace-expansion") { include("1.1.14") }
        // diff: ReDoS via O(n^2) backtracking em diffs grandes (GHSA-73rr)
        // advisory afeta >= 6.0.0, < 8.0.3; bump para 9.0.0 (latest estável)
        resolution("diff") { include("9.0.0") }
        // flatted: prototype pollution e unbounded recursion DoS (GHSA-rf6f, GHSA-25h7)
        resolution("flatted") { include("3.4.2") }
        // follow-redirects: vazamento de headers de auth cross-domain (GHSA-r4q5)
        resolution("follow-redirects") { include("1.16.0") }
        // http-proxy-middleware: host-header-driven backend routing bypass (GHSA-64mm)
        resolution("http-proxy-middleware") { include("2.0.10") }
        // js-yaml: quadratic-complexity DoS em merge keys repetidas (GHSA-h67p)
        resolution("js-yaml") { include("4.2.0") }
        // launch-editor: NTLMv2 hash disclosure via UNC path (GHSA-v6wh)
        resolution("launch-editor") { include("2.14.1") }
        // lodash: ReDoS e template injection (GHSA-r5fr, GHSA-f23m)
        // advisory afeta <= 4.17.23; 4.18.1 está acima do range afetado
        resolution("lodash") { include("4.18.1") }
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
        // postcss: injeção de newline em grid layouts (GHSA-qx2v)
        // advisory afeta < 8.5.10; bump para 8.5.13 (latest estável)
        resolution("postcss") { include("8.5.13") }
        // serialize-javascript: CPU exhaustion DoS e RCE via RegExp.flags (GHSA-qj8w, GHSA-5c6j)
        resolution("serialize-javascript") { include("7.0.5") }
        // shell-quote: quote() não escapava newlines em object .op (GHSA-w7jw)
        resolution("shell-quote") { include("1.8.4") }
        // socket.io-parser: attachments ilimitados levando a OOM (GHSA-677m)
        resolution("socket.io-parser") { include("4.2.6") }
        // uuid: insegurança no gerador de números aleatórios (GHSA-w5hq)
        // advisory afeta < 14.0.0; bump major 8.x → 14.0.0 (build-time only, sem API breaking em consumidores)
        resolution("uuid") { include("14.0.0") }
        // webpack: bypass de allowedUris no buildHttp (GHSA-8fgc, GHSA-38r7)
        resolution("webpack") { include("5.106.2") }
        // webpack-dev-server: DNS rebinding e SSRF (GHSA-9jgg, GHSA-4v9v)
        // advisory atual também exige >= 5.2.5 para HMR proxy hardening (GHSA-mx8g)
        resolution("webpack-dev-server") { include("5.2.5") }
        // ws: memory exhaustion DoS por fragmentos pequenos (GHSA-96hv)
        resolution("ws") { include("8.21.0") }
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
