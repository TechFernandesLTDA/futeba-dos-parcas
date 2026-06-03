# Spec: Externalize Cloud Functions messages to locale files

> Type: chore
> Status: APPROVED (batch of 3 issues)
> Issues: #2376, #2377, #2378
> Date: 2026-06-02

## Problem

The Cloud Functions backend in `functions/` has:

1. **~130 HttpsError messages hardcoded** across 20+ callable files, in mixed PT/EN with inconsistent accents. (Issue #2376)
2. **~80 push notification titles/bodies hardcoded** in `notifications/`, `monitoring/`, `growth/` and test data in `callable.ts`. (Issue #2377)
3. **PT-BR inconsistencies**: missing accents (`"obrigatorio"`, `"nao"`), mixed EN/PT (`"User must be authenticated"` vs `"Login obrigatorio"`), and duplicate message variants. (Issue #2378)

A partial infrastructure already exists from PR #2444 (referenced but not closed):
- `functions/src/error-messages.ts` — `ERROR_MSGS` const + `throwError` helper
- `functions/src/notifications/notification-messages.ts` — `GAME_NOTIFICATIONS`, `ACHIEVEMENT_NOTIFICATIONS`, `PRESENCE_NOTIFICATIONS`, `REMINDER_NOTIFICATIONS` + `getNotificationTitle`/`getNotificationBody` helpers

What's missing: many files still throw `new HttpsError("code", "literal string")` and many push notifications are still inline literals. This spec extends the existing infrastructure and replaces the remaining hardcoded strings.

## Goals

- Replace all remaining hardcoded HttpsError message strings with references to `ERROR_MSGS.*` constants.
- Replace all remaining hardcoded push notification titles/bodies with references to `*_NOTIFICATIONS` constants.
- Normalize PT-BR across the new constants: use proper accents, unify auth messages, deduplicate rate-limit messages.
- Keep the public Cloud Functions API stable (callable names + HttpsError codes unchanged).
- Pass existing tests with no message-substring regressions.

## Non-goals

- Adding real i18n resolution from the request payload (e.g., reading `context.auth?.token?.locale`) — out of scope; messages stay PT-BR at runtime. The infrastructure is locale-aware (signature takes a `locale` param) but defaults to `pt-BR` so behavior is identical to today.
- Changing the HttpsError code mapping for any callable.
- Removing the existing `error-messages.ts` / `notification-messages.ts` (they are the foundation, not replaced).

## Approach

### File structure (extends existing)

```
functions/src/
  error-messages.ts                        # existing — extend with more constants
  notifications/
    notification-messages.ts               # existing — extend with admin/alert/fake
    admin-notifications.ts                 # NEW — admin alert + weekly ranking
    fake-notifications.ts                  # NEW — debug fake game invites
```

### Key naming

- `ERROR_MSGS.<CONTEXT>_<KIND>` for error constants. Examples:
  - `ERROR_MSGS.UNAUTHENTICATED` (existing)
  - `ERROR_MSGS.RATE_LIMIT_RETRY(seconds)` (new)
  - `ERROR_MSGS.FIELD_REQUIRED(field)` (new)
  - `ERROR_MSGS.GAME_NOT_FOUND` (new)
  - `ERROR_MSGS.CANNOT_VOTE_SELF` (new)
  - `ERROR_MSGS.VOTE_REGISTERED` (new)
- `*_NOTIFICATIONS.<KEY>` for push notification groups, each with `title` and `body` per locale. Examples:
  - `GAME_NOTIFICATIONS.GAME_CREATED.title["pt-BR"]()` (existing)
  - `ADMIN_NOTIFICATIONS.XP_STALE.title["pt-BR"]()` (new)

### Lookup helper

Reuse existing helpers:
- Error: `throwError(code, message)` or inline `new HttpsError(code, ERROR_MSGS.X)`.
- Notification: `getNotificationTitle(msg, locale, params)` / `getNotificationBody(msg, locale, params)`. Default locale is `pt-BR`.

### PT-BR normalization rules (Issue #2378)

- Use proper accents: `não`, `obrigatório`, `inválido`, `máximo`, `você`, `é`, `mínimo`.
- Unify auth error to **single** message: `"Login obrigatório."` (existing `ERROR_MSGS.UNAUTHENTICATED`).
- Unify internal error to **single** message: `"Ocorreu um erro inesperado."` (existing `ERROR_MSGS.UNEXPECTED_ERROR`).
- Rate limit messages: prefer `ERROR_MSGS.RATE_LIMIT_RETRY(seconds)` (with seconds) or `ERROR_MSGS.RATE_LIMIT_GENERIC`.
- Field validation: prefer `ERROR_MSGS.FIELD_REQUIRED(field)` → `"<field> é obrigatório."`.
- Keep "Verification code sent if CPF is valid" (anti-enumeration, intentional).
- "An unexpected error occurred" → "Ocorreu um erro inesperado".

## Tasks

1. Extend `functions/src/error-messages.ts` with new constants for: rate limit, field required, field too long, GPS errors, vote errors, location/user not found, admin-only/owner-only, body invalid, field invalid, etc.
2. Extend `functions/src/notifications/notification-messages.ts` (or split into `admin-notifications.ts`) with constants for: admin alerts (XP stale, DLQ, FCM, rate limit, etc.), weekly ranking, fake game invites.
3. Replace hardcoded HttpsError strings in all 20+ source files listed in the issues.
4. Replace hardcoded notification titles/bodies in `notifications/callable.ts`, `monitoring/alerting.ts`, `growth/weekly-ranking.ts`.
5. Normalize PT-BR in the constants themselves (apply during step 1 and 2, not as a separate sweep).
6. Run `npm run lint`, `npm run build`, `npx jest --no-coverage` to verify.
7. Update test assertions ONLY where a substring is genuinely removed (rare); prefer code-only assertions.

## Files affected (estimate)

Source:
- `functions/src/error-messages.ts` (extend)
- `functions/src/notifications/notification-messages.ts` (extend)
- `functions/src/notifications/admin-notifications.ts` (NEW)
- `functions/src/notifications/fake-notifications.ts` (NEW)
- `functions/src/voting/mvp-voting.ts` (replace ~27)
- `functions/src/voting/check-in.ts` (replace ~22)
- `functions/src/auth/verification.ts` (replace ~15)
- `functions/src/auth/pii-migration.ts` (replace ~11)
- `functions/src/auth/custom-claims.ts` (replace ~9)
- `functions/src/auth/anti-abuse.ts` (replace ~8)
- `functions/src/auth/invite-code.ts` (replace ~4)
- `functions/src/auth/profile-complete-claim.ts` (replace ~2)
- `functions/src/notifications/batch-sender.ts` (replace ~7)
- `functions/src/notifications/callable.ts` (replace ~5 + 5 fake games)
- `functions/src/middleware/secure-callable-wrapper.ts` (replace ~6)
- `functions/src/middleware/rate-limiter.ts` (replace ~2)
- `functions/src/middleware/require-profile-complete.ts` (replace ~2)
- `functions/src/cache/leaderboard-cache.ts` (replace ~5)
- `functions/src/locations/location-management.ts` (replace ~5)
- `functions/src/maintenance/soft-delete.ts` (extend — already partial)
- `functions/src/migration/invites-migration.ts` (extend — already partial)
- `functions/src/groups/join-requests.ts` (replace ~1)
- `functions/src/games/denormalize-location.ts` (replace ~3)
- `functions/src/xp/parallel-processing.ts` (replace ~3)
- `functions/src/growth/seed-official-groups.ts` (replace ~2)
- `functions/src/validation/guards.ts` (replace ~1)
- `functions/src/monitoring/alerting.ts` (externalize ~7 alert titles)
- `functions/src/growth/weekly-ranking.ts` (externalize 1)

Tests: maybe touch a few assertions if a substring is removed; aim for zero changes.

## Verification (DoD)

- [x] `cd functions && npm run build` (tsc) passes
- [x] `cd functions && npm run lint` passes
- [x] `cd functions && npx jest --no-coverage` passes
- [x] No public callable name changed
- [x] No HttpsError code changed
- [x] Existing test substring assertions preserved (`auth required`, `gameId`, `Categoria inválida`, `caracteres especiais`, `já votou`, `expirado`, `confirmados`, `dono do jogo`, `já havia sido`, `não autenticado`, `Rate limit excedido`, `unauthenticated`, `invalid-argument`, `not-found`, `permission-denied`, `failed-precondition`)

## Risks

- Low. Pure refactor of string literals — no business logic change.
- Some test files assert on message substrings; preserve the substrings.
- Bulk PR #2444 left partial infrastructure; this PR completes the work and actually closes the issues.
