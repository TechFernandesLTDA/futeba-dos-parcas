---
name: Batch XP idempotency race condition
description: processXpBatch checks transaction_id outside a transaction — concurrent retries can bypass dedup
type: project
---

`processing.ts:798-813`: `processXpBatch` uses `whereIn` query (non-transactional) to filter already-processed IDs. Two concurrent Function instances can both see empty results and both commit. The trigger-level `xp_processing` lock mitigates the main case but doesn't cover all retry paths.

`processXpIdempotent` (single transaction path) correctly re-checks inside the transaction — that path is safe.

**How to apply:** If extending batch processing or adding new paths that call `processXpBatch`, consider whether the trigger lock is still in place. Issue #441.
