# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ SPEC-DRIVEN DEVELOPMENT (SDD) - REGRAS OBRIGATÓRIAS

> **LEIA ISTO PRIMEIRO.** Estas regras são inegociáveis.

### Regra #1: NUNCA implementar sem SPEC aprovada

- Toda feature ou bugfix DEVE ter uma spec em `/specs/` **antes** de escrever código
- Copie o template apropriado: `_TEMPLATE_FEATURE_MOBILE.md` ou `_TEMPLATE_BUGFIX_MOBILE.md`
- Status da spec deve ser `APPROVED` antes de iniciar implementação

### Regra #2: Fases obrigatórias

```
REQUIREMENTS → UX/UI → TECHNICAL DESIGN → TASKS → IMPLEMENTATION → VERIFY
```

Não pule fases. Cada uma existe por um motivo.

### Regra #3: Sempre propor plano antes de editar código

Antes de modificar qualquer arquivo:
1. Explique o que vai fazer
2. Liste os arquivos que serão alterados
3. Aguarde confirmação (ou use EnterPlanMode para features complexas)

### Regra #4: Registrar decisões

Toda decisão técnica ou de produto relevante vai para `/specs/DECISIONS.md`.

### Regra #5: Mobile Definition of Done (DoD)

- [ ] Responsividade: Phone portrait, landscape, tablet
- [ ] Acessibilidade: contentDescription, touch targets >= 48dp
- [ ] Performance: No unnecessary recompositions
- [ ] Offline/Errors: Defined behavior (cache/retry/fallback)

### Regra #6: Estados obrigatórios em toda tela

```kotlin
sealed class UiState {
    object Loading : UiState()    // Shimmer/skeleton
    object Empty : UiState()      // Mensagem + ação quando não há dados
    data class Error(val message: String) : UiState()  // Mensagem + retry
    data class Success(val data: T) : UiState()
}
```

---

## Quick Reference

### Build & Test Commands

**Note:** Commands run on macOS and Linux (`./gradlew`).

```bash
# Build (Android)
./gradlew assembleDebug                    # Build debug APK
./gradlew installDebug                     # Install on device
./gradlew compileDebugKotlin               # Fast compile check (use this often!)

# Build (KMP - iOS Framework) - Requires macOS
# O app iOS linka só o ComposeApp.framework, que embute o :shared (#4427)
./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64  # iOS Simulator (M1/M2 Mac)
./gradlew :composeApp:linkDebugFrameworkIosArm64           # iOS Device

# Tests
./gradlew :app:testDebugUnitTest           # Unit tests
./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.YourTestClass"  # Single class
./gradlew :app:testDebugUnitTest --tests "*.YourTestClass.testMethod"         # Single method
./gradlew connectedDebugAndroidTest        # Instrumented tests (device required)

# Quality
./gradlew lint                             # Android Lint (XML/manifest/resources)
./gradlew detekt                           # Static analysis (Detekt - the real linter for Kotlin)
./gradlew clean                            # Clean build

# Cloud Functions (in /functions directory, Node 22)
cd functions && npm install                # Install deps
npm run build                              # Compile TypeScript
npm run lint                               # ESLint (same as CI)
npx jest --no-coverage                     # All tests (~20 test files, run `ls test/*.test.ts | wc -l` for current)
npx jest path/to/file.test.ts              # Single test file
npx jest --testNamePattern="test name"     # Single test by name
firebase emulators:start                   # Local testing
firebase deploy --only functions           # Deploy

# NOTE: New test files that use callable functions need:
# jest.mock("../src/middleware/rate-limiter")
# See functions/test/ for existing test suites

# Backend REST API — ⚠️ ARQUIVADO (archive/backend/, dormente, NÃO usado em produção)
# Decisão #1356 (2026-05-19): web/Android/iOS usam Firestore + Cloud Functions
# direto. Sem consumidor, CI, testes ou deploy. Não desenvolva aqui sem spec SDD.

# iOS App (CocoaPods + KMP framework consumer)
cd iosApp && ./build_shared.sh             # Build shared KMP framework first
cd iosApp && pod install                   # Install CocoaPods deps
# Open iosApp/iosApp.xcworkspace in Xcode to build/run
# See iosApp/SETUP.md for first-time setup

# Fastlane (Android release automation)
cd fastlane && fastlane test               # Run unit tests
fastlane build_debug                       # Debug APK
fastlane build_release                     # Release APK
fastlane build_aab                         # AAB for Play Store
fastlane beta                              # Deploy to Firebase App Distribution
```

### Key Files

| Purpose | Location |
|---------|----------|
| App entry point (Android) | `app/src/main/java/com/futebadosparcas/ui/main/MainActivityCompose.kt` |
| Navigation graph & routes (Android) | `app/src/main/java/com/futebadosparcas/ui/navigation/AppNavGraph.kt` |
| App entry & navigation (iOS / CMP) | `composeApp/src/commonMain/kotlin/com/futebadosparcas/compose/App.kt` |
| Koin DI modules | `app/src/main/java/com/futebadosparcas/di/koin/` (14 Koin modules) |
| Theme/Colors | `app/src/main/java/com/futebadosparcas/ui/theme/Theme.kt` |
| Firestore rules | `firestore.rules` |
| Cloud Functions | `functions/src/index.ts` (main entry) |
| Spec templates | `specs/_TEMPLATE_FEATURE_MOBILE.md`, `_TEMPLATE_BUGFIX_MOBILE.md`, `_TEMPLATE_SCREEN_UI.md` |
| Mobile DoD checklist | `specs/_CHECKLIST_MOBILE_DOD.md` |
| Decision log | `specs/DECISIONS.md` |
| Modern UI components | `app/.../ui/components/modern/` (ShimmerLoading, ErrorState, etc.) |
| Shared KMP module | `shared/commonMain/` (cross-platform domain logic) |
| Project context (LLM) | `.claude/PROJECT_CONTEXT.md` (contexto consolidado para AIs) |
| Repo facts non-obvious | `AGENTS.md` (atalhos para agentes — Firebase setup, build quirks) |
| Quick start guide | `QUICK_START.md` |
| Contributing guide | `CONTRIBUTING.md` |
| Security policy | `SECURITY.md` |
| Changelog | `CHANGELOG.md` (release notes per version) |
| Backend REST API | 🗄️ **ARQUIVADO** `archive/backend/` (dormente, sem consumidor — decisão #1356) |
| iOS app scaffold | `iosApp/` (CocoaPods + `build_shared.sh`, see `iosApp/SETUP.md`) |
| Fastlane lanes | `fastlane/Fastfile` (test, build_debug, build_release, build_aab, beta) |
| Commit lint config | `commitlint.config.js` (Conventional Commits enforced) |
| Context generator | `context.yaml` (CTX config for LLM context bundles) |

### Repo Conventions (non-obvious)

- **Private repo** (`TechFernandesLTDA/futeba-dos-parcas`) — external collaborators need explicit access
- **Squash-merge only** on `master`. `delete_branch_on_merge: true`. **NEVER push direto a master**
- **Branch protection**: PR + 4 CI gates required; human/CODEOWNERS review is advisory (0 approvals required); no force-push or deletions
- **Conventional Commits enforced** via `commitlint.config.js` + Husky pre-commit hook
- **Node 22** required (see `.nvmrc`) — run `nvm use` before working in `web/` or `functions/`
- **Dependabot**: monthly schedule, limit 2 PRs, label `dependencies`. Auto-bumps closed — deps handled in batch via `npm audit fix`
- **Firebase Hosting URL**: `https://futebadosparcas.com.br` (SPA, all routes → `/index.html`)
- **Runners self-hosted (macOS + OCI Linux)**: `mac-futeba-1`, `mac-futeba-poller-1`, `mac-futeba-poller-2` e `oci-prod01-futeba`. Topologia em `docs/CI_RUNNERS.md`
- **Workflow shell injection**: NUNCA `echo '${{ secrets.X }}'` direto — use env vars + `printf '%s' "$VAR"`. Skill `futeba-gh-secrets` documents the pattern

---

## Project Overview

**Futeba dos Parças** is a multi-platform app (Android + iOS + Web) for managing amateur soccer groups ("peladas") with gamification.

### Domain Terminology

| Term | Meaning |
|------|---------|
| **Pelada** | Informal/amateur soccer match |
| **Grupo** | Group of players who play together regularly |
| **XP** | Experience points earned from games |
| **MVP** | Most Valuable Player (voted post-game) |
| **Streak** | Consecutive games attended |
| **Season** | Monthly competition period (resets on 1st) |
| **Dono do Jogo** | Game organizer/owner |
| **Bola Murcha** | Worst player (voted post-game, loses XP) |
| **Convocação** | Game invitation/summons |

### Tech Stack

- **Kotlin 2.4.21** with **Jetpack Compose** (Android) and **Compose Multiplatform 1.10.3** (`:composeApp` / iOS)
- **MVVM + Clean Architecture**
- **Koin 4.1.1** for DI (migrated from Hilt in CMP Phase 1)
- **Firebase** (Firestore, Auth, Storage, Cloud Functions v2, FCM, **App Check**)
- **Custom Claims** for role-based authorization (zero-cost JWT validation)
- **Room** for local cache
- **Coroutines & StateFlow** for async
- **Web App**: React 18 + TypeScript + Material UI 5 + Vite 8 + TanStack Query

### Version

- **Current versions**: Web 1.61.1, Android 1.42.0 (build 83), iOS 1.8.0 (build 24), Functions 1.15.1. Source of truth: `versions.json`.
- **SDK**: compileSdk 37, minSdk 24, targetSdk 36, JDK 21
- **Kotlin**: 2.4.21
- **AGP**: 9.4.1
- **Compose BOM**: 2025.09.01
- **Compose Multiplatform**: 1.10.3
- **KSP**: 2.3.12 (KSP2; Room 2.8.5)
- **Material 3**: Latest (adaptive navigation, pull-to-refresh)

---

## Architecture

### Module Structure

The project uses a multi-module setup:

- **`:app`** - Main Android application (Jetpack Compose UI, ViewModels, DI)
- **`:shared`** - Kotlin Multiplatform shared code (business logic, domain models, repository interfaces)
- **`:composeApp`** - Compose Multiplatform UI (shared UI components for Android/iOS)
- **`:baselineprofile`** - Baseline profiles for performance optimization
- **`web/`** - React web application (React 18 + TypeScript + MUI 5 + Vite 8)
- **`archive/backend/`** - 🗄️ ARQUIVADO/dormente: REST API Express + TypeORM + PostgreSQL sem nenhum consumidor (web/Android/iOS usam Firestore + Cloud Functions). Decisão #1356 (2026-05-19). Não tratar como produção.
- **`iosApp/`** - iOS app scaffold (CocoaPods, consumes KMP framework via `build_shared.sh`)
- **`functions/`** - Firebase Cloud Functions v2 (Node 22, TypeScript, Jest test suites)
- **`fastlane/`** - Android release automation (Firebase App Distribution beta + Play Store)

### Architecture Layers

```
UI (Compose Screens)
    ↓
ViewModels (Koin-injected + StateFlow<UiState>)
    ↓
Domain (Use Cases)
    ↓
Data (Repositories → Firebase/Room)
```

**Implementation Notes:**
- ViewModels and UI are in `:app` module (Android-specific)
- Repository interfaces and domain models can be in `:shared/commonMain` (KMP)
- Repository implementations split between `:shared/androidMain` (Firebase Android SDK) and `:app` (Koin-injected implementations)

### Where to Put New Code

| Code Type | Location |
|-----------|----------|
| New Compose screen | `app/src/main/java/com/futebadosparcas/ui/<feature>/<Feature>Screen.kt` |
| ViewModel | `app/src/main/java/com/futebadosparcas/ui/<feature>/<Feature>ViewModel.kt` |
| Repository interface | `shared/src/commonMain/kotlin/...` |
| Repository impl (Android) | `shared/src/androidMain/kotlin/...` or `app/src/main/java/.../data/repository/` |
| Repository impl (iOS) | `shared/src/iosMain/kotlin/...` |
| Use Cases | `app/src/main/java/com/futebadosparcas/domain/usecase/<feature>/` |
| DI modules (Koin) | `app/src/main/java/com/futebadosparcas/di/koin/` |
| Reusable UI components | `app/src/main/java/com/futebadosparcas/ui/components/` |
| Adaptive UI | `app/src/main/java/com/futebadosparcas/ui/adaptive/` |
| Cloud Function | `functions/src/` |
| Web page/component | `web/src/pages/<feature>/` or `web/src/components/` |

**KMP Structure:**
- `shared/src/commonMain/` - Cross-platform business logic, domain models, repository interfaces
- `shared/src/androidMain/` - Android-specific implementations (Firebase SDK usage)
- `shared/src/iosMain/` - iOS-specific implementations (Firebase iOS SDK)

### Navigation

- **Android (`:app`)**: single-activity architecture (`MainActivityCompose.kt`) with Compose Navigation.
  - **Nav graph & routes**: `app/src/main/java/com/futebadosparcas/ui/navigation/AppNavGraph.kt` (`sealed class Screen` + `AppNavGraph`)
  - Each screen receives its ViewModel via Koin (`koinViewModel()`)
  - Use `onNavigate: (destination: String) -> Unit` callbacks for navigation
- **iOS (`:composeApp` + `iosApp/`)**: Compose Multiplatform UI embedded via SwiftUI host (`composeApp/src/commonMain/kotlin/com/futebadosparcas/compose/App.kt`).

---

## Security & Performance (PERF_001)

### Custom Claims for Authorization

**IMPLEMENTED**: specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md

Firebase Custom Claims armazenam `role` no JWT token, eliminando 40% dos Firestore reads.

**Migration Status**: FASE 1 (Backward Compatible)
- ✅ Custom Claims setados em `onUserCreated` trigger
- ✅ Security Rules aceitam AMBOS: `request.auth.token.role` OU `getUserRole()` (Firestore)
- ⏳ FASE 2: Após 95% migração (2 semanas), remover fallback `getUserRole()`

**Cloud Functions**:
```typescript
// Setar role de um usuário (apenas ADMIN)
const setRole = httpsCallable(functions, 'setUserRole');
await setRole({ uid: 'user123', role: 'ADMIN' });

// Migração em massa (run once)
const migrate = httpsCallable(functions, 'migrateAllUsersToCustomClaims');
await migrate();
```

**Security Rules (Optimized)**:
```javascript
// ANTES (1 Firestore read):
function isAdmin() {
  return isAuthenticated() && getUserRole() == 'ADMIN';
}

// DEPOIS (0 reads):
function isAdmin() {
  return request.auth.token.role == 'ADMIN';
}
```

**Expected Impact**:
- Firestore reads: -40% (~20k reads/dia para 1k usuários)
- Latência: -20ms em operações autorizadas
- Custo: -$10-15/mês para 10k usuários

### App Check

**STATUS**: Implementado no cliente, permissive mode nas Cloud Functions.

**Cliente (Android)**:
```kotlin
// FutebaApplication.kt
FirebaseApp.initializeApp(this)
FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
    if (BuildConfig.DEBUG) DebugAppCheckProviderFactory.getInstance()
    else PlayIntegrityAppCheckProviderFactory.getInstance()
)
```

**Cloud Functions**:
```typescript
// Callable functions críticas (setUserRole, etc)
export const setUserRole = onCall({
    enforceAppCheck: true,  // TODO: Habilitar após 1 semana
    consumeAppCheckToken: true
}, async (request) => { ... });
```

**Rollout Plan**:
1. ✅ Semana 1: `enforceAppCheck: false` (monitorar métricas)
2. ⏳ Semana 2: `enforceAppCheck: true` (bloquear apps não-verificados)

---

## Common Gotchas

### Compose
- **NEVER** nest `LazyColumn` inside `LazyColumn` - use `FlowRow` instead
- Use `Icons.AutoMirrored.Filled.ArrowBack` (not `Icons.Default.ArrowBack`)
- `HorizontalDivider` replaces deprecated `Divider`
- `PullToRefreshBox` replaces deprecated `SwipeRefresh`

### Firestore
- `whereIn` queries limited to **10 items** - batch in chunks
- Always add composite indexes for multi-field queries
- Use `Source.CACHE` for offline-first reads

### ViewModels
- **ALWAYS** cancel previous `Job` before starting new Flow collection
- **ALWAYS** use `.catch {}` on Flow collections
- Store Job reference: `private var loadJob: Job? = null`

### Colors (Material 3)
- **NEVER** hardcode colors - use `MaterialTheme.colorScheme.*`
- Exception: Gamification colors (Gold, Silver, Bronze) with `ContrastHelper`

### Strings
- **ALWAYS** use `strings.xml` - no hardcoded strings

### Loading States (ShimmerLoading)
- **FOR LISTS** (LazyColumn/LazyRow): Use `LoadingState()` with shimmer effect
  ```kotlin
  is UiState.Loading -> LoadingState(shimmerCount = 8, itemType = LoadingItemType.CARD)
  ```
- **FOR ACTIONS** (Buttons, Dialogs): Use `CircularProgressIndicator()` (small, in-place)
- **NEVER** use `CircularProgressIndicator` for full-screen list loading - breaks perceived performance
- Available types: `CARD`, `GAME_CARD`, `PLAYER_CARD`, `RANKING_ITEM`, `LIST_ITEM`, `LOCATION_CARD`
- See: `app/src/main/java/com/futebadosparcas/ui/components/states/LoadingState.kt`

### Web App (React) — auditoria de bugs já encontrados

> Padrões descobertos por auditoria. **NÃO REPETIR**. Detalhes completos em `AGENTS.md`.

- **Firebase writes**: SEMPRE usar `serverTimestamp()` para `createdAt`/`updatedAt` (nunca `new Date()`); strip `id` e undefined fields antes de `setDoc`/`addDoc`
- **Hooks**: declarar todos os hooks (incluindo `useTheme`, `useToast`) ANTES de qualquer `if`/early return — quebrar regra dos Hooks gera bugs sutis
- **Theme**: usar tokens MUI (`theme.palette.*`); nunca hardcode `#000`/`#fff`/`Color.Black`. Cor de fundo de seção via `theme.palette.background.default`, não `paper`
- **Auth**: gates em rotas protegidas via `AuthGate` (já existe). Nunca verificar `currentUser` no componente da página — o gate cuida disso
- **Toast**: `useToast()` retorna `{ showToast }`; SEMPRE chamar via hook, nunca importar singleton
- **Estados obrigatórios** em toda tela: `loading`, `empty`, `error` + `success`. Componentes prontos em `web/src/components/states/`

---

## XP System Quick Reference

**Source of truth**: `shared/xp-constants.json` (consumido por functions, web, KMP).
**SECFIX #439**: tabela alinhada com JSON (era divergente).

| Action | XP |
|--------|-----|
| Participation | +10 |
| Goal | +25 |
| Assist | +20 |
| Save (GK) | +15 |
| Clean Sheet | +15 |
| Win | +30 |
| Draw | +10 |
| MVP | +50 |
| Bola Murcha (worst) | -10 |
| Streak 3 | +20 |
| Streak 5 | +35 |
| Streak 7 | +50 |
| Streak 10 | +100 |

**Anti-cheat caps**: GOALS=15, ASSISTS=10, SAVES=30, MAX_XP_PER_GAME=500, MIN_XP_PER_GAME=-100 por jogo.
**Season Reset**: Monthly on the 1st. Global XP never resets.

---

## Game States

```
SCHEDULED → CONFIRMED → LIVE → FINISHED
```

- `SCHEDULED`: Game created, awaiting player confirmations
- `CONFIRMED`: List closed, teams generated
- `LIVE`: Game in progress (events: goals, assists, saves, cards)
- `FINISHED`: Score final, MVP voting complete, XP processed

**Post-game flow**: FINISHED → MVP Vote → XP Processing → Badges/Level-ups

---

## Firebase Structure

### Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles and settings |
| `games` | Game events and match data |
| `groups` | Soccer groups ("peladas") |
| `statistics` | Player statistics per group |
| `season_participation` | League rankings per season |
| `seasons` | Active/past season metadata |
| `xp_logs` | XP transaction history |
| `user_badges` | Unlocked badges per user |
| `locations` | Soccer field locations with reviews |
| `cashbox` | Group financial tracking |
| `activities` | Activity feed entries |

### Cloud Functions (`functions/src/`)

**Core (root-level):**

| File | Purpose |
|------|---------|
| `index.ts` | Main entry, onUserCreate, onGameFinished, XP processing |
| `constants.ts` | Shared constants (XP values, limits, config) |
| `league.ts` | recalculateLeagueRating, division changes |
| `notifications.ts` | Push triggers (game created, MVP, level up, badges) |
| `reminders.ts` | Game reminders, waitlist cleanup |
| `activities.ts` | Activity feed processing |
| `user-management.ts` | User profile operations |
| `seeding.ts` | Data seeding utilities |

**Modular directories:**

| Directory | Files | Purpose |
|-----------|-------|---------|
| `auth/` | `custom-claims.ts` | Role management via Custom Claims (PERF_001) |
| `badges/` | `badge-helper.ts` | Badge unlock logic |
| `cache/` | `leaderboard-cache.ts` | Server-side leaderboard caching |
| `maintenance/` | `cleanup-old-logs.ts`, `compact-streaks.ts`, `keep-warm.ts`, `soft-delete.ts` | Scheduled maintenance tasks |
| `middleware/` | `rate-limiter.ts`, `secure-callable-wrapper.ts` | Security middleware (rate limiting, App Check) |
| `monitoring/` | `alerting.ts`, `collect-metrics.ts` | Alerting and metrics collection |
| `notifications/` | `batch-sender.ts` | Batch notification delivery |
| `season/` | `index.ts` | Season management, monthly resets |
| `storage/` | `generate-thumbnails.ts` | Image thumbnail generation |
| `utils/` | `retry-with-backoff.ts`, `soft-delete-helper.ts` | Shared utilities |
| `validation/` | `index.ts` | Input validation helpers |
| `voting/` | `mvp-voting.ts` | MVP/Bola Murcha voting logic |
| `xp/` | `processing.ts`, `parallel-processing.ts`, `migration-example.ts` | XP calculation and batch processing |
| `examples/` | `P0_SECURITY_EXAMPLES.ts` | Security pattern examples/reference |
| `scripts/` | `migrate-custom-claims.ts` | One-time migration scripts |

---

## Web App (React)

The web app lives in `web/` and was fully rewritten in React + TypeScript (PR #194, merged 2026-03).

### Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 18.3 (declared ^18.2.0) | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 8.3 | Build tool & dev server |
| MUI (Material UI) | 5.18 (declared ^5.15.6) | Component library |
| TanStack React Query | 5.105.0 | Server state management |
| React Router DOM | 7.18.5 | Routing |
| Firebase | 12.19 (declared ^12.12.1) | Backend services |
| Playwright | - | E2E testing |
| Vitest | - | Unit testing |

### Web Commands

```bash
cd web
npm install                    # Install deps
npm run dev                    # Dev server (port 5173)
npm run build                  # Production build
npm run preview                # Preview production build
npm run test                   # Unit tests (Vitest)
npx playwright test            # E2E tests
npm run lint                   # ESLint
```

### Web Structure

```
web/src/
├── components/               # Reusable UI components
├── contexts/                 # React contexts (Auth, Theme, Toast)
├── hooks/                    # Custom hooks (useGames, useGroups)
├── pages/                    # Page components by feature
│   ├── auth/                 # Login, Register, ForgotPassword
│   ├── home/                 # Home with tabs (Home, Games, Groups, Profile)
│   ├── game/                 # Game detail, create, live
│   ├── group/                # Group detail, edit, settings
│   └── ...                   # Other feature pages
├── services/                 # Firebase service, cloud functions
├── theme/                    # MUI theme configuration
├── types/                    # TypeScript type definitions
└── utils/                    # Utility functions
```

### Web Sizing & Layout (Epic #2581)

**NUNCA** usar `<Container maxWidth>` raw em páginas. O padrão canônico é `<PageContainer>` com tiers semânticos de `web/src/theme/pageTokens.ts`.

| Tier | maxWidth MUI | px aprox. | Usar em |
|---|---|---|---|
| `focused` | `xs` | ~444px | auth, onboarding, welcome (fluxos centrados, NÃO alargar) |
| `form` | `md` | ~900px | formulários de criação/edição |
| `list` | `lg` | ~1200px | listas |
| `detail` | `lg` | ~1200px | detalhe de 1 entidade |
| `dashboard` | `xl` | ~1536px | home, estatísticas, dashboards densos |

**Regras-chave**:
- Todo grid de múltiplos itens escala colunas `xs → md → lg → xl`
- Grid v2 (Unstable_Grid2 no MUI 5): `<Grid xs={12} md={6}>` (não `<Grid item>`)
- Padding via tokens `pageSpacing` do `pageTokens.ts` (nunca `py:2` ad-hoc)
- Tokens de `gridLayout.cards` / `gridLayout.cardsWide` para grids comuns
- `iconSizes`/`avatarSizes` de `iconSizes.ts` para ícones e avatares
- ESLint Rules 3 e 4 guardam contra container raw e maxWidth numérico
- Detalhes completos em `.claude/rules/web-react.md` → Pattern 3

---

## CMP Migration Status

Compose Multiplatform migration tracked in `specs/CMP_MULTIPLATFORM_MIGRATION.md`.

| Phase | Status | PR | Description |
|-------|--------|----|-------------|
| Phase 0 | ✅ COMPLETE | #159 | CMP 1.7.3→1.10.0, SQLDelight 2.2.1, wasmJs targets |
| Phase 1 | ✅ COMPLETE | #160 | Hilt → Koin 4.1.1 (14 modules) |
| Phase 2 | ✅ COMPLETE | #161 | GitLive Firebase SDK 2.4.0 migration (merged 2026-02-20) |
| Phase 3 | ⏳ PLANNED | - | Shared UI components in composeApp/ |
| Phase 4 | ⏳ PLANNED | - | iOS app launch via TestFlight |

**Key CMP decisions:**
- Koin 4.1.1 replaces Hilt (cross-platform DI)
- GitLive Firebase SDK for Android+iOS (no wasmJs support yet)
- `nativeAndAndroidMain` sourceset for shared Firebase code
- wasmJs target uses stubs until GitLive adds support

---

## GitHub Status

**Repo**: `TechFernandesLTDA/futeba-dos-parcas`

Para estado atual (PRs/issues abertos, último deploy, Dependabot alerts), use:

```bash
gh pr list --state open
gh issue list --state open
gh run list --workflow=deploy-production.yml --limit 5
```

Ou use a skill `/futeba-status` para snapshot completo (CI, runners, RAM, hosting).

### Pipelines em produção

| Pipeline | Como disparar |
|----------|---------------|
| Android Play Store (Internal Testing) | Workflow `deploy-production.yml` ou skill `/futeba-play-store` |
| Cloud Functions | `firebase deploy --only functions:<name>` (worktree isolado) ou skill `/futeba-deploy` |
| Firestore rules + indexes | `firebase deploy --only firestore` (worktree isolado) |
| Web hosting | `cd web && npm run build && firebase deploy --only hosting` |

### CI Known Behaviors (não fixar — comportamento esperado)

- **KMP Framework build**: falha em Linux runners (requer macOS) — **ignorar** ou rodar em self-hosted ARM
- **Notify Build Status**: depende do KMP Framework, falha em cascata em Linux — **ignorar**
- **CodeQL removido (07/10/2026)**: exige GitHub Advanced Security (pago) em repo privado. SAST = Semgrep (falha em ERROR), segredos = gitleaks CLI, Kotlin = Detekt. Sem upload de SARIF (artifact). Ver `docs/CI_RUNNERS.md`
- **Build iOS App**: `skipping` em PRs que não tocam `:shared` / `:composeApp` / `iosApp` — esperado
- **Runners self-hosted**: `mac-futeba-1`, `mac-futeba-poller-1`, `mac-futeba-poller-2` (macOS) e `oci-prod01-futeba` (Linux OCI) — ver `docs/CI_RUNNERS.md`

### CI/CD Workflows (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `android-ci.yml` | Push/PR | Build, lint, detekt, unit tests |
| `pr-check.yml` | PR | Quick PR validation |
| `functions-ci.yml` | Push/PR | Cloud Functions build + lint |
| `deploy-beta.yml` | Manual/Tag | Firebase App Distribution beta deploy |
| `deploy-production.yml` | Release | Google Play production deploy |
| `release.yml` | Tag | Create GitHub release |
| `version-bump.yml` | Manual | Bump version via script |
| `ios-build.yml` | Push/PR | Testes KMP compartilhados (Linux); framework/app iOS só com `IOS_MAC_RUNNER=true` |
| `semgrep.yml` | Schedule/PR | SAST (Semgrep), falha em ERROR |
| `secret-scan.yml` | Push/PR/Schedule | Segredos (gitleaks CLI) |
| `claude.yml` | Issue/PR | Claude Code AI assistance |
| `claude-code-review.yml` | PR | Automated code review via Claude |
| `pr-review-to-issues.yml` | PR review | Convert PR review comments to issues |
| `issue-automation.yml` | Issue events | Auto-label and triage issues |
| `sync-labels.yml` | Manual | Sync GitHub labels from config |

---

## Opus 4.6 Optimization

This project is optimized for Claude Opus 4.6 (released Feb 5, 2026).

### Key Opus 4.6 Capabilities Used

| Feature | How This Project Uses It |
|---------|--------------------------|
| **1M token context** (beta) | Entire codebase (`:app` + `:shared` + `functions/`) fits in context for cross-layer analysis |
| **128K output tokens** | Full-file generation for large screens, complete Cloud Function rewrites |
| **Adaptive thinking** | Default `high` effort for implementation; use `max` for security rule audits |
| **Context compaction** | Long sessions auto-summarize; CLAUDE.md + `.claude/rules/` survive compaction |
| **Agent teams** | Parallel work on Compose + Cloud Functions + Security Rules (see below) |

### Agent Teams (Research Preview)

Teammates load CLAUDE.md and `.claude/rules/` automatically. Each teammate is a full Claude Code instance with its own context window.

**Enable:**
```json
// .claude/settings.local.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**Best tasks for agent teams in this project:**

| Team Pattern | Teammates | Use When |
|-------------|-----------|----------|
| **Cross-layer feature** | Frontend (Compose) + Backend (Functions) + Security (Rules) | New feature touching all layers (e.g., new game type) |
| **KMP parallel** | `:shared/commonMain` + `:shared/androidMain` + `:shared/iosMain` | Adding shared domain models or repository interfaces |
| **Security audit** | Firestore rules + Cloud Functions middleware + Client validation | Pre-release security review |
| **Performance review** | Compose recompositions + Firestore queries + Cloud Functions | Performance optimization sprints |
| **Competing hypotheses** | 3-5 investigators testing different theories | Debugging hard-to-reproduce bugs |

**Example prompt for cross-layer feature:**
```
Create an agent team for the new "Game Templates" feature:
- Teammate 1 (Compose): Build UI screens at ui/templates/
- Teammate 2 (Functions): Build Cloud Functions at functions/src/templates/
- Teammate 3 (Rules): Update firestore.rules for templates collection
Require plan approval before implementation. Use Sonnet for each teammate.
```

**Project-specific guidance:**
- Each teammate auto-loads `.claude/rules/` for domain patterns
- **NEVER** let two teammates edit the same Screen/ViewModel pair simultaneously
- Use **delegate mode** (Shift+Tab) when orchestrating 3+ module changes - prevents lead from implementing directly
- Use Shift+Up/Down to select and message individual teammates
- Keep 5-6 tasks per teammate for optimal throughput
- Start with research/review teams before attempting parallel implementation
- See `.claude/rules/agent-teams.md` for detailed team patterns

---

## Working with This Codebase Efficiently

### context-mode (large outputs)

Para comandos com output > 20 linhas (gradle builds, jest, gh api, git log, find), use `mcp__plugin_context-mode_context-mode__ctx_batch_execute` em vez de Bash bruto. Bash fica reservado para `git`, `mkdir`, `rm`, `mv`, navegação. Knowledge base persiste após `/clear` ou `/compact`.

### Skills disponíveis (slash commands)

| Skill | Quando invocar |
|-------|----------------|
| `/futeba-pr-flow` | Sempre que precisar persistir mudanças (branch + commit + PR + admin merge) |
| `/futeba-deploy` | Deploy Firebase (Functions, Hosting, Rules, Storage, Remote Config) |
| `/futeba-play-store` | **Deploy Android pro Play Store** (build + sign + upload Internal Testing) |
| `/futeba-gh-secrets` | Setar GH Secrets corretamente (workarounds `$digit`, paths, JSON multi-line) |
| `/futeba-fullstack-feature` | Pattern feature full-stack (rules + function + web + android) |
| `/futeba-status` | Snapshot saúde projeto (CI, runners, RAM, hosting, PRs) |
| `/futeba-ci-triage` | CI vermelho — diagnostica + propõe fix |
| `/futeba-runner` | Self-hosted runners macOS (start/stop/scale) |
| `/futeba-emulators` | Firestore/Auth/Storage/Functions emulators local |
| `/futeba-test-fix` | Testes falhando (Android/Functions/Web) |
| `/futeba-deps` | Triagem Dependabot + lockfile bumps |
| `/futeba-firestore-rules` | Editar/deploy security rules + indexes |
| `/futeba-merge-train` | 3+ PRs do mesmo escopo ou stack/dependências |
| `/futeba-rollback` | Reverter deploy prod / commit master |
| `/futeba-spec` | Criar spec antes de feature/bugfix (Regra #1 SDD) |
| `/futeba-xp-validate` | Validar integridade XP system |
| `/futeba-kmp-build` | Build shared module + iOS Framework |
| `/futeba-ollama` | Semantic search / code review local privacy-sensitive |

---

## Detailed Patterns

For in-depth guidance, see `.claude/rules/`:

| File | Content |
|------|---------|
| `compose-patterns.md` | Compose structure, performance, state |
| `material3-compose-reference.md` | Complete M3 color/typography guide |
| `viewmodel-patterns.md` | StateFlow, Job tracking, error handling |
| `firestore.md` | Collections, queries, caching, listeners |
| `kotlin-style.md` | Naming, null safety, coroutines |
| `testing.md` | Test structure, mocking, commands |
| `security.md` | Secrets, encryption, Firestore rules |
| `agent-teams.md` | Agent team patterns, file ownership, prompts |

---

## Critical Rules Summary

1. **Spec-Driven Development** - NEVER implement features without approved spec
2. **All new screens use Compose** - No new XML layouts
3. **StateFlow over LiveData** - Always use `StateFlow<UiState>`
4. **Cancel jobs** - Always cancel previous Flow jobs before starting new ones
5. **No hardcoded colors** - Use `MaterialTheme.colorScheme.*`
6. **No hardcoded strings** - Use `strings.xml`
7. **Comments in Portuguese (PT-BR)**
8. **Verify builds compile** before marking tasks complete
9. **KMP-first** - Shared business logic goes in `shared/commonMain`, platform-specific code in `androidMain/iosMain`

---

## Scripts

Located in `/scripts/` (~70 scripts). Run with: `node scripts/<script_name>.js`

**Key scripts (most commonly used):**

| Script | Purpose |
|--------|---------|
| `bump-version.js` | Version bumping for releases |
| `migrate_firestore.js` | Firestore data migration utilities |
| `reset_firestore.js` | Reset Firestore collections (dev only) |
| `automate_seasons.js` | Season management automation |
| `analyze_firebase_data.js` | Analyze Firebase data patterns |
| `promote_to_admin.js` | Promote user to ADMIN role |
| `run-migration-custom-claims.js` | Run Custom Claims migration |
| `verify-custom-claims.js` | Verify Custom Claims migration status |

**Quality audits** (bash scripts):
- `audit-hardcoded-strings.sh` - Find hardcoded strings in code
- `audit-content-descriptions.sh` - Check accessibility compliance
- `audit-unused-resources.sh` - Detect unused Android resources
- `audit-code-complexity.sh` - Analyze code complexity
- `validate_all.sh` / `validate-optimizations.sh` - Run full validation suite

---

## Firebase Hosting

Public pages deployed at `https://futebadosparcas.com.br/`:

| Page | Purpose |
|------|---------|
| `index.html` | Landing page with links |
| `privacy_policy.html` | Privacy Policy |
| `terms_of_service.html` | Terms of Service |
| `delete_account.html` | Account deletion instructions |
| `child_safety.html` | Child safety standards |

Deploy: `firebase deploy --only hosting`

---

## Permissions Notes

- **Location**: Uses `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` for check-in and nearby fields
- **Background Location**: Removed in v1.7.2 (not implemented). Future feature planned in `specs/ROADMAP_BACKGROUND_LOCATION.md`

---

## Official References

- **[android/compose-samples](https://github.com/android/compose-samples)** - Official Google examples
- **[Material Design 3](https://m3.material.io/)** - Guidelines
- **[Material Theme Builder](https://material-foundation.github.io/material-theme-builder/)** - Theme generator
