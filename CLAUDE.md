# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Spec-Driven Development (SDD)

As regras abaixo valem para todo trabalho no repositório.

### Regra #1: Spec quando a mudança é de produto, dados ou fluxo

Pede spec em `/specs/`, com status `APPROVED` antes de escrever código:
- Funcionalidade nova
- Mudança de dados: modelo ou campos no Firestore, `firestore.rules`, índices, contratos de Cloud Functions, XP e rankings
- Mudança de fluxo: o caminho do usuário, permissões, navegação, login, compra
- Correção que muda dados, regras ou fluxo (por exemplo, permissões, ID do documento, formato de convite): usa o template de bugfix

Não pede spec: correção que não muda dados nem fluxo, ajuste visual, texto, manutenção (dependências, CI, refactor, testes, docs, release). Basta o PR explicar o que mudou e por quê.

Templates: `_TEMPLATE_FEATURE_MOBILE.md`, `_TEMPLATE_BUGFIX_MOBILE.md`, `_TEMPLATE_SCREEN_UI.md`. Na dúvida, escreva a spec: ela custa menos que desfazer uma mudança de dados em produção.

### Regra #2: Fases de uma spec

```
REQUIREMENTS → UX/UI → TECHNICAL DESIGN → TASKS → IMPLEMENTATION → VERIFY
```

Quando a mudança tem spec, siga as fases nessa ordem: cada uma pega um tipo de erro antes de ele virar código.

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
# O app iOS linka só o ComposeApp.framework, que embute o :shared
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
npx jest --no-coverage                     # All tests (functions/test/**/*.test.ts)
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

# iOS App (XcodeGen + CocoaPods + KMP framework consumer)
cd iosApp && ./build_shared.sh             # Build ComposeApp.framework first
cd iosApp && xcodegen generate             # Generate .xcodeproj from project.yml (before pod install)
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
| Koin DI modules | `app/src/main/java/com/futebadosparcas/di/koin/` (aggregated in `KoinModules.kt`) |
| Theme/Colors | `app/src/main/java/com/futebadosparcas/ui/theme/Theme.kt` |
| Firestore rules | `firestore.rules` |
| Cloud Functions | `functions/src/index.ts` (main entry) |
| Spec templates | `specs/_TEMPLATE_FEATURE_MOBILE.md`, `_TEMPLATE_BUGFIX_MOBILE.md`, `_TEMPLATE_SCREEN_UI.md` |
| Mobile DoD checklist | `specs/_CHECKLIST_MOBILE_DOD.md` |
| Decision log | `specs/DECISIONS.md` |
| Modern UI components | `app/.../ui/components/modern/` (ShimmerLoading, ErrorState, etc.) |
| Shared KMP module | `shared/src/commonMain/` (cross-platform domain logic) |
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
- **Conventional Commits enforced** via `commitlint.config.js` + Husky `commit-msg` hook
- **Node 22** required (see `mise.toml` / `.nvmrc`) — run `mise install` before working in `web/` or `functions/`
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
- **Koin 4.1.1** for DI (Hilt is not used)
- **Firebase** (Firestore, Auth, Storage, Cloud Functions v2, FCM, **App Check**)
- **Custom Claims** for role-based authorization (zero-cost JWT validation)
- **Room** for local cache
- **Coroutines & StateFlow** for async
- **Web App**: React 18 + TypeScript + Material UI 5 + Vite 8 + TanStack Query

### Version

- **App versions** (Web, Android, iOS, Functions): read `versions.json` (single source of truth, updated by `scripts/bump-version.js`).
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

Spec: `specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md`.

O `role` do usuário fica no JWT (Firebase Custom Claims), e as Security Rules leem só o claim (`isAdmin()`, `isFieldOwner()` usam `request.auth.token.role`), sem ler o Firestore. Não há fallback para `getUserRole()`: sem o claim, o usuário não passa em `isAdmin()` nem em `isFieldOwner()`.

**Cloud Functions** (`functions/src/auth/custom-claims.ts`):
```typescript
// Setar role de um usuário (apenas ADMIN)
const setRole = httpsCallable(functions, 'setUserRole');
await setRole({ uid: 'user123', role: 'ADMIN' });

// Migração em massa (run once)
const migrate = httpsCallable(functions, 'migrateAllUsersToCustomClaims');
await migrate();
```

### App Check

- **Cliente (Android)**: `FutebaApplication.kt` instala `AppCheckProviders.factory()`; o provider vem do source set da variante (debug usa o token de debug; release/benchmark usam Play Integrity, em `src/nonDebug`).
- **Cloud Functions**: callables criadas com `secureCallable` (`functions/src/middleware/secure-callable-wrapper.ts`) exigem App Check por padrão (`enforceAppCheck` e `consumeAppCheckToken` ligados fora do emulador); as que usam `onCall` direto declaram `enforceAppCheck` nas próprias opções.

---

## Common Gotchas

### Compose
- Don't nest `LazyColumn` inside `LazyColumn` - use `FlowRow` instead
- Use `Icons.AutoMirrored.Filled.ArrowBack` (not `Icons.Default.ArrowBack`)
- `HorizontalDivider` replaces deprecated `Divider`
- `PullToRefreshBox` replaces deprecated `SwipeRefresh`

### Firestore
- `whereIn` queries limited to **10 items** - batch in chunks
- Always add composite indexes for multi-field queries
- Use `Source.CACHE` for offline-first reads

### ViewModels
- Cancel the previous `Job` before starting a new Flow collection
- Use `.catch {}` on Flow collections
- Store Job reference: `private var loadJob: Job? = null`

### Colors (Material 3)
- Don't hardcode colors - use `MaterialTheme.colorScheme.*`
- Exception: Gamification colors (Gold, Silver, Bronze) with `ContrastHelper`

### Strings
- Use `strings.xml` - no hardcoded strings

### Loading States (ShimmerLoading)
- **FOR LISTS** (LazyColumn/LazyRow): Use `LoadingState()` with shimmer effect
  ```kotlin
  is UiState.Loading -> LoadingState(shimmerCount = 8, itemType = LoadingItemType.CARD)
  ```
- **FOR ACTIONS** (Buttons, Dialogs): Use `CircularProgressIndicator()` (small, in-place)
- Don't use `CircularProgressIndicator` for full-screen list loading - it breaks perceived performance
- Available types: `CARD`, `GAME_CARD`, `PLAYER_CARD`, `RANKING_ITEM`, `LIST_ITEM`, `LOCATION_CARD`
- See: `app/src/main/java/com/futebadosparcas/ui/components/states/LoadingState.kt`

### Web App (React) — auditoria de bugs já encontrados

> Padrões descobertos por auditoria de bugs. Detalhes completos em `AGENTS.md`.

- **Firebase writes**: usar `serverTimestamp()` para `createdAt`/`updatedAt` (nunca `new Date()`); strip `id` e undefined fields antes de `setDoc`/`addDoc`
- **Hooks**: declarar todos os hooks (incluindo `useTheme`, `useToast`) ANTES de qualquer `if`/early return — quebrar regra dos Hooks gera bugs sutis
- **Theme**: usar tokens MUI (`theme.palette.*`); nunca hardcode `#000`/`#fff`/`Color.Black`. Cor de fundo de seção via `theme.palette.background.default`, não `paper`
- **Auth**: rotas protegidas passam por `ProtectedRoute` (`web/src/App.tsx`). Não verificar `currentUser` no componente da página — a rota cuida disso
- **Toast**: `useToast()` (`web/src/contexts/ToastContext.tsx`) retorna `showToast`, `showSuccess`, `showError` e afins; chamar sempre via hook, nunca importar singleton
- **Estados obrigatórios** em toda tela: `loading`, `empty`, `error` + `success`. Componentes prontos em `web/src/components/common/` (`LoadingState`, `EmptyState`, `ErrorState`)

---

## XP System Quick Reference

**Source of truth**: `shared/xp-constants.json` (consumido por functions, web, KMP). Valores padrão; grupos podem sobrescrever, e os bônus extras (performance, comportamento, retenção) estão só no JSON.

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
SCHEDULED → CONFIRMED → LIVE → FINISHED      (+ CANCELLED)
```

- `SCHEDULED`: Game created, awaiting player confirmations
- `CONFIRMED`: List closed, teams generated
- `LIVE`: Game in progress (events: goals, assists, saves, cards)
- `FINISHED`: Score final, MVP voting complete, XP processed
- `CANCELLED`: Game cancelled

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

`index.ts` is the export registry: every deployed function is defined there (`onGameStatusUpdate`, `recalculateLeagueRating`, `onGameDeleted`, ...) or re-exported from a module. Read its exports to find a function.

| Location | Purpose |
|----------|---------|
| `index.ts` | Main entry and export registry; game status trigger (`onGameStatusUpdate`) |
| `constants.ts` | Shared constants (XP values, limits, config) |
| `league.ts`, `group-league.ts` | League rating, division changes, group leagues |
| `notifications.ts`, `reminders.ts`, `activities.ts` | Push triggers, game reminders, activity feed |
| `xp/` | XP pipeline (`pipeline.ts`, `on-game-status-update.ts`, `streaks.ts`, ...); see `xp/README.md` |
| `auth/` | Custom Claims (`custom-claims.ts`), account merge/cleanup/deletion, data export |
| `middleware/` | `secure-callable-wrapper.ts` (App Check, rate limit, auth, audit log), `rate-limiter.ts` |
| `games/`, `groups/`, `voting/`, `season/`, `badges/` | Game, group, MVP/Bola Murcha voting, season and badge logic |
| `maintenance/`, `monitoring/`, `storage/` | Scheduled cleanup, metrics/alerting, thumbnails |
| `scripts/` | One-time migration scripts |

---

## Web App (React)

The web app lives in `web/` (React + TypeScript).

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

Não usar `<Container maxWidth>` raw em páginas. O padrão canônico é `<PageContainer>` com tiers semânticos de `web/src/theme/pageTokens.ts`.

| Tier | maxWidth MUI | px aprox. | Usar em |
|---|---|---|---|
| `focused` | `xs` | ~444px | auth, onboarding, welcome (fluxos centrados, não alargar) |
| `form` | `md` | ~900px | formulários de criação/edição |
| `list` | `xl` | 1320px (lg) / 1500px (xl) | listas |
| `detail` | `xl` | 1320px (lg) / 1500px (xl) | detalhe de 1 entidade |
| `dashboard` | `xl` | 1320px (lg) / 1500px (xl) | home, estatísticas, dashboards densos |

Os tiers largos (`list`, `detail`, `dashboard`) usam `xl` do MUI, limitado pelo `PageContainer` (`web/src/components/common/PageContainer.tsx`).

**Regras-chave**:
- Todo grid de múltiplos itens escala colunas `xs → md → lg → xl`
- Grid v2 (Unstable_Grid2 no MUI 5): `<Grid xs={12} md={6}>` (não `<Grid item>`)
- Padding via tokens `pageSpacing` do `pageTokens.ts` (nunca `py:2` ad-hoc)
- Tokens de `gridLayout.cards` / `gridLayout.cardsWide` para grids comuns
- `iconSizes`/`avatarSizes` de `iconSizes.ts` para ícones e avatares
- Nenhum lint barra container raw nem maxWidth numérico hoje: as Rules 3 e 4 estão desligadas em `web/.eslintrc.cjs` (o comentário lá diz como religar), então a revisão é quem pega
- Detalhes completos em `.claude/rules/web-react.md` → Pattern 3

---

## CMP Migration Status

Compose Multiplatform migration status and remaining phases: `specs/CMP_MULTIPLATFORM_MIGRATION.md`. The iOS app is already published, built from `:composeApp` (manual TestFlight pipeline `ios-testflight.yml`; process in `docs/RELEASE_PROCESS.md`).

**Key CMP decisions:**
- Koin (cross-platform DI) — Hilt is not used
- GitLive Firebase SDK (`dev.gitlive:firebase-*`) for Android+iOS, in the `nativeAndAndroidMain` sourceset of `:shared`
- SQLDelight in `:shared`
- No wasmJs/web target in the KMP modules: the web app is the separate React app in `web/`

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

- **Build ComposeApp Framework / Build iOS App** (`ios-build.yml`): só rodam com `IOS_MAC_RUNNER=true`, no Mac self-hosted; sem isso ficam `skipped` e só os testes KMP compartilhados rodam — esperado
- **Notify Build Status** (`ios-build.yml`): falha quando os testes KMP falham (e, com o Mac ligado, quando o framework ou o app iOS falham) — é falha real, não ignorar
- **Sem CodeQL**: exige GitHub Advanced Security (pago) em repo privado. SAST = Semgrep (falha em ERROR), segredos = gitleaks CLI, Kotlin = Detekt. Sem upload de SARIF (artifact). Ver `docs/CI_RUNNERS.md`
- **Build iOS App**: `skipping` em PRs que não tocam `:shared` / `:composeApp` / `iosApp` — esperado
- **Runners self-hosted**: `mac-futeba-1`, `mac-futeba-poller-1`, `mac-futeba-poller-2` (macOS) e `oci-prod01-futeba` (Linux OCI) — ver `docs/CI_RUNNERS.md`

### CI/CD Workflows (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `android-ci.yml` | Push/PR | Build, lint, detekt, unit tests |
| `pr-check.yml` | PR | Quick PR validation |
| `functions-ci.yml` | Push/PR | Cloud Functions build + lint |
| `deploy-beta.yml` | Manual/Tag | Firebase App Distribution beta deploy |
| `deploy-production.yml` | Tag `android-v*.*.*` / Manual | Build + sign AAB and upload to the Google Play `internal` track |
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

## Agent Teams

Padrões de time (divisão por camada, posse de arquivos, prompts): `.claude/rules/agent-teams.md`. Dois teammates não editam o mesmo par Screen/ViewModel ao mesmo tempo, porque isso gera conflito de merge.

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
| `/futeba-spec` | Criar spec para funcionalidade nova ou mudança de dados/fluxo (Regra #1 SDD) |
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

1. **Spec-Driven Development** - Funcionalidade nova e mudança de dados ou fluxo só com spec aprovada (Regra #1); correção, ajuste visual e manutenção sem spec
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

Located in `/scripts/` (Node, TypeScript and shell; subfolders `deploy/`, `migrations/`, `maintenance/`, `ci/`, ...). Each script documents its usage in its header comment.

| Script | Purpose |
|--------|---------|
| `bump-version.js` | Version bump per platform: `node scripts/bump-version.js <android\|web\|ios\|functions> [major\|minor\|patch]` (updates `versions.json`) |
| `release-notes.js` | Release notes pipeline (CHANGELOG, fallback bundle, Firestore publish) |
| `validate-pre-push.sh` | Checks run by the Husky `pre-push` hook |
| `check-*-parity.js` | Parity checks between platforms (badges, design tokens, verification grace) |
| `deploy/build-web-hosting.js` | Hosting `predeploy` (builds `web/dist`) |

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
