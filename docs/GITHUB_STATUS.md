# GitHub Status

Last verified: 2026-06-29

Operational status for `TechFernandesLTDA/futeba-dos-parcas`.

## Repository

| Item | Status |
|------|--------|
| Visibility | Private |
| Default branch | `master` |
| Merge strategy | Squash merge only |
| Delete branch on merge | Enabled |
| Wiki | Disabled |
| Issues | Enabled |
| Projects | Enabled |
| Production web URL | `https://futebadosparcas.web.app` |

## Current Queue

| Queue | Count |
|-------|-------|
| Open issues | 27 |
| Open pull requests | 0 |

## Branch Protection

`master` is protected with:

- Required approving reviews: 1
- CODEOWNERS review: enabled
- Dismiss stale reviews: enabled
- Last push approval: disabled
- Force pushes: disabled
- Branch deletion: disabled

## Latest Releases

| Platform | Version | GitHub tag |
|----------|---------|------------|
| Web | `1.43.16` | `web-v1.43.16` |
| Functions | `1.2.8` | `functions-v1.2.8` |
| Android | `1.32.1` | see `versions.json` and `release-notes/android/` |
| iOS | `1.6.0` | pre-store release note, `published: false` |

`versions.json` is the source of truth for platform versions. `release-notes/`
is the source of truth for changelog and release-note generation.

## Maintenance Checklist

Use this checklist after meaningful GitHub or release work:

- Confirm `gh issue list --state open` and `gh pr list --state open`.
- Confirm `master` branch protection still requires one approving review and CODEOWNERS.
- Keep `README.md`, `docs/README.md`, `docs/PROJECT_MAP.md`, `CHANGELOG.md`,
  `versions.json` and `release-notes/` aligned when a user-visible release ships.
- Do not deploy user-visible web/functions changes without versioning, changelog,
  release notes, tag/release and post-deploy reporting.
- For docs-only changes, do not bump app/platform versions unless behavior,
  deploy output or user-facing metadata changed.
