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

**Note:** Commands work on Windows (Git Bash/PowerShell), macOS, and Linux. Use `./gradlew` on Unix-like systems or `gradlew.bat` on Windows CMD.

```bash
# Build (Android)
./gradlew assembleDebug                    # Build debug APK
./gradlew installDebug                     # Install on device
./gradlew compileDebugKotlin               # Fast compile check (use this often!)

# Build (KMP - iOS Framework) - Requires macOS
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64  # iOS Simulator (M1/M2 Mac)
./gradlew :shared:linkDebugFrameworkIosArm64           # iOS Device

# Tests
./gradlew :app:testDebugUnitTest           # Unit tests
./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.YourTestClass"  # Single class
./gradlew :app:testDebugUnitTest --tests "*.YourTestClass.testMethod"         # Single method
./gradlew connectedDebugAndroidTest        # Instrumented tests (device required)

# Quality
./gradlew lint                             # Lint check
./gradlew detekt                           # Static analysis (Detekt)
./gradlew clean                            # Clean build

# Cloud Functions (in /functions directory, Node 20)
cd functions && npm install                # Install deps
npm run build                              # Compile TypeScript
npm run lint                               # ESLint (same as CI)
npx jest --no-coverage                     # All tests (398 tests, 12 suites)
npx jest path/to/file.test.ts              # Single test file
npx jest --testNamePattern="test name"     # Single test by name
firebase emulators:start                   # Local testing
firebase deploy --only functions           # Deploy

# NOTE: New test files that use callable functions need:
# jest.mock("../src/middleware/rate-limiter")
# See functions/test/ for 12 existing test suites
```

### Key Files

| Purpose | Location |
|---------|----------|
| App entry point | `app/src/main/java/com/futebadosparcas/ui/main/MainActivityCompose.kt` |
| Navigation graph | `app/src/main/java/com/futebadosparcas/ui/navigation/AppNavGraph.kt` |
| Nav destinations | `app/src/main/java/com/futebadosparcas/ui/navigation/NavDestinations.kt` + `routes/AppRoutes.kt` |
| Hilt DI setup | `app/src/main/java/com/futebadosparcas/di/` (FirebaseModule, RepositoryModule, etc.) |
| Theme/Colors | `app/src/main/java/com/futebadosparcas/ui/theme/Theme.kt` |
| Firestore rules | `firestore.rules` |
| Cloud Functions | `functions/src/index.ts` (main entry) |
| Spec templates | `specs/_TEMPLATE_FEATURE_MOBILE.md`, `_TEMPLATE_BUGFIX_MOBILE.md`, `_TEMPLATE_SCREEN_UI.md` |
| Mobile DoD checklist | `specs/_CHECKLIST_MOBILE_DOD.md` |
| Decision log | `specs/DECISIONS.md` |
| Modern UI components | `app/.../ui/components/modern/` (ShimmerLoading, ErrorState, etc.) |
| Shared KMP module | `shared/commonMain/` (cross-platform domain logic) |
| Project context (LLM) | `.claude/PROJECT_CONTEXT.md` (contexto consolidado para AIs) |

---

## Project Overview

**Futeba dos Parças** is an Android app for managing amateur soccer groups ("peladas") with gamification.

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

- **Kotlin 2.0+** with **Jetpack Compose** (all new screens)
- **MVVM + Clean Architecture**
- **Hilt** for DI
- **Firebase** (Firestore, Auth, Storage, Cloud Functions v2, FCM, **App Check**)
- **Custom Claims** for role-based authorization (zero-cost JWT validation)
- **Room** for local cache
- **Coroutines & StateFlow** for async

### Version

- **Current**: 1.10.5 (versionCode: 28)
- **SDK**: compileSdk 36, minSdk 24, targetSdk 35, JDK 17
- **Kotlin**: 2.2.10
- **Compose BOM**: 2024.09.00
- **Compose Multiplatform**: 1.7.3
- **Material 3**: Latest (adaptive navigation, pull-to-refresh)

---

## Architecture

### Module Structure

The project uses a multi-module setup:

- **`:app`** - Main Android application (Jetpack Compose UI, ViewModels, DI)
- **`:shared`** - Kotlin Multiplatform shared code (business logic, domain models, repository interfaces)
- **`:composeApp`** - Compose Multiplatform UI (shared UI components for Android/iOS)
- **`:baselineprofile`** - Baseline profiles for performance optimization
- **`backend/`** - REST API + WebSocket server (Express.js + TypeORM + PostgreSQL) - separate from Cloud Functions

### Architecture Layers

```
UI (Compose Screens)
    ↓
ViewModels (@HiltViewModel + StateFlow<UiState>)
    ↓
Domain (Use Cases)
    ↓
Data (Repositories → Firebase/Room)
```

**Implementation Notes:**
- ViewModels and UI are in `:app` module (Android-specific)
- Repository interfaces and domain models can be in `:shared/commonMain` (KMP)
- Repository implementations split between `:shared/androidMain` (Firebase Android SDK) and `:app` (Hilt-injected implementations)

### Where to Put New Code

| Code Type | Location |
|-----------|----------|
| New Compose screen | `app/src/main/java/com/futebadosparcas/ui/<feature>/<Feature>Screen.kt` |
| ViewModel | `app/src/main/java/com/futebadosparcas/ui/<feature>/<Feature>ViewModel.kt` |
| Repository interface | `shared/src/commonMain/kotlin/...` |
| Repository impl (Android) | `shared/src/androidMain/kotlin/...` or `app/src/main/java/.../data/repository/` |
| Repository impl (iOS) | `shared/src/iosMain/kotlin/...` |
| Use Cases | `app/src/main/java/com/futebadosparcas/domain/usecase/<feature>/` |
| DI modules | `app/src/main/java/com/futebadosparcas/di/` |
| Reusable UI components | `app/src/main/java/com/futebadosparcas/ui/components/` |
| Adaptive UI | `app/src/main/java/com/futebadosparcas/ui/adaptive/` |
| Cloud Function | `functions/src/` |

**KMP Structure:**
- `shared/src/commonMain/` - Cross-platform business logic, domain models, repository interfaces
- `shared/src/androidMain/` - Android-specific implementations (Firebase SDK usage)
- `shared/src/iosMain/` - iOS-specific implementations (Firebase iOS SDK)

### Navigation

The app uses a single-activity architecture with Compose Navigation:
- `MainActivityCompose.kt` hosts the nav graph
- **Route definitions**: `NavDestinations.kt` (sealed class, core routes) + `routes/AppRoutes.kt` (extended metadata: `isRootDestination`, `showsTopBar`, `titleResId`)
- **Nav graph**: `AppNavGraph.kt` (NOT `AppNavigation.kt`)
- Each screen receives its ViewModel via Hilt (`hiltViewModel()`)
- Use `onNavigate: (destination: String) -> Unit` callbacks for navigation

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

---

## XP System Quick Reference

| Action | XP |
|--------|-----|
| Participation | +10 |
| Goal | +5 |
| Assist | +3 |
| Save (GK) | +2 |
| MVP | +50 |
| Win | +20 |
| Streak 3+ | +10 |
| Streak 7+ | +20 |
| Streak 10+ | +30 |

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

## GitHub Status

**Repo**: `TechFernandesLTDA/futeba-dos-parcas`
**Issues abertas**: 0
**PRs abertos**: Dependabot (deps bumps) + feature branches
**Branches remotos**: ~64

### CI Known Behaviors

- **KMP Framework build**: Sempre falha em Linux runners (requer macOS) - **ignorar**
- **Notify Build Status**: Depende do KMP Framework - falha em cascata - **ignorar**
- **CodeQL**: Pode falhar por timeout em PRs grandes - re-run manual resolve
- **Build iOS App**: `skipping` em PRs que não tocam `:shared` - esperado

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
| `ios-build.yml` | Push/PR | KMP iOS framework build (macOS runner) |
| `codeql.yml` | Schedule/PR | Security vulnerability scanning |
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

Public pages deployed at `https://futebadosparcas.web.app/`:

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
