# GitHub Status

Last verified: 2026-07-16

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
| Production web URL | `https://futebadosparcas.com.br` |

## Current Queue

| Queue | Count |
|-------|-------|
| Open issues | 0 after #3712 closes with this governance change |
| Open pull requests | 0 |

## Branch Protection

`master` is protected with:

- Pull request required: enabled
- Required approving reviews: 0
- CODEOWNERS file: valid; required review disabled
- Dismiss stale reviews: disabled
- Last push approval: disabled
- Required CI gates: `Lighthouse CI`, `Validate PR`, `Android CI Gate`, `Web CI Gate`
- Force pushes: disabled
- Branch deletion: disabled

## Latest Releases

| Platform | Version | GitHub tag |
|----------|---------|------------|
| Web | `1.54.21` | `web-v1.54.21` |
| Functions | `1.10.2` | `functions-v1.10.2` |
| Android | `1.38.1` | `android-v1.38.1` |
| iOS | `1.6.3` | `ios-v1.6.3` (pre-store) |

`versions.json` is the source of truth for platform versions. `release-notes/`
is the source of truth for changelog and release-note generation.

## Maintenance Checklist

Use this checklist after meaningful GitHub or release work:

- Confirm `gh issue list --state open` and `gh pr list --state open`.
- Confirm `master` still requires a PR and the four CI gates, with zero mandatory approvals and advisory CODEOWNERS.
- Keep `README.md`, `docs/README.md`, `docs/PROJECT_MAP.md`, `CHANGELOG.md`,
  `versions.json` and `release-notes/` aligned when a user-visible release ships.
- Do not deploy user-visible web/functions changes without versioning, changelog,
  release notes, tag/release and post-deploy reporting.
- For docs-only changes, do not bump app/platform versions unless behavior,
  deploy output or user-facing metadata changed.
