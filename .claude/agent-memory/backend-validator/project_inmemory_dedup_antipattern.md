---
name: In-memory Set dedup broken in multi-instance Cloud Functions
description: syncingGameIds Set in index.ts is broken across Cloud Function instances — dedup only works within same process
type: project
---

`onConfirmationWrite` (index.ts:1671) uses `const syncingGameIds = new Set<string>()` module-level to debounce duplicate recalculations. This only works within a single Cloud Function instance; concurrent events on different instances bypass the dedup entirely.

**Why:** Firebase Cloud Functions v2 can run multiple concurrent instances. Module-level state is NOT shared.

**How to apply:** Flag any module-level mutable state (Set, Map, array) used as distributed dedup in triggers. The correct pattern is Firestore transaction + a processing flag, or FieldValue.increment instead of full recount.

This specific case (players_count sync) should use atomic `FieldValue.increment(±1)` instead of full recount query.
