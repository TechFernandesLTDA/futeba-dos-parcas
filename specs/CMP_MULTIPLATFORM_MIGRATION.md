# CMP Multiplatform Migration Spec

**Status:** 🔄 IN PROGRESS
**Fase Ativa:** Fase 0 - CMP 1.7.3 → 1.10.0 + wasmJs
**Data de Início:** 2026-02-18
**Relacionado:** `specs/KMP_MIGRATION_PROGRESS.md` (preparação KMP anterior)

---

## Resumo Executivo

O projeto Futeba dos Parças está migrando de uma arquitetura Android-first com Compose Multiplatform parcial para uma arquitetura **CMP completa** com suporte a Android, iOS e Web (wasmJs).

**Por que:** A base KMP já está 75% pronta (modelos, interfaces, use cases em commonMain). A migração CMP completa permite:
1. Distribuição iOS sem reescrever UI
2. Web app via wasmJs para acesso pelo browser
3. Manutenção unificada de 54 telas em vez de duplicar por plataforma

**O que muda arquiteturalmente:**
- DI: Hilt (Android-only) → **Koin** (multiplatform)
- Firebase: SDK Android → **GitLive Firebase Kotlin SDK** (KMP)
- Navigation: Jetpack Navigation → **CMP Navigation 2.9.1**
- Imagens: Coil 2 → **Coil 3 KMP**
- CMP: 1.7.3 (Android + iOS) → **1.10.0** (Android + iOS + wasmJs)

**O que NÃO muda:**
- `:app` módulo Android permanece (FCM, App Check, bootstrap)
- Firestore rules, Cloud Functions, backend REST
- Lógica de domínio em `shared/commonMain` (já está lá)
- `:baselineprofile` (performance, inalterado)

---

## Stack de Tecnologias

| Camada | Atual | Alvo |
|--------|-------|------|
| CMP Version | 1.7.3 | **1.10.0** |
| Targets | Android + iOS | **Android + iOS + wasmJs** |
| DI | Hilt 2.x | **Koin 4.1.1** (BOM, multiplatform) |
| Firebase | Android SDK (Firebase BOM) | **GitLive Firebase Kotlin SDK 2.4.0** |
| Navigation | Jetpack Navigation 2.8.x | **CMP Navigation 2.9.1** |
| Imagens | Coil 2 | **Coil 3.3.0 KMP** |
| HTTP Client | — | **Ktor 3.4.0** (wasmJs via ktor-client-js) |
| SQLDelight | 2.0.1 (já KMP) | **2.2.1** (web-worker-driver-wasm-js para wasmJs) |
| Kotlin | 2.2.10 | 2.2.10 (inalterado por ora) |
| AGP | 9.0.1 | 9.0.1 (inalterado) |
| KSP | 2.2.10-2.0.2 | 2.2.10-2.0.2 (inalterado) |

---

## Status das Fases

| Fase | Nome | Complexidade | Status | Issue | Descrição |
|------|------|-------------|--------|-------|-----------|
| 0 | Atualizar CMP + wasmJs | Média | 🔄 IN PROGRESS | - | Bump 1.7.3→1.10.0, adicionar wasmJs target |
| 1 | Migrar DI: Hilt → Koin | Alta | ⏳ PENDING | - | Substituir 12 módulos Hilt por Koin multiplatform |
| 2 | GitLive Firebase SDK | Alta | ⏳ PENDING | - | Substituir Firebase Android SDK no shared |
| 3 | CMP Navigation | Alta | ⏳ PENDING | - | Migrar 54 telas de Jetpack Nav para CMP Nav |
| 4 | Coil 3 KMP | Baixa | ⏳ PENDING | - | Atualizar carregamento de imagens |
| 5 | Completar iosMain | Média | ⏳ PENDING | - | Implementar 9 stubs + 14 repositórios iOS |
| 6 | wasmJs Implementações | Alta | ⏳ PENDING | - | Adaptar repositórios para Web |
| 7 | Migrar UI para composeApp | Muito Alta | ⏳ PENDING | - | Mover 54 telas do :app para :composeApp |
| 8 | iOS App + Web Deploy | Alta | ⏳ PENDING | - | Xcode config, Firebase iOS, web hosting |

---

## Fase 0 (ATIVA): CMP 1.7.3 → 1.10.0 + wasmJs

### Fase 0: Atualizar CMP e Adicionar wasmJs Target
**Status:** 🔄 IN PROGRESS
**Branch:** `feat/cmp-phase-0`

#### O que muda

1. **CMP 1.7.3 → 1.10.0** no `composeApp/build.gradle.kts`
2. **Adicionar wasmJs target** ao módulo `composeApp`
3. **Adicionar wasmJs target** ao módulo `shared` (para usar modelos no web)
4. **Verificar compatibilidade** de bibliotecas com wasmJs

#### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `gradle/libs.versions.toml` | `compose-multiplatform = "1.10.0"` |
| `composeApp/build.gradle.kts` | Adicionar `wasmJs { browser() }` target |
| `shared/build.gradle.kts` | Adicionar `wasmJs { browser() }` target |
| `composeApp/src/wasmJsMain/` | Criar entry point Web (novo diretório) |
| `shared/src/wasmJsMain/` | Criar stubs de platform services para Web |

#### Tarefas

- [ ] Atualizar `compose-multiplatform` para `1.10.0` em `libs.versions.toml`
- [ ] Adicionar `wasmJs { browser(); binaries.executable() }` no `composeApp/build.gradle.kts`
- [ ] Adicionar `wasmJs { browser() }` no `shared/build.gradle.kts`
- [ ] Criar `composeApp/src/wasmJsMain/kotlin/.../MainApp.kt` (entry point Web)
- [ ] Criar `composeApp/src/wasmJsMain/kotlin/.../index.html` (página Web)
- [ ] Criar stubs `shared/src/wasmJsMain/` para expect/actual (PreferencesService, PlatformLogger, FirebaseDataSource)
- [ ] Verificar que todas as libs do `composeApp` suportam wasmJs ou têm alternativas
- [ ] Rodar `./gradlew compileDebugKotlin` para validar Android não quebrou
- [ ] Rodar `./gradlew :composeApp:wasmJsBrowserDevelopmentRun` para testar Web

#### Verificação

- [ ] `./gradlew compileDebugKotlin` — 0 erros
- [ ] `./gradlew :composeApp:compileKotlinWasmJs` — 0 erros
- [ ] `./gradlew :shared:compileKotlinWasmJs` — 0 erros
- [ ] App Android ainda instala e funciona: `./gradlew installDebug`

#### Riscos Fase 0

- **Bibliotecas sem suporte wasmJs:** Coil 2, Ktor OkHttp engine não suportam wasmJs. Solução: usar stubs/expects até Fase 4 (Coil 3) e Fase 2 (GitLive Firebase)
- **kotlinx.serialization:** Versão atual (1.6.0) suporta wasmJs — OK
- **SQLDelight:** Driver wasmJs usa SQL.js (browser) — adicionar dependência

---

## Fase 1: Migrar DI — Hilt → Koin

### Fase 1: Hilt para Koin Multiplatform
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-1`

#### Contexto

O projeto tem 12 módulos Hilt em `app/src/main/java/com/futebadosparcas/di/`:
- FirebaseModule, RepositoryModule, UseCaseModule
- ViewModelModule (se existir), NetworkModule, DatabaseModule, etc.

Hilt é Android-only. Koin 4.x suporta Android, iOS e wasmJs.

#### Tarefas

- [ ] Adicionar Koin BOM `4.x` ao `libs.versions.toml`
- [ ] Adicionar deps Koin em `composeApp/build.gradle.kts` (`koin-compose-multiplatform`)
- [ ] Criar módulos Koin equivalentes em `composeApp/src/commonMain/di/`
  - [ ] `SharedModule.kt` (repositories, use cases)
  - [ ] `ViewModelModule.kt` (39 ViewModels)
  - [ ] `NetworkModule.kt`
  - [ ] `DatabaseModule.kt`
- [ ] Criar `composeApp/src/androidMain/di/AndroidModule.kt` (FCM, App Check, serviços Android)
- [ ] Criar `composeApp/src/iosMain/di/IosModule.kt`
- [ ] Criar `composeApp/src/wasmJsMain/di/WebModule.kt`
- [ ] Substituir `@HiltViewModel` por `viewModel<T>()` nos 39 ViewModels
- [ ] Remover anotações `@Inject constructor`, `@Module`, `@InstallIn`, `@Provides`
- [ ] Manter Hilt apenas em `:app` para FCM/bootstrap se necessário (período transitório)
- [ ] Atualizar `composeApp/src/androidMain/MainActivity.kt` para inicializar Koin
- [ ] Remover dependências Hilt do `composeApp/build.gradle.kts`

#### Verificação

- [ ] `./gradlew compileDebugKotlin` — 0 erros
- [ ] `./gradlew :app:testDebugUnitTest` — todos os testes passam
- [ ] App Android funciona com DI Koin

---

## Fase 2: GitLive Firebase Kotlin SDK

### Fase 2: Firebase Android SDK → GitLive KMP
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-2`

#### Contexto

Atualmente, `shared/androidMain` usa o Firebase Android SDK diretamente. O GitLive Firebase Kotlin SDK (`dev.gitlive:firebase-*`) é um wrapper KMP que suporta Android, iOS e JS (incluindo wasmJs).

#### Tarefas

- [ ] Adicionar GitLive Firebase deps ao `libs.versions.toml`
  - `gitlive-firebase = "2.4.0"` (compatível com Kotlin 2.2.10, KMP 1.10.0; sem suporte wasmJs)
- [ ] Adicionar ao `shared/build.gradle.kts` (commonMain):
  - `dev.gitlive:firebase-auth`
  - `dev.gitlive:firebase-firestore`
  - `dev.gitlive:firebase-storage`
  - `dev.gitlive:firebase-messaging` (Android + iOS)
- [ ] Migrar `shared/src/androidMain/` — substituir imports `com.google.firebase.*` por `dev.gitlive.firebase.*`
- [ ] Mover implementações de repositórios de `androidMain` para `commonMain` onde possível
- [ ] Criar implementações reais em `shared/src/iosMain/` usando GitLive (substituir os 9 stubs)
- [ ] Criar stubs wasmJs em `shared/src/wasmJsMain/` (Firebase não tem suporte Web real via GitLive — usar REST API ou stubs)
- [ ] Atualizar `shared/src/commonMain/platform/firebase/FirebaseDataSource.kt`
- [ ] Remover Firebase Android BOM do `app/build.gradle.kts` (manter apenas FCM e App Check que são Android-only)

#### Verificação

- [ ] `./gradlew compileDebugKotlin` — 0 erros
- [ ] `./gradlew :shared:compileKotlinIosSimulatorArm64` — 0 erros
- [ ] Firestore read/write funciona no Android após migração

---

## Fase 3: CMP Navigation

### Fase 3: Jetpack Navigation → CMP Navigation 2.9.1
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-3`

#### Contexto

54 telas, todas atualmente em `app/src/main/java/com/futebadosparcas/ui/`, usando:
- `AppNavGraph.kt` (Jetpack Compose Navigation)
- `NavDestinations.kt` + `routes/AppRoutes.kt`
- `hiltViewModel()` (será substituído por Koin na Fase 1)

CMP Navigation 2.9.1 tem API similar ao Jetpack Navigation mas roda em todas as plataformas.

#### Tarefas

- [ ] Atualizar `libs.versions.toml`: `navigation-compose = "2.9.1"` (CMP)
- [ ] Atualizar `composeApp/build.gradle.kts` para usar CMP Navigation
- [ ] Migrar `AppNavGraph.kt` para `composeApp/src/commonMain/navigation/`
- [ ] Migrar `NavDestinations.kt` e `AppRoutes.kt` para commonMain
- [ ] Adaptar type-safe navigation (verificar compatibilidade com CMP Navigation)
- [ ] Substituir `hiltViewModel()` por `koinViewModel()` nas screens (pré-requisito: Fase 1)
- [ ] Testar deep links em Android após migração

#### Verificação

- [ ] `./gradlew compileDebugKotlin` — 0 erros
- [ ] Todas as 54 rotas de navegação funcionam no Android
- [ ] Back stack funciona corretamente

---

## Fase 4: Coil 3 KMP

### Fase 4: Coil 2 → Coil 3 KMP
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-4`

#### Contexto

Coil 3 tem suporte nativo a KMP (Android, iOS, Web). Coil 2 é Android-only.

#### Tarefas

- [ ] Atualizar `libs.versions.toml`: `coil = "3.3.0"`
- [ ] Substituir `io.coil-kt:coil-compose` por `io.coil-kt.coil3:coil-compose`
- [ ] Adicionar `io.coil-kt.coil3:coil-network-ktor3` para KMP network loading (suporta wasmJs; nao usar OkHttp no wasmJs)
- [ ] Atualizar imports de `coil.compose.*` para `coil3.compose.*` nas telas afetadas
- [ ] Verificar `AsyncImage`, `rememberAsyncImagePainter` — mesma API no Coil 3
- [ ] Configurar `ImageLoader` com suporte a plataformas em `composeApp/commonMain`

#### Verificação

- [ ] `./gradlew compileDebugKotlin` — 0 erros
- [ ] Imagens carregam corretamente no Android
- [ ] `./gradlew :composeApp:compileKotlinWasmJs` — 0 erros

---

## Fase 5: Completar iosMain

### Fase 5: Implementações iOS Reais
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-5`

#### Contexto

`shared/src/iosMain/` tem 9 stubs. Depois da Fase 2 (GitLive), a maioria pode ser implementada usando a API unificada.

14 repositórios precisam de implementações iOS equivalentes aos 14 de androidMain.

#### Tarefas

- [ ] Implementar `FirebaseDataSource.kt` iOS usando GitLive
- [ ] Implementar `RepositoryFactory.kt` iOS
- [ ] Verificar/completar `DatabaseDriverFactory.kt` (SQLDelight Native driver)
- [ ] Implementar `AddressRepositoryImpl.kt` (Ktor Darwin engine)
- [ ] Implementar `LocationRepositoryImpl.kt` (Firestore via GitLive)
- [ ] Verificar `PreferencesService.kt` (NSUserDefaults — já tem stub básico)
- [ ] Verificar `PlatformLogger.kt` (NSLog — já tem stub básico)
- [ ] Verificar `MigrationChecksum.kt` / `MigrationContext.kt`
- [ ] Criar `AuthRepositoryImpl.kt` iOS
- [ ] Criar `ActivityRepositoryImpl.kt` iOS
- [ ] Criar `CashboxRepositoryImpl.kt` iOS
- [ ] Criar `GameEventsRepositoryImpl.kt` iOS
- [ ] Criar `GameTeamRepositoryImpl.kt` iOS
- [ ] Criar `GamificationRepositoryImpl.kt` iOS
- [ ] Criar `GroupRepositoryImpl.kt` iOS
- [ ] Criar `LiveGameRepositoryImpl.kt` iOS
- [ ] Criar `NotificationRepositoryImpl.kt` iOS (APNs)
- [ ] Criar `RankingRepositoryImpl.kt` iOS
- [ ] Criar `StatisticsRepositoryImpl.kt` iOS
- [ ] Criar `GameExperienceRepositoryImpl.kt` iOS
- [ ] Criar `GameSummonRepositoryImpl.kt` iOS
- [ ] Criar `GameRequestRepositoryImpl.kt` iOS

#### Verificação

- [ ] `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64` — 0 erros
- [ ] `./gradlew :shared:linkDebugFrameworkIosArm64` — 0 erros
- [ ] Build iOS App CI check passa

---

## Fase 6: wasmJs Implementações

### Fase 6: Suporte Web (wasmJs)
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-6`

#### Contexto

wasmJs roda no browser. Firebase não tem SDK oficial para wasmJs — usar Firebase REST API ou stubs com funcionalidade limitada (autenticação apenas, leitura via REST).

#### Tarefas

- [ ] Criar `shared/src/wasmJsMain/` com stubs necessários
  - [ ] `PreferencesService.kt` (localStorage)
  - [ ] `PlatformLogger.kt` (console.log)
  - [ ] `FirebaseDataSource.kt` (REST API ou stub)
  - [ ] `DatabaseDriverFactory.kt` (SQL.js driver para SQLDelight)
- [ ] Definir escopo de funcionalidades Web (ex: apenas visualização de estatísticas, sem autenticação completa)
- [ ] Criar repositórios Web com Firebase REST API
- [ ] Criar entry point web: `composeApp/src/wasmJsMain/kotlin/.../main.kt`
- [ ] Criar `index.html` na pasta de recursos wasmJs
- [ ] Configurar webpack/composeApp para produção web

#### Verificação

- [ ] `./gradlew :composeApp:wasmJsBrowserDevelopmentRun` — app carrega no browser
- [ ] Telas de visualização funcionam (ranking, estatísticas)

---

## Fase 7: Migrar UI para composeApp

### Fase 7: Mover 54 Telas do :app para :composeApp
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-7`

#### Contexto

54 telas em `app/src/main/java/com/futebadosparcas/ui/` precisam ser movidas para `composeApp/src/commonMain/`. Esta é a fase mais trabalhosa.

Pré-requisitos: Fases 1 (Koin), 3 (CMP Nav) e 4 (Coil 3) concluídas.

#### Estratégia de Migração (por domínio)

- [ ] **Grupo 1 — Telas simples sem dependências Android-specific** (migrar primeiro)
  - Ranking, Leaderboard, Player Profile, Game History
- [ ] **Grupo 2 — Telas com Firestore simples**
  - Game Detail, Group Detail, Statistics
- [ ] **Grupo 3 — Telas de criação/edição**
  - Create Game, Create Group, Edit Profile
- [ ] **Grupo 4 — Telas com funcionalidades Android-specific** (avaliar expect/actual)
  - Camera/Storage, Notifications, Maps, Location
- [ ] **Grupo 5 — Fluxos de autenticação**
  - Login, Register, Phone Auth
- [ ] Mover `app/src/main/res/values/strings.xml` (3.279+ strings) para `composeApp/src/commonMain/composeResources/values/`
- [ ] Migrar tema (`Theme.kt`) de `app` para `composeApp/commonMain`
- [ ] Mover componentes reutilizáveis para `composeApp/commonMain/components/`
- [ ] Remover telas migradas do `:app` gradualmente

#### Verificação

- [ ] `./gradlew installDebug` — app Android funciona normalmente
- [ ] `./gradlew :composeApp:compileKotlinWasmJs` — telas básicas compilam para Web
- [ ] `./gradlew :shared:linkDebugFrameworkIosSimulatorArm64` — OK

---

## Fase 8: iOS App + Web Deploy

### Fase 8: Publicação iOS e Web
**Status:** ⏳ PENDING
**Issue:** (a criar)
**Branch:** `feat/cmp-phase-8`

#### Tarefas iOS

- [ ] Configurar projeto Xcode (`iosApp/iosApp.xcodeproj`)
- [ ] Integrar Firebase iOS SDK via SPM (Swift Package Manager)
- [ ] Configurar `GoogleService-Info.plist`
- [ ] Configurar App Check para iOS (DeviceCheck)
- [ ] Configurar push notifications (APNs)
- [ ] Configurar CI para iOS (`ios-build.yml` — já existe, ajustar)
- [ ] Criar pipeline de deploy TestFlight

#### Tarefas Web

- [ ] Configurar Firebase Hosting para web app
- [ ] Configurar domínio (subdomínio de `futebadosparcas.web.app`)
- [ ] Configurar CI para deploy web
- [ ] Definir autenticação web (Firebase Auth REST ou OAuth)

#### Verificação

- [ ] Build iOS App CI check passa (macOS runner)
- [ ] Web app acessível em `futebadosparcas.web.app/app`
- [ ] Android app inalterado e funcional

---

## Decisões Técnicas

| Decisão | Alternativas Consideradas | Motivo |
|---------|--------------------------|--------|
| **Koin** para DI | Hilt (Android-only), Anvil (Android-only) | Único DI framework multiplatform maduro com suporte Compose |
| **GitLive Firebase SDK** | Firebase REST API manual, Firebase Admin SDK | Mantém a API familiar do Firebase, suporta Android + iOS + JS |
| **CMP Navigation 2.9.1** | Decompose, Voyager | Mais próximo da API Jetpack Navigation, menor curvado de aprendizado |
| **Coil 3** | Glide (Android-only), Kamel | API idêntica ao Coil 2, suporte oficial KMP |
| **SQLDelight** (já existe) | Room (Android-only), Exposed | Já configurado e funcionando no shared; suporta Android + iOS + JS |
| **wasmJs** (não JS) | Kotlin/JS (legado), React | wasmJs é o futuro do Kotlin Web, performance nativa |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| GitLive Firebase SDK desatualizado | Média | Alto | Verificar changelog; fallback: Firebase REST API para funcionalidades específicas |
| wasmJs sem suporte em bibliotecas críticas | Alta | Médio | Usar expect/actual para isolar; funcionalidade Web reduzida é aceitável inicialmente |
| Koin DI com 39 ViewModels — overhead de migração | Alta | Médio | Migrar ViewModel por ViewModel; não quebrar build entre migrações |
| Kotlin 2.3+ incompatível com configuração atual | Média | Alto | NUNCA atualizar Kotlin sem testar build; congelar em 2.2.10 durante migração CMP |
| Telas com Android-specific code difíceis de migrar | Alta | Médio | Usar `expect/actual` para APIs de câmera, location, etc. |
| Performance CMP inferior ao Jetpack Compose nativo | Baixa | Alto | CMP 1.10.0 usa Skia (Android usa Canvas2D otimizado); monitorar FPS |

---

## Dependências entre Fases

```
Fase 0 (CMP 1.10.0 + wasmJs)
    ↓
Fase 1 (Koin DI)          Fase 2 (GitLive Firebase) — paralelas, sem dependência mútua
    ↓                           ↓
Fase 3 (CMP Navigation)   Fase 5 (iosMain) — Fase 2 é pré-requisito de Fase 5
    ↓
Fase 4 (Coil 3)
    ↓
Fase 7 (Migrar UI) — Pré-requisitos: Fases 1, 2, 3, 4 concluídas
    ↓
Fase 6 (wasmJs Impl) — pode rodar em paralelo com Fase 7
    ↓
Fase 8 (iOS App + Web Deploy) — Pré-requisitos: Fases 5, 6, 7 concluídas
```

**Fases que podem rodar em paralelo com agent teams:**
- Fase 1 (Koin) + Fase 2 (GitLive Firebase)
- Fase 5 (iosMain) + Fase 6 (wasmJs) + parte de Fase 7 (telas simples)

---

## Como Retomar em Nova Sessão

### Arquivos para ler primeiro (por ordem de importância)

1. **Este arquivo** — `specs/CMP_MULTIPLATFORM_MIGRATION.md` (estado atual das fases)
2. **Progresso KMP anterior** — `specs/KMP_MIGRATION_PROGRESS.md` (o que já foi feito)
3. **Versões atuais** — `gradle/libs.versions.toml` (verificar versões em uso)
4. **Build do composeApp** — `composeApp/build.gradle.kts` (targets e dependências)
5. **Build do shared** — `shared/build.gradle.kts` (targets KMP)
6. **Entry points** — `composeApp/src/commonMain/kotlin/.../App.kt` e `composeApp/src/androidMain/kotlin/.../MainActivity.kt`

### Fase Ativa: Fase 0

Para verificar estado da Fase 0:
```bash
# Verificar versão CMP atual
grep "compose-multiplatform" gradle/libs.versions.toml

# Verificar targets do composeApp
grep -A 20 "kotlin {" composeApp/build.gradle.kts

# Validar compilação Android
./gradlew compileDebugKotlin

# Validar compilação wasmJs (quando adicionado)
./gradlew :composeApp:compileKotlinWasmJs
```

### Comando de Verificação Rápida

```bash
# Verificar estado geral do build (Android)
./gradlew compileDebugKotlin detekt :app:testDebugUnitTest

# Verificar iOS framework
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
```

### Números do Projeto (para contexto)

| Métrica | Valor |
|---------|-------|
| Telas Compose | 54 |
| ViewModels | 39 |
| Módulos Hilt | 12 |
| Strings (strings.xml) | 3.279+ |
| Modelos em commonMain | 35 |
| Interfaces de repo em commonMain | 27 |
| Use Cases em commonMain | 8 |
| Implementações androidMain | 26 |
| Stubs iosMain | 9 |

---

## Relacionados

- `specs/KMP_MIGRATION_PROGRESS.md` — relatório completo da preparação KMP (2026-02-05)
- `specs/SPEC_IOS_KMP_DEVELOPMENT.md` — spec iOS existente
- `specs/DECISIONS.md` — log de decisões técnicas
- `.claude/PROJECT_CONTEXT.md` — contexto consolidado para AIs
- `composeApp/build.gradle.kts` — configuração atual do módulo multiplatform
- `shared/build.gradle.kts` — configuração atual do shared KMP
