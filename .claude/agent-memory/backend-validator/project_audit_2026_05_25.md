---
name: audit-2026-05-25-findings
description: Audit run 2026-05-25 findings — group-league WriteBatch bug, idempotency gap, user_streaks LGPD, streak pagination
metadata:
  type: project
---

Audit run 2026-05-25 found 4 real bugs. Issues filed: #1839, #1840, #1841, #1842.

**#1839 CRITICAL** — `group-league.ts:100`: `const batch` committed inside loop but never re-created. Identical pattern to #1280 (fixed in account-cleanup.ts). Throws "Cannot modify a WriteBatch that has been committed" for groups with more than FIRESTORE_BATCH_SAFE_LIMIT confirmations. Fix: `let batch`, reassign after commit.

**#1840 CRITICAL** — `group-league.ts`: `onGameFinishedGroupLeague` has NO idempotency guard. All `FieldValue.increment()` league standings calls (points, wins, games_played, goals) double-count on CF retry. The `matchRef.set()` at end is idempotent but the batch standings writes before it are NOT. Fix: check if `league_matches/{gameId}` already exists before processing.

**#1841 HIGH** — `account-cleanup.ts`: `user_streaks/{uid}` document NOT deleted in `onUserDeleted` trigger. LGPD Art. 18 VI gap. 14 other collections ARE deleted; this one was missed. Document ID = userId so single delete is sufficient.

**#1842 MEDIUM** — `maintenance/compact-streaks.ts:120`: `limit(5000)` without pagination. Users #5001+ never get streak resets. Same class of bug as #788 (which fixed 1000→5000 but not pagination).

**Why:** group-league.ts was NOT audited in prior waves (only index.ts, xp/, voting/ were covered). This is a relatively new file.
