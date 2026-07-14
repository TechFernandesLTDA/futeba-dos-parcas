# Agent Operating Model

Last updated: 2026-07-13

This project works best when agents have stable responsibilities. The coordinator should split work into non-overlapping slices, keep GitHub/CI state coherent, and integrate results after validation.

## Native Project Agent Catalog

The project-scoped Codex definitions live in `.codex/agents/`. The catalog has 20 distinct roles; it is a routing menu, not a request to run every role on every task.

| Agent | Model / effort | Primary ownership |
| --- | --- | --- |
| Futeba Coordinator | GPT-5.6 Sol / medium | Task decomposition, integration, final checks and release decision |
| Repo Scout | GPT-5.3 Codex Spark / low | Read-only file discovery, patterns and validation commands |
| Product Rules Analyst | GPT-5.4 / high | Acceptance criteria, business rules, permissions and platform parity |
| Solution Architect | GPT-5.6 Sol / high | Read-only cross-cutting architecture and failure-mode review |
| Web UI Engineer | GPT-5.4 / medium | React/MUI pages, components, forms, theme and responsive states |
| Web Data Engineer | GPT-5.4 / high | Hooks, contexts, Firebase client access, listeners and atomic writes |
| Android Compose Engineer | GPT-5.4 / medium | Android Compose UI, ViewModels, navigation and Koin |
| KMP Domain Engineer | GPT-5.4 / high | Shared models, validators, contracts and cross-platform domain logic |
| iOS CMP Engineer | GPT-5.4 / medium | Compose Multiplatform and iOS host/framework integration |
| Functions Engineer | GPT-5.4 / high | Cloud Functions v2, triggers, callables, jobs and server invariants |
| Firestore Security Engineer | GPT-5.4 / high | Rules, indexes, query compatibility and emulator security tests |
| Identity Risk Auditor | GPT-5.6 Sol / high | Read-only Auth, CPF, SMS, App Check and custom-claims audit |
| Gamification Guardian | GPT-5.4 / high | XP, badges, rankings, standings and game-result consistency |
| Test Engineer | GPT-5.4 Mini / medium | Unit, integration, emulator and regression tests |
| Visual Accessibility QA | GPT-5.4 Mini / medium | Read-only viewports, accessibility, PT-BR copy and smoke flows |
| CI GitHub Operator | GPT-5.4 Mini / medium | CI diagnosis, workflow files and PR/check evidence |
| Release Manager | GPT-5.4 / high | Version alignment, release notes, changelog and deployment gates |
| Spec Docs Editor | GPT-5.4 Mini / medium | SDD specs, decision records, guides and README synchronization |
| Performance Dependency Auditor | GPT-5.3 Codex Spark / low | Read-only dependency and performance evidence gathering |
| Data Migration Engineer | GPT-5.4 / high | Safe, dry-run-capable Firestore maintenance and migration scripts |

See `.codex/agents/README.md` for routing, token-efficiency rules and the required handoff.

## Default Delegation Pattern

1. The coordinator identifies the critical path and the smallest useful specialist set.
2. If ownership is unknown, Repo Scout performs a short read-only pass.
3. One implementation specialist owns each file family.
4. Add Product Rules Analyst, Solution Architect, Identity Risk Auditor, or Firestore Security Engineer only when the corresponding risk exists.
5. Add Test Engineer or Visual Accessibility QA for independent verification.
6. The coordinator reads every diff, integrates, runs final checks, updates GitHub/release notes when authorized, and reports status.

Not every task needs multiple agents. For small changes, use one worker plus final coordinator verification. The current app task permits the parent and up to three concurrent workers, but one or two workers are preferred for token efficiency.

## When To Spawn Visual Accessibility QA

Use Plato when a task touches:

- login, register, Google auth, logout or redirects;
- CPF, phone/SMS, App Check or onboarding sequence;
- mobile web, top bar, bottom nav, scroll restoration, forms with mobile keyboard;
- games/league flows users navigate repeatedly;
- visual regression, screenshots, Lighthouse or Playwright;
- release/deploy smoke validation.

Expected QA output:

- routes and viewports tested;
- commands run;
- failures with reproduction steps;
- screenshots or paths when available;
- clear split between product bug, environment issue and test/tooling issue.

## Legacy Agent Assets

The earlier role names remain useful as a mental model:

| Legacy name | Native equivalent |
| --- | --- |
| Rawls | Product Rules Analyst or Identity Risk Auditor |
| James | The platform implementation specialist plus CI GitHub Operator or Release Manager |
| Hypatia | Solution Architect, Firestore Security Engineer, or Gamification Guardian |
| Plato | Visual Accessibility QA plus Test Engineer |

The repo also retains reusable legacy prompts under `.claude/agents/`:

The repo also contains reusable local agent prompts under `.claude/agents/`:

| Prompt | Suggested Use |
| --- | --- |
| `adaptive-ui-architect.md` | Adaptive UI, responsive layouts, Material 3 / platform design review |
| `backend-validator.md` | Functions, server invariants, emulator validation and backend risk |
| `firestore-master.md` | Firestore rules, query shape, indexes and security model |
| `web-frontend-dev.md` | Web implementation, MUI patterns, React hooks and route-level polish |
| `xp-engine-guardian.md` | XP, ranking, badges, standings and game result consistency |

These prompts are guidance assets. Prefer the native `.codex/agents/*.toml` definitions in Codex tasks.

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
