---
name: App Check configuration matrix across callables
description: App Check is true by default in secureCallable via NODE_ENV; setUserRole/migrate disable it explicitly (admin-only OK); soft-delete missing it entirely
type: project
---

App Check status per callable as of 2026-05-03:

- `secureCallable` wrapper default: `process.env.NODE_ENV === "production"` → true in prod
- `setUserRole`, `migrateAllUsersToCustomClaims`: `appCheck: false` — acceptable, both require ADMIN role
- `enqueueNotificationCallable`, `sendTestNotification`, `createFakeGameNotifications`: `appCheck: false` — admin/debug functions
- `getLeaderboardCached`: `enforceAppCheck: true` (raw onCall, explicit)
- `submitMvpVote`, `concludeMvpVoting`: `enforceAppCheck: FUNCTIONS_EMULATOR !== "true"` (emulator-aware)
- `processXpBatch`, `resetXpRateLimit`: `enforceAppCheck: true` (raw onCall, explicit)
- `softDeleteGame`, `softDeleteGroup`, `restoreDeletedGame`, `restoreDeletedGroup`: NO enforceAppCheck — filed as issue #437

**How to apply:** When adding new callables, use secureCallable for automatic App Check in prod. For raw onCall, always add enforceAppCheck explicitly.
