---
name: Callable wrapper coverage gaps
description: soft-delete.ts callables bypass secureCallable, missing App Check; issues filed #435 #437
type: project
---

4 callables in `functions/src/maintenance/soft-delete.ts` use raw `functions.https.onCall()` instead of `secureCallable` wrapper:
- softDeleteGame, softDeleteGroup, restoreDeletedGame, restoreDeletedGroup

They have manual auth + rate limiting but no `enforceAppCheck`.

**Why:** Likely written before the secureCallable wrapper was standardized.

**How to apply:** When reviewing or touching soft-delete.ts, flag migration to secureCallable. Issues #435 (originalError leak) and #437 (App Check gap) track these findings.
