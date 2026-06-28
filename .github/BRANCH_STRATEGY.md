# Branch Strategy — Futeba dos Parças

Last updated: 2026-06-28

## Current Model

`master` is the production/default branch. Work is done through short-lived
branches and merged by squash PR after review and CI.

```text
master
  ├── codex/<short-description>
  ├── feature/<short-description>
  ├── fix/<short-description>
  ├── docs/<short-description>
  ├── chore/<short-description>
  └── hotfix/<short-description>
```

There is no active `develop` integration branch in the current repository flow.
Do not create or target `develop` unless a new decision in `specs/DECISIONS.md`
explicitly reintroduces it.

## Protected Branch

| Branch | Purpose | Protection |
|--------|---------|------------|
| `master` | Production/default branch | PR required, 1 approval, CODEOWNERS review, stale review dismissal |

`master` protection:

- Required approving reviews: 1
- CODEOWNERS review: enabled
- Dismiss stale reviews: enabled
- Force pushes: disabled
- Branch deletion: disabled
- Squash merge only
- Delete branch on merge: enabled

## Branch Prefixes

| Prefix | Use |
|--------|-----|
| `codex/` | AI-assisted implementation/documentation work |
| `feature/` | New feature with approved spec |
| `fix/` | Bug fix |
| `docs/` | Documentation only |
| `chore/` | Tooling, CI, repo maintenance |
| `release/` | Platform release preparation |
| `hotfix/` | Urgent production fix |

Use kebab-case and keep names short, for example:

```bash
codex/docs-github-housekeeping
fix/web-player-card-stats
feature/group-polls
```

## Commits

Use Conventional Commits:

```text
feat: add post-game highlights
fix: correct player card statistics source
docs: update github status
chore: audit xp log source integrity
```

Common types:

| Type | Meaning |
|------|---------|
| `feat` | User-facing feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Tests |
| `refactor` | Behavior-preserving code restructure |
| `perf` | Performance improvement |
| `chore` | Build, tooling, maintenance |

## Pull Requests

Every PR should include:

- Clear summary and validation commands.
- Linked issue/spec when applicable.
- Screenshots or videos for visual UI changes.
- Release/versioning notes for user-visible changes.
- CI green before merge.

Docs-only PRs do not require platform version bumps unless they change
user-facing app metadata, deployed content or release artifacts.

## Releases

User-visible deploys must follow `docs/RELEASE_PROCESS.md`:

- Bump affected platform versions via `versions.json` and native files.
- Add `release-notes/<platform>/<version>.md`.
- Regenerate `CHANGELOG.md` and bundles with `scripts/release-notes.js`.
- Create a GitHub tag/release using the repo convention.
- Report deployed platform, version, tag/release, changelog and URL.

Do not silently deploy user-visible changes.
