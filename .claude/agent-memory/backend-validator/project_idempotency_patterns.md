---
name: project-idempotency-patterns
description: Idempotency and batch safety patterns in Cloud Functions — what is protected and what is not
metadata:
  type: project
---

Audit 2026-05-26 (umbrella #1946) catalogued idempotency/batch patterns across xp/, maintenance/, season/, voting/, index.ts.

**What is correctly protected:**
- `onGameStatusUpdate` XP processing: xp_processed flag + transaction lock (xp_processing) + per-user alreadyProcessedUserIds set + deterministic xp_log doc IDs (game_{id}_user_{uid}) + Promise.allSettled(batchCommits) (#793)
- `xp/processing.ts processXpIdempotent`: outer fast-path check + inner transaction.get(logRef) double-check (atomic, FIX SECFIX #1453)
- `compact-streaks.ts`: re-creates batch after commit (FIX #654-B1, line 307)
- `batch-sender.ts enqueueNotifications`: re-creates batch at 450 ops (FIX #787, lines 191-225)
- `concludeMvpVoting`: idempotent via deterministic xp_log doc IDs (mvp_{gameId}_{userId}) in applyVotingXpDelta

**Known bugs found in audit:**
- #1962: concludeMvpVoting transaction.update uses reconstructed confRef (${gameId}_${confUserId}) not confDoc.ref — will fail if doc ID format differs
- #1964: onGameDeleted/onGroupDeleted limit(2000) truncates silently for large games (>2000 child docs in any collection)
- #1966: season/index.ts uses FIRESTORE_BATCH_LIMIT=500 not FIRESTORE_BATCH_SAFE_LIMIT=450

**FP patterns (appeared suspicious but are safe):**
- Outer TOCTOU check before runTransaction in processXpIdempotent: safe because inner transaction atomically re-checks
- onGameDeleted retry: deleted docs disappear from re-queries, naturally idempotent
- onGroupDeleted games update retry: `where group_id==groupId` won't match already-updated games (group_id now null)
- concludeMvpVoting transaction 500-op limit: typical games have 10-30 players, far under 500

**Why:** Knowing these patterns prevents re-raising FPs in future audits and helps prioritize real fixes.
**How to apply:** When auditing batch/idempotency code, check for the patterns above before filing issues.
