---
name: futeba-pr-flow
description: Cria branch + commit Conventional Commits + push + PR via gh + admin merge. NUNCA push direto a master neste projeto. Use sempre que precisar persistir mudanças (não importa quão pequenas) — feature, bugfix, docs, ci, chore.
---

# Futeba PR Flow

Workflow obrigatório para qualquer mudança no repo.

## Regras inegociáveis

1. **NUNCA `git push origin HEAD:master`** — bloqueado por proteção de branch
2. Sempre branch + PR + admin merge
3. Conventional Commits enforce via husky (`commitlint.config.js`)
4. Para mudanças em `.github/workflows/**`: token gh precisa scope `workflow` (`gh auth refresh -s workflow` se primeira vez)

## Padrão de commit messages

```
<tipo>(<escopo>): <descrição em PT-BR, imperativo, <70 chars>

<corpo opcional explicando o WHY>

Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>
```

Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci`, `build`

Escopos comuns: `android`, `web`, `functions`, `kmp`, `ci`, `deps`, `backend`, `firestore`, `hosting`

## Workflow completo

```bash
# 1. Worktree limpo de origin/master
WORK_DIR=/tmp/futeba-work-$$
git worktree add -b Codex/<scope-description> "$WORK_DIR" origin/master
cd "$WORK_DIR"

# 2. Fazer mudanças (Edit/Write)

# 3. Validar localmente (depende do escopo)
# Functions: cd functions && npm run build && npm run lint
# Android: ./gradlew compileDebugKotlin
# Web: cd web && npm run build

# 4. Commit
git add <arquivos-específicos>  # NUNCA git add -A
git commit -m "$(cat <<'EOF'
fix(scope): descrição curta

Corpo explicando WHY.

Co-Authored-By: Codex Opus 4.7 <noreply@anthropic.com>
EOF
)"

# 5. Push + PR + Merge
git push -u origin Codex/<scope-description>
PR_URL=$(gh pr create --base master --title "..." --body "## Summary\n\n## Test plan\n\n🤖 Generated with [Codex](https://Codex.com/Codex)")
gh pr merge --repo TechFernandesLTDA/futeba-dos-parcas --admin --squash --delete-branch Codex/<scope-description>

# 6. Cleanup worktree
git worktree remove --force "$WORK_DIR"
```

## PR body template

```markdown
## Summary

- Mudança 1
- Mudança 2

## Test plan

- [x] Build passou
- [x] Lint clean
- [x] Manual smoke test em <feature>

## Risks

(opcional — se mudança afeta produção)

🤖 Generated with [Codex](https://Codex.com/Codex)
```

## Casos especiais

### Workflow files
Se PR toca `.github/workflows/**`:
- Verifique gh auth scopes: `gh auth status | grep scope` (precisa `workflow`)
- Se faltar: `gh auth refresh -s workflow` (user faz isso)

### Stack PRs
Se PR depende de outro PR aberto:
- `--base <other-branch>` em vez de `--base master`
- Após PR base mergear, retargete: `gh pr edit <N> --base master`

### Conflict resolution
Se merge falha por conflito:
- `gh pr update-branch <N>` (auto-merge master)
- Se conflito persiste: criar novo branch from master + cherry-pick + close PR antigo
