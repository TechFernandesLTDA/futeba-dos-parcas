---
name: anticheat-caps-stat-sinks
description: Anti-cheat caps only applied to XP, not to statistics/ranking/season sinks — fix pattern via conf mutation (#2525)
metadata:
  type: project
---

Anti-cheat caps (MAX_GOALS=15, MAX_ASSISTS=10, MAX_SAVES=30) were applied to XP calculation
but NOT to the values persisted in: `statistics.totalGoals/Assists/Saves` (FieldValue.increment),
`ranking_deltas.goals_added/assists_added/saves_added`, `season_participation.goals_scored/assists`
(flat plan + by_gender Fase 4b), and xp_log metadata fields.

**Why:** The validation loop in index.ts L479-504 only logged warnings ("clamp and warn, don't throw")
but never mutated `conf.goals/assists/saves`, so raw values flowed into all downstream writes.
Negative values also decremented lifetime counters (no floor).

**Fix pattern (PR branch fix/2525-anticheat-caps, commit 9be3a81b):**
- `constants.ts`: added `clampStat(value, max) = Math.max(0, Math.min(value ?? 0, max))` — null/undefined-safe.
- `index.ts`: mutate `conf.goals/assists/saves` in the validation loop itself → all 6 downstream sinks
  (statistics, xp_log metadata goals/assists/saves, updateRankingDeltas, updateSeasonParticipation flat+by_gender)
  receive clamped values automatically with zero code duplication.
- `helpers.ts updateRankingDeltas`: defense-in-depth clamp of cappedGoals/Assists/Saves before FieldValue.increment.
- `helpers.ts buildStats()` (updateSeasonParticipation): cappedGoals/cappedAssists computed ONCE before factory
  → flat plan and by_gender.{gender} use identical clamped values (Fase 4b consistency).

**Key architectural insight:** updateRankingDeltas and updateSeasonParticipation read conf.* internally.
Mutating conf in the validation loop is the only approach that covers all sinks without duplication.

**Test file:** `functions/test/helpers/anti-cheat-caps.test.ts` — covers clampStat unit + season/ranking caps
with goals=99→15, assists=99→10, saves=99→30, negatives→0, undefined→0, plus by_gender consistency.

**Related:** [[batch-xp-idempotency-race]], [[bola-murcha-bypass]]
