# Agent Operating Model

Last updated: 2026-06-21

This project works best when agents have stable responsibilities. The coordinator should split work into non-overlapping slices, keep GitHub/CI state coherent, and integrate results after validation.

## Active Project Agents

| Agent | Primary Role | Best Used For | Avoid Using For |
| --- | --- | --- | --- |
| Rawls | Product, rules and risk | Acceptance criteria, security implications, onboarding gates, CPF/SMS rules, permission logic | Broad code edits without a narrow scope |
| James | Implementation and operations | Web/Android/Functions changes, CI, deploy, GitHub PR hygiene, release chores | Independent final approval of own code |
| Hypatia | Deep review and edge cases | Architecture review, data consistency, league/game stats, test gaps, invariants | Fast mechanical fixes |
| Plato | QA/E2E specialist | Smoke matrix, Playwright, mobile web regressions, onboarding validation, visual/browser checks | Feature design ownership |

## Default Delegation Pattern

1. Coordinator reads the request and identifies independent work slices.
2. Rawls checks rules, acceptance criteria and user-impact risks.
3. James implements or operates the concrete change.
4. Hypatia reviews architecture, invariants and missing tests.
5. Plato validates flows, viewports, regressions and smoke coverage.
6. Coordinator integrates, runs final checks, updates GitHub/deploy notes and reports status.

Not every task needs every agent. For small changes, use one worker plus final coordinator verification.

## When To Spawn Plato

Use Plato when a task touches:

- login, register, Google auth, logout or redirects;
- CPF, phone/SMS, App Check or onboarding sequence;
- mobile web, top bar, bottom nav, scroll restoration, forms with mobile keyboard;
- games/league flows users navigate repeatedly;
- visual regression, screenshots, Lighthouse or Playwright;
- release/deploy smoke validation.

Expected Plato output:

- routes and viewports tested;
- commands run;
- failures with reproduction steps;
- screenshots or paths when available;
- clear split between product bug, environment issue and test/tooling issue.

## Existing Local Specialist Prompts

The repo also contains reusable local agent prompts under `.claude/agents/`:

| Prompt | Suggested Use |
| --- | --- |
| `adaptive-ui-architect.md` | Adaptive UI, responsive layouts, Material 3 / platform design review |
| `backend-validator.md` | Functions, server invariants, emulator validation and backend risk |
| `firestore-master.md` | Firestore rules, query shape, indexes and security model |
| `web-frontend-dev.md` | Web implementation, MUI patterns, React hooks and route-level polish |
| `xp-engine-guardian.md` | XP, ranking, badges, standings and game result consistency |

These prompts are guidance assets, not a replacement for current repo commands and branch state.

## Write-Scope Rules

- Give each worker explicit ownership of files or modules.
- Never ask two agents to edit the same screen/module at the same time.
- Tell every agent that other edits may exist and must not be reverted.
- For parallel implementation, prefer slices like:
  - `functions/src/games/**` + `functions/test/**`
  - `web/src/pages/onboarding/**` + related Vitest files
  - `app/src/main/java/.../ui/onboarding/**` + Android tests
  - docs-only files

## GitHub Hygiene

- Keep one active PR per coherent batch.
- Close automatic version bump PRs when they appear; versioning is handled in release batches.
- Label work by area (`web`, `android`, `cloud-functions`, `firebase`) and status (`status:review`, `status:in-progress`).
- Do not close epic issues merely because a child task advanced.
- Mark leaf issues as `status:review` when a PR implements them but has not merged.

## Handoff Format

Agents should report:

```text
Scope:
Files changed:
Commands run:
Result:
Risks or gaps:
Next recommended step:
```

For QA-only work, replace `Files changed` with `Routes/viewports covered`.

## Escalation

Ask before:

- deleting branches that do not map to a merged/closed PR;
- changing branch protection, secrets, environments or Firebase billing;
- merging protected PRs without required review;
- running destructive data scripts outside emulator/staging;
- sending real SMS tests in production with real phone numbers.
