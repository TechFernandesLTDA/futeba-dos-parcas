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

```bash
# Build
./gradlew assembleDebug                    # Build debug APK
./gradlew installDebug                     # Install on device
./gradlew compileDebugKotlin               # Fast compile check (use this often!)

# Tests
./gradlew :app:testDebugUnitTest           # Unit tests
./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.YourTestClass"  # Single class
./gradlew :app:testDebugUnitTest --tests "*.YourTestClass.testMethod"         # Single method
./gradlew connectedDebugAndroidTest        # Instrumented tests (device required)

# Quality
./gradlew lint                             # Lint check
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
| App entry point | `app/.../ui/main/MainActivityCompose.kt` |
| Navigation graph | `app/.../ui/navigation/AppNavigation.kt` |
| Hilt DI setup | `app/.../di/RepositoryModule.kt` |
| Theme/Colors | `app/.../ui/theme/Theme.kt` |
| Firestore rules | `firestore.rules` |
| Cloud Functions | `functions/src/index.ts` |
| Spec templates | `specs/_TEMPLATE_*.md` |
| Team Formation | `app/.../ui/games/teamformation/` |
| Live Game | `app/.../ui/livegame/LiveGameScreen.kt` |
| MVP Voting | `app/.../ui/game_experience/MVPVoteScreen.kt` |

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
- **Firebase** (Firestore, Auth, Storage, Cloud Functions v2, FCM)
- **Room** for local cache
- **Coroutines & StateFlow** for async

### Version

- **Current**: 1.6.0 (versionCode: 17)
- **SDK**: minSdk 24, targetSdk 35, JDK 17

---

## Architecture

```
UI (Compose Screens)
    ↓
ViewModels (@HiltViewModel + StateFlow<UiState>)
    ↓
Domain (Use Cases in shared/commonMain)
    ↓
Data (Repositories → Firebase/Room)
```

### Where to Put New Code

| Code Type | Location |
|-----------|----------|
| New Compose screen | `app/ui/<feature>/<Feature>Screen.kt` |
| ViewModel | `app/ui/<feature>/<Feature>ViewModel.kt` |
| Repository interface | `shared/commonMain/.../repository/` |
| Repository impl | `app/data/repository/` or `shared/androidMain/` |
| Business logic | `shared/commonMain/.../domain/` |
| Cloud Function | `functions/src/` |

### Navigation

The app uses a single-activity architecture with Compose Navigation:
- `MainActivityCompose.kt` hosts `AppNavigation`
- Routes defined in `AppNavigation.kt`
- Each screen receives its ViewModel via Hilt

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
| `games` | Game events |
| `groups` | Soccer groups |
| `statistics` | Player statistics |
| `season_participation` | League rankings per season |
| `xp_logs` | XP transaction history |
| `user_badges` | Unlocked badges |
| `locations` | Soccer field locations |

### Cloud Functions (`functions/src/`)

| File | Functions |
|------|-----------|
| `index.ts` | Main entry, onUserCreate, onGameFinished, XP processing |
| `league.ts` | recalculateLeagueRating, division changes |
| `notifications.ts` | Push triggers (game created, MVP, level up, badges) |
| `reminders.ts` | Game reminders, waitlist cleanup |

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

---

## Scripts

Located in `/scripts/`:

| Script | Purpose |
|--------|---------|
| `validate_all_app_data.js` | Firestore data validation |
| `cleanup_old_games.js` | Remove old/test games |
| `check_recent_games.js` | Debug recent game data |

Run with: `node scripts/<script_name>.js`

---

## Official References

- **[android/compose-samples](https://github.com/android/compose-samples)** - Official Google examples
- **[Material Design 3](https://m3.material.io/)** - Guidelines
- **[Material Theme Builder](https://material-foundation.github.io/material-theme-builder/)** - Theme generator
