# Project Map

Last updated: 2026-06-21

This is the operational map for the Futeba dos Parcas repository. Use it when you need to decide where a change belongs, which commands validate it, and which boundaries must not be crossed.

## Quick Context

- Repository: `TechFernandesLTDA/futeba-dos-parcas`
- Default branch: `master`
- Merge policy: squash merge only, one approving review and code owner review required.
- Production web URL: `https://futebadosparcas.web.app`
- Runtime for `web/` and `functions/`: Node 22 from `.nvmrc`.
- Main backend: Firebase Auth, Firestore, Cloud Functions v2, App Check.
- Dormant backend: `archive/backend/` is archived and has no production consumers.

## Folder Ownership

| Path | Purpose | Work Normally Done Here |
| --- | --- | --- |
| `app/` | Native Android app with Jetpack Compose | Android UI, ViewModels, Koin wiring, Android-only Firebase integration, widgets |
| `shared/` | Kotlin Multiplatform shared module | Shared domain models, validators, business rules, platform abstractions |
| `composeApp/` | Compose Multiplatform app layer | iOS/CMP UI parity, shared UI surfaces, platform-specific CMP entry points |
| `iosApp/` | iOS host app | Swift host shell, Firebase iOS files, iOS release notes |
| `web/` | React/Vite/MUI web app | Web screens, hooks, contexts, Firebase client access, PWA/Hosting surface |
| `functions/` | Firebase Cloud Functions | Callables, triggers, anti-abuse, maintenance jobs, server-side game/league logic |
| `firestore.rules` | Firestore security rules | Client/server permission model and security hardening |
| `firestore-rules-tests/` | Rules test suite | Auth/role/rules regression tests |
| `specs/` | Spec-Driven Development records | Feature specs, bugfix specs, decision log, audit reports |
| `docs/` | Human and agent documentation | Operational guides, architecture notes, QA matrix, setup docs |
| `scripts/` | Maintenance and validation scripts | Data seeds, release helpers, migration utilities, one-off audits |
| `release-notes/` | Release note source files | Web, Android, iOS, Functions release notes |
| `.github/workflows/` | CI/CD | Build, test, release, deploy, security, labels and automation |
| `baselineprofile/` | Android baseline profile generation | Startup/performance profile generation |
| `macrobenchmark/` | Android macrobenchmark | Startup/navigation/performance benchmark suites |
| `archive/backend/` | Archived Express/TypeORM backend | Do not develop without a new spec and explicit decision |

## Code Boundaries

- Web does not consume the KMP `shared` module. Web data access goes through `web/src/hooks/`, `web/src/contexts/`, and `web/src/services/firebase.ts`.
- Android shared/domain work belongs in `shared/` only when it is genuinely cross-platform. Android-only UI state belongs in `app/`.
- Cloud Functions are the production server backend. Do not treat `archive/backend/` as active.
- CPF validation exists in three places and must stay in sync:
  - `functions/src/validation/cpf.ts`
  - `web/src/utils/cpfValidator.ts`
  - `shared/.../CpfValidator.kt`
- Release/changelog changes often need multiple surfaces:
  - `CHANGELOG.md`
  - `versions.json`
  - `release-notes/`
  - app/web public release note files

## Main Workflows

### Web

```bash
cd web
nvm use
npm run build
npm run lint
npm test
npm run dev
```

Deploy:

```bash
cd web
nvm use
npx firebase deploy --only hosting --project futebadosparcas
```

### Functions

```bash
cd functions
nvm use
npm run build
npm run lint
npx jest --no-coverage
```

Targeted auth/onboarding suites:

```bash
cd functions
nvm use
npx jest --no-coverage test/auth/anti-abuse.test.ts test/auth/verification.test.ts test/auth/profile-complete-claim.test.ts
```

### Android

```bash
./gradlew :app:compileDebugKotlin
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
./gradlew lint
./gradlew detekt
```

When only syntax feedback is needed, prefer `:app:compileDebugKotlin` before the heavier tasks.

### Firestore Rules

```bash
cd firestore-rules-tests
npm test
```

### GitHub Remote

```bash
gh pr list --repo TechFernandesLTDA/futeba-dos-parcas
gh issue list --repo TechFernandesLTDA/futeba-dos-parcas --state open
gh run list --repo TechFernandesLTDA/futeba-dos-parcas --limit 20
```

Auto-generated version bump PRs are intentionally closed and handled in batches.

## High-Risk Areas

- Auth, onboarding, CPF, phone/SMS, App Check, and custom claims.
- Game lifecycle automation: scheduled games, realized games, stale games, confirmations, XP, standings.
- Firestore rules and Functions triggers that enforce role/ownership permissions.
- Cross-platform design tokens, theme colors, dynamic color and release-note drift.
- Any change touching both client and Functions without matching emulator/rules coverage.

## Documentation Entry Points

- `AGENTS.md`: short, current assistant rules and gotchas.
- `CLAUDE.md`: deeper coding and architecture instructions.
- `docs/AGENT_OPERATING_MODEL.md`: how to use Rawls, James, Hypatia and Plato.
- `docs/QA_SMOKE_MATRIX.md`: repeatable QA and E2E validation matrix.
- `docs/BUSINESS_RULES.md`: XP, game lifecycle and league behavior.
- `specs/DECISIONS.md`: architectural decision log.
