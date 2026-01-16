# CLAUDE.md - Futeba dos Parças

## Fontes de Referência Oficiais (OBRIGATÓRIO)

**IMPORTANTE**: Para qualquer implementação de UI/Compose, SEMPRE consulte estas fontes oficiais:

### Documentação Principal
- **[android/compose-samples](https://github.com/android/compose-samples)** - Exemplos oficiais do Google
  - `Reply/` - Material 3 completo com temas dinâmicos
  - `Jetchat/` - Chat com temas dinâmicos
  - `Jetsnack/` - Sistema de cores customizado
  - `JetNews/` - Tipografia e componentes

### Codelabs e Guias
- **[Codelab: Temas no Compose com Material 3](https://codelabs.developers.google.com/jetpack-compose-theming)** - Tutorial completo (9 etapas)
- **[Material Design 3 no Compose](https://developer.android.com/develop/ui/compose/designsystems/material3)** - Documentação oficial Android

### Material Design
- **[m3.material.io](https://m3.material.io/)** - Guidelines oficiais M3
- **[Material Theme Builder](https://material-foundation.github.io/material-theme-builder/)** - Gerador de temas

### Referência Interna do Projeto
- **`.claude/rules/material3-compose-reference.md`** - Guia completo consolidado com exemplos de código

---

## Project Overview

**Futeba dos Parças** is an Android application for managing amateur soccer groups ("peladas"), featuring gamification, statistics, and team balancing.

### Tech Stack

- **Language**: Kotlin 2.0+
- **Architecture**: MVVM + Clean Architecture
- **DI**: Hilt (Dagger)
- **UI**: ViewBinding (XML) & Jetpack Compose (partial migration)
- **Async**: Coroutines & StateFlow
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions v2)
- **Local Cache**: Room
- **Security**: EncryptedSharedPreferences (AES256)

### Version

- **Current**: 1.4.0
- **Min SDK**: 24 (Android 7.0)
- **Target SDK**: 34 (Android 14)

## Build & Run Commands

```bash
# Build
./gradlew assembleDebug          # Debug APK
./gradlew assembleRelease        # Release APK
./gradlew installDebug           # Install on connected device

# Tests
./gradlew test                   # Unit tests
./gradlew connectedAndroidTest   # Instrumented tests

# Utilities
./gradlew clean                  # Clean build
./gradlew compileDebugKotlin     # Fast Kotlin compilation check
```

## Architecture Guidelines

### Layers

```
UI (Fragments/Activities/Compose)
    |
    v
ViewModels (@HiltViewModel + StateFlow)
    |
    v
Domain (Use Cases, Services, Business Logic)
    |
    v
Data (Repositories -> Firebase/Room)
```

### Key Patterns

1. **ViewModels**:
   - Always use `@HiltViewModel`
   - Expose UI state via `StateFlow<UiState>` (sealed classes)
   - Use Job tracking for Flow cancellation
   - Always add `.catch {}` to Flow collections
   - Close Channels in `onCleared()`

2. **Repositories**:
   - Return `Result<T>` or `Flow<T>`
   - Implement LRU caching for frequently accessed data (max 200 entries)
   - Use pagination for large lists (50 items per page)
   - Batch Firestore queries in chunks of 10 (whereIn limit)

3. **Coroutines**:
   - Use `viewModelScope` in ViewModels
   - Cancel previous jobs before starting new ones
   - Use parallel queries with `async/awaitAll` for performance

## Project Structure

```
app/src/main/java/com/futebadosparcas/
├── data/
│   ├── model/          # Data classes (User, Game, Group, etc.)
│   ├── repository/     # Data access layer (Firebase, Room)
│   └── local/          # Room database and DAOs
├── domain/
│   ├── usecase/        # Business logic use cases
│   ├── ranking/        # XP and ranking calculations
│   ├── gamification/   # Badges, levels, challenges
│   └── ai/             # Team balancing algorithms
├── ui/
│   ├── auth/           # Login, Register screens
│   ├── home/           # Home fragment
│   ├── games/          # Game listing and details
│   ├── league/         # Rankings and seasons
│   ├── players/        # Player listing and profiles
│   ├── groups/         # Group management
│   ├── profile/        # User profile
│   └── livegame/       # Live match tracking
├── di/                 # Hilt modules
└── util/               # Utilities (Logger, Extensions, etc.)
```

## Firebase Structure

### Collections

- `users` - User profiles and settings
- `games` - Game events
- `groups` - Soccer groups
- `statistics` - Player statistics
- `season_participation` - League rankings per season
- `seasons` - Active/past seasons
- `xp_logs` - XP transaction history
- `user_badges` - Unlocked badges
- `locations` - Soccer field locations
- `cashbox` - Group financial tracking

### Cloud Functions (v2)

- `onUserCreate` - Initialize new user data
- `onGameFinished` - Process XP, stats, rankings
- `recalculateLeagueRating` - Update league positions (with infinite loop protection)
- `checkSeasonClosure` - Monthly season management

## Design System

### Colors

- **Primary**: `#58CC02` (Green - Success, XP)
- **Accent**: `#FF9600` (Orange - Highlights)
- **Gold Division**: `#FFD700`
- **Silver Division**: `#C0C0C0`
- **Bronze Division**: `#CD7F32`
- **Diamond Division**: `#B9F2FF`

### Typography

- **Font Family**: Roboto
- **Headings**: Bold, larger sizes
- **Body**: Regular weight

### Components

- Material Design 3
- Custom rounded cards (16dp corners)
- Bottom navigation with badge support
- Gamification badges and level indicators

## Material Design 3 - Color Guidelines

### Color Usage Rules

**CRITICAL**: All colors MUST use `MaterialTheme.colorScheme.*` to support dark/light themes and ensure accessibility.

#### ✅ CORRECT - Using Theme Colors

```kotlin
// Icons
Icon(
    imageVector = Icons.Default.Star,
    tint = MaterialTheme.colorScheme.primary
)

// Text
Text(
    text = "Hello",
    color = MaterialTheme.colorScheme.onSurface
)

// Backgrounds
Box(
    modifier = Modifier.background(MaterialTheme.colorScheme.surface)
)
```

#### ❌ INCORRECT - Hardcoded Colors

```kotlin
// ❌ NEVER do this - breaks dark theme
Icon(tint = Color.Black)  // Invisible in dark mode!
Text(color = Color.White)  // Invisible in light mode!
Box(modifier = Modifier.background(Color.Gray))
```

### Material3 ColorScheme Reference

| Token | Usage | Example |
|-------|-------|---------|
| `primary` | Main brand color, CTAs | FAB, Important buttons |
| `onPrimary` | Text/icons on primary | Text on primary button |
| `secondary` | Accents, less prominent | Secondary actions |
| `onSecondary` | Text/icons on secondary | Text on secondary button |
| `surface` | Card/sheet backgrounds | Cards, Dialogs, BottomSheets |
| `onSurface` | Text/icons on surface | Most text and icons |
| `surfaceVariant` | Subtle backgrounds | Disabled states, dividers |
| `onSurfaceVariant` | Low-emphasis text | Captions, placeholders |
| `error` | Error states | Error messages, destructive actions |
| `onError` | Text/icons on error | Text on error snackbar |

### Special Cases: Gamification Colors

Some colors are **intentionally hardcoded** for gamification (medals, trophies):

```kotlin
// ✅ APPROVED - Gamification colors (universal recognition)
object GamificationColors {
    val Gold = Color(0xFFFFD700)      // 1st place medal
    val Silver = Color(0xFFE0E0E0)    // 2nd place medal
    val Bronze = Color(0xFFCD7F32)    // 3rd place medal
    val Diamond = Color(0xFFB9F2FF)   // Special league division
    val XpGreen = Color(0xFF00C853)   // XP bars/progress
}
```

**When using gamification colors with text, ALWAYS use `ContrastHelper`:**

```kotlin
// ✅ CORRECT - Ensures readable text over colored backgrounds
Text(
    text = "1º",
    color = ContrastHelper.getContrastingTextColor(GamificationColors.Gold)
)
```

### ContrastHelper Utility

Use `ContrastHelper` for dynamic text colors over custom backgrounds:

```kotlin
// Automatic contrast calculation (WCAG AA compliant)
val textColor = ContrastHelper.getContrastingTextColor(backgroundColor)

// Check if contrast meets WCAG AA standard (4.5:1 for normal text)
val isAccessible = ContrastHelper.meetsWCAGAA(foregroundColor, backgroundColor)

// Get contrast ratio
val ratio = ContrastHelper.getContrastRatio(foregroundColor, backgroundColor)
```

**Located at**: `app/src/main/java/com/futebadosparcas/util/ContrastHelper.kt`

### TopBar Colors

All TopBars MUST use standardized colors from `AppTopBars.kt`:

```kotlin
// ✅ Use predefined color functions
TopAppBar(
    colors = AppTopBar.surfaceColors()  // Most common
)

// Available options:
AppTopBar.surfaceColors()   // Surface background, onSurface text/icons
AppTopBar.primaryColors()   // Primary background, onPrimary text/icons
```

### Icon Tinting Best Practices

```kotlin
// ✅ CORRECT - Contextual tinting
Icon(
    imageVector = Icons.Default.Delete,
    tint = MaterialTheme.colorScheme.error  // Red for destructive action
)

Icon(
    imageVector = Icons.Default.Star,
    tint = GamificationColors.Gold  // Gold for special items
)

Icon(
    imageVector = Icons.Default.Info,
    tint = MaterialTheme.colorScheme.onSurfaceVariant  // Subtle info
)

// ❌ INCORRECT
Icon(tint = Color.Red)  // Use colorScheme.error instead
Icon(tint = Color.Yellow)  // Poor contrast, use Material Yellow A700: Color(0xFFFDD835)
```

### Accessibility Requirements

- **Minimum contrast ratio**: 4.5:1 for normal text (WCAG AA)
- **Minimum contrast ratio**: 3.0:1 for large text (18pt+ or 14pt+ bold)
- **Always test in dark theme**: Ensure colors adapt properly
- **Use ContrastHelper**: For any custom background + text combination

### Quick Reference Checklist

Before committing UI code:

- [ ] No `Color.Black`, `Color.White`, `Color.Gray` hardcoded
- [ ] All icons use `MaterialTheme.colorScheme.*` tint
- [ ] TopBars use `AppTopBar.*Colors()` functions
- [ ] Custom colors (gamification) use `ContrastHelper` for text
- [ ] Tested in both light and dark themes
- [ ] Contrast ratio ≥ 4.5:1 (verified with `ContrastHelper.getContrastRatio()`)

## Code Style

### Naming Conventions

- **Classes**: `PascalCase` (e.g., `GameRepository`)
- **Interface/Impl**: `GameRepository` -> `GameRepositoryImpl`
- **Variables**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: Match class name (e.g., `Game.kt`)

### Comments

- Write in **Portuguese (PT-BR)**
- Document public APIs
- Explain complex business logic

### Strings

- **ALWAYS** use `strings.xml` - no hardcoded strings in code
- Format: `@string/screen_element_description`

## Critical Rules

1. **Never use `findViewById`** - Always use ViewBinding
2. **Never commit secrets** - Keep `serviceAccountKey.json` and credentials gitignored
3. **Increment version code** before release in `build.gradle.kts`
4. **Use `StateFlow`** - Prefer over LiveData
5. **Cancel jobs** - Always cancel previous Flow jobs before starting new ones
6. **Close channels** - Always close Channels in `onCleared()`
7. **Use `.catch {}`** - Always handle Flow errors
8. **Paginate large lists** - Max 50 items per page
9. **Never hardcode colors** - Always use `MaterialTheme.colorScheme.*` (see Material Design 3 section)
10. **Use ContrastHelper** - For any custom background + text combination to ensure WCAG AA compliance

## Performance Optimizations (Applied)

### ViewModels

- Job tracking to prevent race conditions
- LRU cache with max 200 entries for user data
- `.catch {}` for Flow error handling
- Channel closure in `onCleared()` to prevent memory leaks

### Repositories

- LRU cache with 5-minute TTL for user queries
- Cursor-based pagination for user lists
- Parallel batch queries using `async/awaitAll`
- Firestore composite indexes for complex queries

### Security

- EncryptedSharedPreferences for sensitive data (FCM tokens, login timestamps)
- AES256_GCM encryption scheme
- Fallback to standard SharedPreferences for older devices

## Multi-Platform Preparation (KMP/iOS)

See `KOTLIN_MULTIPLATFORM_PLAN.md` for detailed migration roadmap.

### Shareable Components (Ready for KMP)

- Domain layer (XPCalculator, TeamBalancer, Use Cases)
- Data models (with Kotlinx Serialization)
- Business logic (MilestoneChecker, BadgeAwarder)

### Platform-Specific

- Firebase SDK implementations
- UI layer (ViewBinding/Compose for Android, SwiftUI for iOS)
- Push notifications (FCM)

## Scripts

Located in `/scripts/`:

- `validate_all_app_data.js` - Comprehensive Firestore data validation
- `remove_id_field_from_users.js` - Data migration script
- `cleanup_old_games.js` - Removes old/test games
- `check_recent_games.js` - Debug recent game data

Run with: `node scripts/<script_name>.js`

## Interaction Style for AI Assistants

- Be concise and code-focused
- Prefer full XML file rewrites over small snippets (patching issues)
- Match the "Premium/Gamified" aesthetic in UI code
- Follow Portuguese (PT-BR) for comments
- Always verify builds compile before marking tasks complete
