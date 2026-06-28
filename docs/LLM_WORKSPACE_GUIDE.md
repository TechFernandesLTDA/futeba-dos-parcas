# LLM Workspace Guide

Last updated: 2026-06-28

This guide is the short, current entrypoint for language models and AI coding agents working in this repository. Prefer it before loading broader historical docs.

## Read Order

1. `AGENTS.md` for mandatory repo rules, commands, gotchas and release discipline.
2. `docs/PROJECT_MAP.md` for folder ownership and code boundaries.
3. This file for context-budget strategy and task routing.
4. Feature-specific files only after the target area is known:
   - `docs/BUSINESS_RULES.md` for XP, games, standings and lifecycle rules.
   - `docs/QA_SMOKE_MATRIX.md` for release or visual QA.
   - `docs/RELEASE_PROCESS.md` for user-visible deploys.
   - `specs/DECISIONS.md` for architectural decisions.

Avoid loading `docs/archive/`, `.claude/agent-memory/`, old audit reports, generated bundles, `dist/`, `node_modules/`, Gradle build outputs or lockfile-sized data unless the task explicitly needs them.

## Source Of Truth

| Topic | Source |
| --- | --- |
| Platform versions | `versions.json` |
| Web version | `web/package.json` plus `release-notes/web/<version>.md` |
| Release notes | `release-notes/<platform>/<version>.md` |
| Published release-note bundles | `web/public/release-notes.json`, `app/src/main/assets/release-notes.json`, `iosApp/iosApp/release-notes.json`, `composeApp/src/commonMain/composeResources/files/release-notes.json` |
| Branch and PR rules | `AGENTS.md`, `.github/settings.yml`, `.github/CODEOWNERS` |
| Firestore model and indexes | `firestore.rules`, `firestore.indexes.json`, `functions/src/`, `web/src/hooks/` |
| XP invariants | `docs/xp_audit/XP_SPEC.md`, `docs/xp_audit/XP_INVARIANTS.md`, `docs/BUSINESS_RULES.md` |

## Task Routing

| User Intent | Start Here | Validate With |
| --- | --- | --- |
| Web UI or mobile web bug | `web/src/pages/`, `web/src/components/`, `web/src/hooks/` | `cd web && npm run lint && npm run build` plus targeted tests |
| Android UI or ViewModel | `app/src/main/java/com/futebadosparcas/ui/` | `./gradlew :app:compileDebugKotlin` then targeted unit tests |
| Shared domain or validator | `shared/src/` and matching platform implementations | Android compile plus affected web/functions tests when parity exists |
| Cloud Functions | `functions/src/`, `functions/test/` | `cd functions && npm run build && npm run lint && npx jest --no-coverage` |
| Firestore rules/indexes | `firestore.rules`, `firestore.indexes.json`, `firestore-rules-tests/` | `cd firestore-rules-tests && npm test` |
| Release/deploy | `versions.json`, `release-notes/`, `CHANGELOG.md`, platform package files | `node scripts/release-notes.js validate/changelog/bundle`, build, CI, tag/release |
| GitHub hygiene | `.github/`, issue/PR state via `gh` | PR checks, branch protection, release notes |

## Context Budget Rules

- Search before reading. Use `rg`/`git grep` for symbols, routes, hooks, tests and release versions.
- Read the narrowest file slice that answers the question; avoid whole-file dumps for large files.
- Treat `docs/archive/` and `.claude/agent-memory/` as historical evidence, not current rules.
- Prefer current code over old reports when they disagree.
- Keep generated files out of analysis unless checking release-note publication or deployed metadata.
- When a tool or hook changes the working tree to a detached PR ref, refetch and restore `master` before editing:

```bash
git fetch origin master --prune
git switch -C master origin/master
```

## Current Operational Facts

- Production web URL: `https://futebadosparcas.web.app`
- Default branch: `master`
- Merge policy: squash merge only, protected branch, code owner review required.
- Node runtime for `web/` and `functions/`: use `.nvmrc` (`Node 22` currently).
- Main backend: Firebase Auth, Firestore, Cloud Functions v2 and App Check.
- Archived backend: `archive/backend/` is dormant and has no production consumers.

## Do Not Drift

For any user-visible deploy, update and verify all relevant surfaces:

- `versions.json`
- platform-native package/build file
- `release-notes/<platform>/<version>.md`
- generated release-note bundles
- `CHANGELOG.md`
- GitHub PR, tag and Release
- README/docs when behavior, setup, version, deployment or release process changes

If this checklist cannot be completed, say exactly what is missing before claiming the release is done.
