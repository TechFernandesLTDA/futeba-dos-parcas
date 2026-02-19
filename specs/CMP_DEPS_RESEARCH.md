# Pesquisa de Dependências CMP - Fase 0

Data: 2026-02-18
Autor: version-researcher agent

## Contexto

Pesquisa de versões estáveis e compatíveis para migração CMP do projeto Futeba dos Parças.

- **Kotlin**: 2.2.10
- **AGP**: 9.0.1
- **CMP target**: 1.10.0
- **Platforms**: Android, iOS, wasmJs

---

## 1. Koin Multiplatform

- **Versão estável**: 4.1.1
- **Kotlin compatibility**: 2.1.x/2.2.x (4.2.0-alpha1 usa Kotlin 2.2.20; 4.1.1 é a última estável)
- **wasmJs**: Sim - suportado via `koin-core` e `koin-compose-viewmodel`
- **BOM disponível**: Sim - abordagem recomendada

### Artefatos (usando BOM)

```kotlin
// libs.versions.toml
[versions]
koin = "4.1.1"

[libraries]
koin-bom = { module = "io.insert-koin:koin-bom", version.ref = "koin" }
koin-core = { module = "io.insert-koin:koin-core" }
koin-android = { module = "io.insert-koin:koin-android" }
koin-compose = { module = "io.insert-koin:koin-compose" }
koin-compose-viewmodel = { module = "io.insert-koin:koin-compose-viewmodel" }

// build.gradle.kts (shared/composeApp)
implementation(platform(libs.koin.bom))

// commonMain
implementation(libs.koin.core)

// androidMain
implementation(libs.koin.android)

// Compose (shared ou androidMain dependendo do setup)
implementation(libs.koin.compose)
implementation(libs.koin.compose.viewmodel)
```

### Notas

- `koin-compose` e `koin-compose-viewmodel` suportam: Android, JVM Desktop, iOS, macOS, JS, **wasmJs**
- Para inicializar no `App()` composable raiz: `KoinApplication { ... }`
- wasmJs/js requerem `--ignore-engines` no npm install (configurado automaticamente pelo plugin)

---

## 2. GitLive Firebase Kotlin SDK

- **Versão estável**: 2.4.0
- **GroupId**: `dev.gitlive`
- **Kotlin compatibility**: 2.0+ (testado até 2.2.x)
- **wasmJs**: NAO suportado explicitamente
  - SDK suporta: Android, iOS, JVM Desktop, JS/Browser
  - wasmJs NÃO está na lista de targets publicados
  - Para web (wasmJs), considerar **Firebase JS SDK via interop** ou dados mockados

### Artefatos disponíveis

```kotlin
// libs.versions.toml
[versions]
gitlive-firebase = "2.4.0"

[libraries]
firebase-auth-gitlive = { module = "dev.gitlive:firebase-auth", version.ref = "gitlive-firebase" }
firebase-firestore-gitlive = { module = "dev.gitlive:firebase-firestore", version.ref = "gitlive-firebase" }
firebase-storage-gitlive = { module = "dev.gitlive:firebase-storage", version.ref = "gitlive-firebase" }
firebase-functions-gitlive = { module = "dev.gitlive:firebase-functions", version.ref = "gitlive-firebase" }
firebase-messaging-gitlive = { module = "dev.gitlive:firebase-messaging", version.ref = "gitlive-firebase" }

// Uso (apenas nos targets suportados: androidMain, iosMain, jvmMain, jsMain)
implementation(libs.firebase.auth.gitlive)
implementation(libs.firebase.firestore.gitlive)
implementation(libs.firebase.storage.gitlive)
```

### Estrategia para wasmJs

Como GitLive Firebase NAO suporta wasmJs, as opcoes sao:

1. **Excluir wasmJs do Firebase**: Criar `expect/actual` com stub vazio para wasmJs
2. **Firebase JS SDK via interop**: Usar `@JsModule` para chamar o SDK JS diretamente no target wasmJs (complexo)
3. **Backend REST**: No wasmJs, usar Ktor HTTP para chamar Cloud Functions REST API diretamente

**Recomendacao**: Opcao 1 (stubs) para MVP. Firebase nao e necessario no web app (peladas sao mobile-first).

---

## 3. Coil 3 KMP

- **Versão estável**: 3.3.0
- **Kotlin compatibility**: 2.x
- **wasmJs**: Sim - suportado desde 3.0.0-alpha05 (fevereiro 2024)
- **Plataformas**: Android, iOS, macOS, Linux, Windows, JS, **wasmJs**

### Artefatos

```kotlin
// libs.versions.toml
[versions]
coil = "3.3.0"

[libraries]
coil-compose = { module = "io.coil-kt.coil3:coil-compose", version.ref = "coil" }
coil-network-ktor = { module = "io.coil-kt.coil3:coil-network-ktor3", version.ref = "coil" }
coil-network-okhttp = { module = "io.coil-kt.coil3:coil-network-okhttp", version.ref = "coil" }

// commonMain
implementation(libs.coil.compose)

// Android/iOS - usar OkHttp ou Ktor network
// Para wasmJs - usar coil-network-ktor (Ktor suporta wasmJs)
```

### Notas

- `coil-compose` funciona em todos os targets CMP incluindo wasmJs
- Para carregamento de imagens via rede no wasmJs, usar `coil-network-ktor3` (nao OkHttp)
- OkHttp e exclusivo para Android/JVM

---

## 4. SQLDelight wasmJs

- **Versão estável**: 2.2.1
- **wasmJs**: Sim - `web-worker-driver-wasm-js` disponivel desde 2.1.0
- **Driver wasmJs**: SQL.js rodando em Web Worker (NAO IndexedDB nativamente)

### Artefatos

```kotlin
// libs.versions.toml
[versions]
sqldelight = "2.2.1"

[libraries]
sqldelight-android-driver = { module = "app.cash.sqldelight:android-driver", version.ref = "sqldelight" }
sqldelight-native-driver = { module = "app.cash.sqldelight:native-driver", version.ref = "sqldelight" }
sqldelight-sqlite-driver = { module = "app.cash.sqldelight:sqlite-driver", version.ref = "sqldelight" }   # JVM Desktop
sqldelight-web-worker-driver = { module = "app.cash.sqldelight:web-worker-driver-wasm-js", version.ref = "sqldelight" }

// Per-platform:
// androidMain
implementation(libs.sqldelight.android.driver)

// iosMain / nativeMain
implementation(libs.sqldelight.native.driver)

// jvmMain
implementation(libs.sqldelight.sqlite.driver)

// wasmJsMain
implementation(libs.sqldelight.web.worker.driver)
```

### Configuracao especial para wasmJs

```kotlin
// No wasmJsMain/DatabaseDriver.kt
actual fun createDriver(): SqlDriver {
    val schema = Database.Schema
    return WebWorkerDriver(
        Worker(
            js("""new URL("@cashapp/sqldelight-sqljs-worker/sqljs.worker.js", import.meta.url)""")
        )
    ).also { db -> schema.create(db) }
}
```

### Dependencia npm necessaria

```kotlin
// build.gradle.kts
kotlin {
    sourceSets {
        wasmJsMain.dependencies {
            implementation(npm("@cashapp/sqldelight-sqljs-worker", "2.0.2"))
            implementation(npm("sql.js", "1.10.2"))
        }
    }
}
```

### Notas

- O driver wasmJs e **assincrono** - `generateAsync = true` no plugin SQLDelight
- Memoria: pode dar `Out of memory` em datasets grandes (SQL.js carrega tudo em RAM)
- Para o projeto Futeba (mobile-first), SQLDelight em wasmJs pode ser desnecessario se o web app nao precisar de cache local

---

## 5. Ktor para wasmJs

- **Versão estável**: 3.4.0 (lancado em 23 janeiro 2026)
- **wasmJs**: Sim - suportado via engine CIO ou JS
- **Status wasmJs**: Beta (funcional, pode ter quebras de API)

### Artefatos

```kotlin
// libs.versions.toml
[versions]
ktor = "3.4.0"

[libraries]
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-cio = { module = "io.ktor:ktor-client-cio", version.ref = "ktor" }         # JVM/Android/Native
ktor-client-darwin = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }   # iOS/macOS
ktor-client-js = { module = "io.ktor:ktor-client-js", version.ref = "ktor" }           # JS + wasmJs
ktor-client-okhttp = { module = "io.ktor:ktor-client-okhttp", version.ref = "ktor" }   # Android (alternativa)
ktor-serialization-kotlinx-json = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }
ktor-client-content-negotiation = { module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }

// commonMain
implementation(libs.ktor.client.core)
implementation(libs.ktor.client.content.negotiation)
implementation(libs.ktor.serialization.kotlinx.json)

// androidMain
implementation(libs.ktor.client.cio)  // ou ktor-client-okhttp

// iosMain
implementation(libs.ktor.client.darwin)

// jvmMain
implementation(libs.ktor.client.cio)

// jsMain + wasmJsMain (mesmo artefato)
implementation(libs.ktor.client.js)
```

### Notas

- `ktor-client-js` cobre tanto `jsMain` quanto `wasmJsMain` (mesmo artefato, targets separados)
- CIO engine suporta: JVM, Android, Native, **JS, wasmJs** (engine unificado)
- Para Coil 3 no wasmJs, Ktor e o network backend recomendado

---

## Resumo: Gradle Snippets Prontos

### libs.versions.toml (secao de versoes)

```toml
[versions]
koin = "4.1.1"
gitlive-firebase = "2.4.0"
coil = "3.3.0"
sqldelight = "2.2.1"
ktor = "3.4.0"
```

### libs.versions.toml (secao de libraries)

```toml
[libraries]
# Koin
koin-bom = { module = "io.insert-koin:koin-bom", version.ref = "koin" }
koin-core = { module = "io.insert-koin:koin-core" }
koin-android = { module = "io.insert-koin:koin-android" }
koin-compose = { module = "io.insert-koin:koin-compose" }
koin-compose-viewmodel = { module = "io.insert-koin:koin-compose-viewmodel" }

# GitLive Firebase
firebase-auth-kmp = { module = "dev.gitlive:firebase-auth", version.ref = "gitlive-firebase" }
firebase-firestore-kmp = { module = "dev.gitlive:firebase-firestore", version.ref = "gitlive-firebase" }
firebase-storage-kmp = { module = "dev.gitlive:firebase-storage", version.ref = "gitlive-firebase" }
firebase-functions-kmp = { module = "dev.gitlive:firebase-functions", version.ref = "gitlive-firebase" }

# Coil 3
coil-compose = { module = "io.coil-kt.coil3:coil-compose", version.ref = "coil" }
coil-network-ktor = { module = "io.coil-kt.coil3:coil-network-ktor3", version.ref = "coil" }

# SQLDelight
sqldelight-android-driver = { module = "app.cash.sqldelight:android-driver", version.ref = "sqldelight" }
sqldelight-native-driver = { module = "app.cash.sqldelight:native-driver", version.ref = "sqldelight" }
sqldelight-sqlite-driver = { module = "app.cash.sqldelight:sqlite-driver", version.ref = "sqldelight" }
sqldelight-web-worker-driver = { module = "app.cash.sqldelight:web-worker-driver-wasm-js", version.ref = "sqldelight" }

# Ktor
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-cio = { module = "io.ktor:ktor-client-cio", version.ref = "ktor" }
ktor-client-darwin = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }
ktor-client-js = { module = "io.ktor:ktor-client-js", version.ref = "ktor" }
ktor-serialization-json = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }
ktor-client-content-negotiation = { module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }
```

---

## Tabela de Compatibilidade por Target

| Biblioteca | Android | iOS | JVM Desktop | JS | wasmJs |
|-----------|---------|-----|-------------|-----|--------|
| Koin Core | Sim | Sim | Sim | Sim | **Sim** |
| Koin Compose | Sim | Sim | Sim | Sim | **Sim** |
| GitLive Firebase | Sim | Sim | Sim | Sim (JS) | **NAO** |
| Coil 3 | Sim | Sim | Sim | Sim | **Sim** |
| SQLDelight | Sim | Sim | Sim | Sim | **Sim** (web-worker) |
| Ktor Client | Sim | Sim | Sim | Sim | **Sim** (beta) |

---

## Riscos e Decisoes

| # | Risco | Decisao Recomendada |
|---|-------|---------------------|
| R1 | GitLive Firebase sem wasmJs | Usar stubs/expect-actual vazios para wasmJs; Firebase nao e necessario no web MVP |
| R2 | SQLDelight wasmJs usa SQL.js (RAM) | Se web app nao precisar de offline cache, pular SQLDelight em wasmJs |
| R3 | Ktor wasmJs em "beta" | Aceitavel para Coil network; evitar uso direto em producao ate estabilizar |
| R4 | Koin 4.1.1 vs Kotlin 2.2.10 | Compativel; aguardar 4.2.0-stable antes de upgrade de Kotlin |

---

## Fontes

- [Koin 4.1 Release Blog](https://blog.kotzilla.io/koin-4.1-is-here)
- [GitLive Firebase SDK Releases](https://github.com/GitLiveApp/firebase-kotlin-sdk/releases)
- [Coil 3 CHANGELOG](https://github.com/coil-kt/coil/blob/main/CHANGELOG.md)
- [SQLDelight web-worker-driver-wasm-js (Maven Central)](https://central.sonatype.com/artifact/app.cash.sqldelight/web-worker-driver-wasm-js)
- [Ktor Releases](https://ktor.io/docs/releases.html)
- [Ktor Supported Platforms](https://ktor.io/docs/client-supported-platforms.html)
