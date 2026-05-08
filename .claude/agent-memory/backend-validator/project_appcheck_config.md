---
name: App Check configuration matrix across callables
description: App Check is true by default in secureCallable via NODE_ENV; setUserRole/migrate disable it explicitly (admin-only OK); soft-delete missing it entirely
type: project
---

App Check status per callable as of 2026-05-08:

- `secureCallable` wrapper default: `process.env.NODE_ENV === "production"` → true in prod
- `setUserRole`, `migrateAllUsersToCustomClaims`: `appCheck: false` — acceptable, both require ADMIN role
- `enqueueNotificationCallable`, `sendTestNotification`, `createFakeGameNotifications`: `appCheck: false` — admin/debug functions
- `getLeaderboardCached`: `enforceAppCheck: true` (raw onCall, explicit)
- `submitMvpVote`, `concludeMvpVoting`: `enforceAppCheck: FUNCTIONS_EMULATOR !== "true"` (emulator-aware)
- `processXpBatch`, `resetXpRateLimit`: `enforceAppCheck: true` (raw onCall, explicit)
- `softDeleteGame`, `softDeleteGroup`, `restoreDeletedGame`, `restoreDeletedGroup`: NO enforceAppCheck — filed as issue #437

**FIXED 2026-05-08 (SEC-2026-05-08)**:
- `verifyCpf`, `setUserVerified` in `auth/verification.ts`: was hardcoded `false` (debug that became prod) → now `NODE_ENV==="production"`
- `migratePiiToUsersPrivate`, `updateUserPii`, `removePiiFromUsers` in `auth/pii-migration.ts`: same fix
- `denormalizeGameLocations` in `games/denormalize-location.ts`: same fix

**F-H1 FALSE POSITIVE**: `canSendSmsOtp` in `anti-abuse.ts` has no auth guard by design — called PRE-login before signInWithPhoneNumber. App Check is the protection here (already correct: `NODE_ENV==="production"`).

**How to apply:** When adding new callables, use secureCallable for automatic App Check in prod. For raw onCall, always add enforceAppCheck explicitly. Debug `enforceAppCheck: false` must NEVER reach prod.
