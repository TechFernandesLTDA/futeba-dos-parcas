# Futeba Codex Agent Team

Project-scoped custom agents for `TechFernandesLTDA/futeba-dos-parcas`. Codex loads each TOML file as a selectable/delegable agent in new tasks opened from this trusted repository.

## Routing by cost and risk

| Lane | Agents | Default use |
| --- | --- | --- |
| Lowest-cost discovery | Repo Scout, Performance Dependency Auditor | Read-only search, inventories, command probes, narrow audits |
| Focused support | Test Engineer, Visual Accessibility QA, CI GitHub Operator, Spec Docs Editor | Tests, QA, CI evidence, docs and specs |
| Normal implementation | Web UI Engineer, Android Compose Engineer, iOS CMP Engineer | Clearly bounded platform slices |
| High-risk implementation | Web Data Engineer, KMP Domain Engineer, Functions Engineer, Firestore Security Engineer, Gamification Guardian, Release Manager, Data Migration Engineer | Data consistency, permissions, transactions, release and migration risk |
| Frontier judgment | Futeba Coordinator, Solution Architect, Identity Risk Auditor | Integration and genuinely cross-cutting or security-critical decisions |

## Token-efficiency policy

1. Use no subagent when the parent can answer with one targeted `rg` or one validation command.
2. Start with one specialist. Add a reviewer only when the risk or ownership boundary justifies it.
3. Run agents in parallel only for independent read-only questions or disjoint file families.
4. Use Repo Scout before a strong model only when ownership or root cause is genuinely unknown.
5. Give every worker a narrow task, owned paths, off-limits paths, one validation command, and the required handoff shape.
6. Do not send whole logs or broad file dumps. Return summaries, exact paths, failing lines, and commands.
7. The parent reads every diff, resolves conflicts, runs final checks, and owns release/deploy decisions.
8. `archive/backend/` is always out of scope without an approved SDD spec that explicitly reactivates it.

## Parallelism

The catalog contains 20 roles, but it is not a request to run all 20. The current Codex task exposes four concurrent slots (parent plus three workers). Prefer one or two workers; use all three only when their scopes cannot overlap.

## Required handoff

```text
Scope:
Files changed (or routes/viewports covered):
Commands run:
Result:
Risks or gaps:
Next recommended step:
```
