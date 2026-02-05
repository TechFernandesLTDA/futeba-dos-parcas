# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ SPEC-DRIVEN DEVELOPMENT (SDD) - REGRAS OBRIGATÓRIAS

> **LEIA ISTO PRIMEIRO.** Estas regras são inegociáveis.

### Regra #1: NUNCA implementar sem SPEC aprovada

- Toda feature ou bugfix DEVE ter uma spec em `/specs/` **antes** de escrever código
- Copie o template apropriado: `_TEMPLATE_FEATURE_MOBILE.md`, `_TEMPLATE_BUGFIX_MOBILE.md`, ou `_TEMPLATE_SCREEN_UI.md`
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

**Windows Note:** Tests use JUnit 5 (Jupiter) and are configured to run with `workingDir = C:/TEMP` to avoid path encoding issues with special characters (ç, etc.).

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

# Cloud Functions (in /functions directory)
cd functions && npm install                # Install deps
npm run build                              # Compile TypeScript
firebase emulators:start                   # Local testing
firebase deploy --only functions           # Deploy
```

### Key Files

| Purpose | Location |
|---------|----------|
| App entry point | `app/src/main/java/com/futebadosparcas/ui/main/MainActivityCompose.kt` |
| Navigation graph | `app/src/main/java/com/futebadosparcas/ui/navigation/AppNavigation.kt` |
| Nav destinations | `app/src/main/java/com/futebadosparcas/ui/navigation/NavDestinations.kt` |
| Hilt DI setup | `app/src/main/java/com/futebadosparcas/di/` (FirebaseModule, RepositoryModule, etc.) |
| Theme/Colors | `app/src/main/java/com/futebadosparcas/ui/theme/Theme.kt` |
| Firestore rules | `firestore.rules` |
| Cloud Functions | `functions/src/index.ts` (main entry) |
| Spec templates | `specs/_TEMPLATE_*.md` (Feature, Bugfix, Screen UI) |
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

- **Current**: 1.9.0 (versionCode: 22)
- **SDK**: minSdk 24, targetSdk 35, compileSdk 36, JDK 17
- **Kotlin**: 2.2.10
- **Compose BOM**: 2024.09.00
- **Material 3**: Latest (adaptive navigation, pull-to-refresh)

---

## Architecture

### Module Structure

The project uses a multi-module setup:

- **`:app`** - Main Android application (Jetpack Compose UI, ViewModels, DI)
- **`:shared`** - Kotlin Multiplatform shared code (business logic, domain models, repository interfaces)
- **`:composeApp`** - Compose Multiplatform UI (shared UI components for Android/iOS)
- **`:baselineprofile`** - Baseline profiles for performance optimization

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
- `MainActivityCompose.kt` hosts `AppNavigation`
- Routes defined as sealed classes in `NavDestinations.kt`
- Navigation graph implemented in `AppNavigation.kt`
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

| File | Purpose |
|------|---------|
| `index.ts` | Main entry, onUserCreate, onGameFinished, XP processing |
| `auth/custom-claims.ts` | **NEW:** Role management via Custom Claims (PERF_001) |
| `league.ts` | recalculateLeagueRating, division changes |
| `notifications.ts` | Push triggers (game created, MVP, level up, badges) |
| `reminders.ts` | Game reminders, waitlist cleanup |
| `activities.ts` | Activity feed processing |
| `badges/badge-helper.ts` | Badge unlock logic |
| `season/index.ts` | Season management, monthly resets |
| `user-management.ts` | User profile operations |
| `seeding.ts` | Data seeding utilities |
| `validation/index.ts` | Input validation helpers |
| `scripts/migrate-custom-claims.ts` | Migration script for Custom Claims (run once) |

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

Located in `/scripts/`. Run with: `node scripts/<script_name>.js`

| Script | Purpose |
|--------|---------|
| `migrate_firestore.js` | Firestore data migration utilities |
| `reset_firestore.js` | Reset Firestore collections (dev only) |
| `automate_seasons.js` | Season management automation |
| `bump-version.js` | Version bumping for releases |
| `analyze_firebase_data.js` | Analyze Firebase data patterns |
| `add_id_field_to_users.js` | Migration: add missing user IDs |

**Quality audits** (bash scripts):
- `audit-hardcoded-strings.sh` - Find hardcoded strings in code
- `audit-content-descriptions.sh` - Check accessibility compliance
- `audit-unused-resources.sh` - Detect unused Android resources

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
