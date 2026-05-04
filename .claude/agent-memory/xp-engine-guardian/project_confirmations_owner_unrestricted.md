---
name: Confirmation update — game owner has unrestricted field access
description: firestore.rules allows game owner to update ANY field in confirmations, enabling stat inflation fraud
type: project
---

`firestore.rules:505-509`: `isGameOwner(resource.data.game_id)` branch has no `onlyAllowedFields()` restriction. A malicious game owner can set `goals=15, assists=10` on their own confirmation before marking game as FINISHED, achieving MAX_XP_PER_GAME=500 with full audit trail looking legitimate.

**Why it matters:** MAX_GOALS_PER_GAME=15 in xp-constants.json equals the maximum injectable value — the server-side cap doesn't protect against pre-injection.

**How to apply:** When editing confirmation security rules, ensure game owner updates are restricted to non-stat fields (xp_earned, is_mvp, is_best_gk, is_worst_player). Issue #434.
