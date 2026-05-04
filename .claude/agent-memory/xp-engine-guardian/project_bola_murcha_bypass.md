---
name: Bola Murcha penalty bypass via direct Firestore write
description: Any confirmed player can overwrite is_worst_player flag directly, bypassing MVP voting function
type: project
---

`index.ts:603-604` reads `conf.is_worst_player` directly from the confirmations document. `firestore.rules:511-512` allows any confirmed player to update `is_mvp, is_best_gk, is_worst_player` on any confirmation in the game. A player can write `is_worst_player=false` before XP processing, or set it to `true` on a rival.

MVP is correctly validated against `after.mvp_id` (game document field, server-set). Worst player validation should be consistent: use `after.worst_player_id === uid` instead of `conf.is_worst_player`.

**How to apply:** When touching XP processing or voting logic, always use game-level fields (mvp_id, worst_player_id) as the authoritative source, not confirmation-level flags. Issue #436.
