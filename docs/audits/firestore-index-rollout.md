# Firestore index rollout — public games query

## Incident and root cause

Production `/?tab=1` raised `FAILED_PRECONDITION: The query requires an index`.
The supplied create_composite token decoded to `games` / `COLLECTION` with
`deleted_at ASC`, `status ASC`, `visibility ASC`, `dateTime ASC` and the implicit
`__name__ ASC`. `web/src/hooks/useGames.ts` and `GamesTab` confirmed that shape.

A read-only Admin SDK probe against project `futebadosparcas` / `(default)`
reproduced the exact supplied missing-index URL for the active public query.
The finished public query also failed for the corresponding DESC index.
Both declarations were already in the repository but absent in production.

Publishing the full manifest initially failed with HTTP 400 because
`league_seasons.is_active` was incorrectly represented as a one-field composite.
A single-field collection-group index belongs in `fieldOverrides`.

## Changes

- Move that declaration into a field override, keeping the default COLLECTION
  ASCENDING, DESCENDING and CONTAINS indexes and adding COLLECTION_GROUP ASCENDING.
- Publish indexes only; no Hosting, Functions, Firestore data or security-rule
  changes. The Firebase CLI compiles rules as a preflight but the selected target
  is `firestore:indexes`.
- Four pending games composites created: public ASC/DESC; soft-delete + group
  DESC; visibility + locationName ASC.
- No `--force`: six existing remote field overrides outside this manifest are
  retained. They should be reconciled separately before any future forced deploy.
- Add index contract tests and run them from Validate Patterns; include
  firestore.indexes.json in that workflow's push/PR path filters.

## Verification

Verified at 2026-10-07T23:02:27Z.

- Before: 172 composites. After: 176. All four new composites READY; all 172
  prior index resource names retained. No declared composite remains missing.
- league_seasons/is_active: all four configured single-field indexes READY.
- Production active-public-ascending query: success, no index error.
- Production finished-public-descending query: success, no index error.
- Both probes returned zero documents at the tested cutoff/filters. These checks
  prove index readiness/query execution, not the existence of visible games or
  a complete authenticated browser journey.
- Regression tests: two expected failures before the manifest change, four
  passes afterward. Combined index/reminders/workflow contracts: 11 passes.
- Independent read-only review: tf-qualidade / Vera, session
  `20261007_195816_26c812`; accepted the migration and requested separate READY
  verification, which was completed above.
- GitHub Actions remains blocked by startup_failure / BuildFailed; validation
  for this operational fix is local plus live Firestore, not a claimed CI pass.

Local reproduction and raw admin snapshots are under
`C:/Users/renan/AppData/Local/hermes/cache/scratch/futeba-index-fix/`.
The scratch directory is transient; the substantive outcome is recorded here.

## Prevention

Deploying only rules does not publish indexes. Emulator and mocked unit tests
can pass without real production composite indexes. A successful index deploy
submits an asynchronous build: verify READY and execute the affected production
query before reporting the incident resolved. Never use --force casually: it
would remove remote field overrides not represented in the manifest.
