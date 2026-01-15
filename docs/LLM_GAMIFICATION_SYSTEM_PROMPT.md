# LLM System Prompt: Gamification & XP System

## Context for AI Assistants

You are working on the **Futeba dos Parças** project, an Android soccer management app with gamification features.

## Project Structure

```
C:\Projetos\Futeba dos Parças\
├── app/src/main/java/com/futebadosparcas/     # Android-specific code
├── shared/src/
│   ├── commonMain/kotlin/com/futebadosparcas/ # KMP shared code
│   └── androidMain/kotlin/com/futebadosparcas/ # Android implementation
├── functions/src/                              # Cloud Functions (TypeScript)
└── docs/                                       # Documentation
```

## Critical Files for Gamification/XP

### Domain Layer (KMP - Shared Logic)

**File**: `shared/src/commonMain/kotlin/com/futebadosparcas/domain/ranking/XPCalculator.kt`

**Purpose**: Calculates XP for a player based on game performance.

**Key Constants**:
```kotlin
private const val DEFAULT_XP_PRESENCE = 10
private const val DEFAULT_XP_PER_GOAL = 10
private const val DEFAULT_XP_PER_ASSIST = 7
private const val DEFAULT_XP_PER_SAVE = 5
private const val DEFAULT_XP_WIN = 20
private const val DEFAULT_XP_DRAW = 10
private const val DEFAULT_XP_MVP = 30
private const val DEFAULT_XP_STREAK_3 = 20
private const val DEFAULT_XP_STREAK_7 = 50
private const val DEFAULT_XP_STREAK_10 = 100

// Anti-Cheat Limits
private const val MAX_GOALS_PER_GAME = 15
private const val MAX_ASSISTS_PER_GAME = 10
private const val MAX_SAVES_PER_GAME = 30
private const val MAX_XP_PER_GAME = 500
```

**Main Function**:
```kotlin
fun calculate(
    playerData: PlayerGameData,
    opponentsGoals: Int = 0,
    settings: GamificationSettings? = null
): XpCalculationResult
```

**Important Rules**:
1. Always cap values at MAX limits (anti-cheat)
2. Total XP must never be negative (use `maxOf(0L, ...)`)
3. Total XP must not exceed MAX_XP_PER_GAME (500)
4. Use `.toLong()` when coercing Int constants to avoid type mismatch

**Common Bug Pattern**:
```kotlin
// ❌ WRONG - Type mismatch
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME)

// ✅ CORRECT - Explicit Long conversion
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME.toLong())
```

---

**File**: `app/src/main/java/com/futebadosparcas/domain/ranking/MatchFinalizationService.kt`

**Purpose**: Processes finished games, awards XP, updates statistics.

**Key Methods**:
- `processGameFinished()`: Main entry point for game finalization
- `calculatePlayerStats()`: Calculates statistics for each player
- `updateStreak()`: Updates consecutive games streak
- `checkAndAwardMilestones()`: Awards badges for achievements

**Streak Calculation (CORRECTED)**:
```kotlin
// Lines 496-509 - Consecutive day logic
val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
val isConsecutive = try {
    val lastParsed = dateFormat.parse(lastDate)
    val currentParsed = dateFormat.parse(gameDate)
    val diffInDays = ((currentParsed.time - lastParsed.time) / (24 * 60 * 60 * 1000)).toInt()
    // Same day (0) or next day (1) counts as consecutive
    diffInDays in 0..1
} catch (e: Exception) {
    AppLogger.w(TAG) { "Erro ao parsear datas para streak: $lastDate, $gameDate" }
    false
}
```

**Critical**: `diffInDays in 0..1` means same day or next day = consecutive.

---

### Server-Side Validation

**File**: `functions/src/index.ts`

**Cloud Function**: `onGameStatusUpdate`

**Purpose**: Server-side validation and XP recalculation (anti-cheat).

**Key Validations**:
```javascript
const MAX_GOALS_PER_GAME = 15;
const MAX_ASSISTS_PER_GAME = 10;
const MAX_SAVES_PER_GAME = 30;
const MAX_XP_PER_GAME = 500;

// Validate each confirmation
for (const conf of confirmations) {
    if (conf.goals < 0 || conf.goals > MAX_GOALS_PER_GAME) {
        throw new Error(`[ANTI-CHEAT] Invalid goals count for user ${conf.userId}: ${conf.goals}`);
    }
    if (conf.assists < 0 || conf.assists > MAX_ASSISTS_PER_GAME) {
        throw new Error(`[ANTI-CHEAT] Invalid assists count...`);
    }
    if (conf.saves < 0 || conf.saves > MAX_SAVES_PER_GAME) {
        throw new Error(`[ANTI-CHEAT] Invalid saves count...`);
    }
}
```

**Important**: Server-side validation is MANDATORY. Never trust client calculations.

---

## Data Models

### PlayerGameData (Input)

```kotlin
data class PlayerGameData(
    val playerId: String,
    val position: PlayerPosition,
    val goals: Int,
    val assists: Int,
    val saves: Int,
    val yellowCards: Int,
    val redCards: Int,
    val isMvp: Boolean,
    val isWorstPlayer: Boolean,
    val hasBestGoal: Boolean,
    val teamId: String,
    val teamWon: Boolean,
    val teamDrew: Boolean,
    val currentStreak: Int = 0
)
```

### XpCalculationResult (Output)

```kotlin
data class XpCalculationResult(
    val totalXp: Long,
    val breakdown: XpBreakdown,
    val gameResult: GameResult
)

data class XpBreakdown(
    val participation: Long = 0,
    val goals: Long = 0,
    val assists: Long = 0,
    val saves: Long = 0,
    val result: Long = 0,
    val mvp: Long = 0,
    val milestones: Long = 0,
    val streak: Long = 0,
    val penalty: Long = 0
)
```

### GamificationSettings (Dynamic Config)

```kotlin
data class GamificationSettings(
    val xpPresence: Int = 10,
    val xpPerGoal: Int = 10,
    val xpPerAssist: Int = 7,
    val xpPerSave: Int = 5,
    val xpWin: Int = 20,
    val xpDraw: Int = 10,
    val xpMvp: Int = 30,
    val xpStreak3: Int = 20,
    val xpStreak7: Int = 50,
    val xpStreak10: Int = 100,
    val xpWorstPlayerPenalty: Int = -10
)
```

**Firestore Location**: `gamification_settings/default`

---

## Common Tasks

### Task 1: Calculate XP for a Player

```kotlin
val playerData = PlayerGameData(
    playerId = "user123",
    position = PlayerPosition.LINE,
    goals = 3,
    assists = 2,
    saves = 0,
    yellowCards = 0,
    redCards = 0,
    isMvp = true,
    isWorstPlayer = false,
    hasBestGoal = false,
    teamId = "team1",
    teamWon = true,
    teamDrew = false,
    currentStreak = 5
)

val result = XPCalculator.calculate(playerData)
// result.totalXp = 10 (presence) + 30 (goals) + 14 (assists) + 20 (win) + 30 (mvp) + 50 (streak) = 154 XP
```

### Task 2: Add New XP Category

**Example**: Add +5 XP for clean sheet (no goals conceded)

**Steps**:
1. Add constant in `XPCalculator.kt`:
   ```kotlin
   private const val DEFAULT_XP_CLEAN_SHEET = 5
   ```
2. Add to `GamificationSettings`:
   ```kotlin
   val xpCleanSheet: Int = 5
   ```
3. Add calculation logic:
   ```kotlin
   val cleanSheetXp = if (playerData.cleanSheet) settings?.xpCleanSheet ?: DEFAULT_XP_CLEAN_SHEET else 0
   ```
4. Add to breakdown:
   ```kotlin
   val breakdown = XpBreakdown(
       // ... existing fields
       cleanSheet = cleanSheetXp.toLong()
   )
   ```

### Task 3: Update XP Cap (Anti-Cheat)

**Example**: Increase max goals from 15 to 20

**Files to Update**:
1. `shared/src/commonMain/kotlin/.../XPCalculator.kt`:
   ```kotlin
   private const val MAX_GOALS_PER_GAME = 20  // was 15
   ```
2. `functions/src/index.ts`:
   ```javascript
   const MAX_GOALS_PER_GAME = 20;  // was 15
   ```

**Critical**: Update BOTH client AND server to maintain consistency.

### Task 4: Add New Badge

**Example**: "Hat-trick Hero" - 3 goals in one game

**Steps**:
1. Add badge definition to Firestore:
   ```javascript
   {
     id: "hat_trick",
     name: "Hat-trick Hero",
     description: "Mark 3 goals in one game",
     icon: "⚽⚽⚽",
     category: "GOALS"
   }
   ```
2. Add logic in `MatchFinalizationService.checkAndAwardMilestones()`:
   ```kotlin
   if (confirmation.goals >= 3) {
       awardBadge(userId, "hat_trick")
   }
   ```

---

## Known Issues and Solutions

### Issue 1: Type Mismatch - Int vs Long

**Symptom**: `Argument type mismatch: actual type is 'kotlin.Int', but 'kotlin.Long' was expected`

**Location**: `XPCalculator.kt:181` (Android) or `:184` (KMP)

**Fix**:
```kotlin
// Before
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME)

// After
val totalXp = maxOf(0L, breakdown.total).coerceAtMost(MAX_XP_PER_GAME.toLong())
```

### Issue 2: Streak Not Incrementing

**Symptom**: Streak always resets to 1

**Root Cause**: Date parsing error or timezone issue

**Fix**: Ensure dates are in `yyyy-MM-dd` format and UTC timezone:
```kotlin
val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
dateFormat.timeZone = TimeZone.getTimeZone("UTC")
```

### Issue 3: XP Not Displaying in UI

**Symptom**: User wins XP but UI doesn't update

**Root Cause**: Flow not collecting or cache issue

**Debugging**:
```kotlin
// Check if XpLogFlow is emitting
viewModelScope.launch {
    xpLogFlow.collect { log ->
        Log.d("XP_DEBUG", "XP Log: $log")
    }
}
```

**Fix**: Ensure XpLog is saved to Firestore with proper `userId` and `gameId`.

---

## Testing Checklist

When making changes to gamification/XP:

- [ ] Unit tests pass (`./gradlew test`)
- [ ] Client-side calculation correct
- [ ] Server-side validation matches client
- [ ] Anti-cheat limits enforced
- [ ] Streak logic works across day boundaries
- [ ] Badges awarded correctly
- [ ] UI updates in real-time
- [ ] XP logs saved to Firestore
- [ ] Level calculations correct
- [ ] Edge cases tested (0 goals, max goals, etc.)

---

## Best Practices

1. **NEVER trust client input** - Always validate server-side
2. **Use transactions** for atomic Firestore updates
3. **Log everything** - XpLog is your audit trail
4. **Test edge cases** - What if player has 0 goals? 100 goals?
5. **Handle nulls gracefully** - Use `?:` with sensible defaults
6. **Use Result<T>** - Never throw exceptions, return Result
7. **Keep constants synchronized** - Client + Server must match

---

## Quick Reference

### XP Formula

```
XP = Presence + (Goals × 10) + (Assists × 7) + (Saves × 5) + Result + MVP + Streak - Penalty

Max per game: 500 XP
```

### Level Formula

```
Level 1-5:   level² × 50 XP
Level 6-10:  5000 + (level-10) × 2500 XP
Level 11-20: 25000 + (level-20) × 5000 XP
Level 21-30: 100000 + (level-30) × 15000 XP
Level 31+:   500000 + (level-40) × 100000 XP
```

### Streak Formula

```
Consecutive = (currentDate - lastGameDate) in 0..1 days

Bonus:
  3 games:  +20 XP
  7 games:  +50 XP
  10+ games: +100 XP
```

---

**Last Updated**: 2025-01-10
**Version**: 1.4.0
**Status**: ✅ Production
