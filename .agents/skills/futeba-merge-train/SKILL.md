---
name: futeba-merge-train
description: Mergeia múltiplos PRs em sequência ordenada com admin merge, resolve conflitos, lida com PR stack/dependências. Use quando há 3+ PRs abertos do mesmo escopo OU PRs encadeados.
---

# Futeba Merge Train

Sequência segura de merges múltiplos com proteção contra cascade failures.

## Quando usar

- 3+ PRs prontos pra merge com dependência ordenada
- PR stack (PR#2 depende de PR#1)
- Bulk merge de Dependabot patches
- Pós-multi-agent (vários PRs criados em paralelo)

## Princípios

1. **Sempre admin merge** (`--admin --squash --delete-branch`) — branch protection bloqueia direto
2. **Atualiza branch antes**: `gh pr update-branch <N>` para mergear master into PR
3. **Re-target stacked PRs**: se PR#2 tinha base PR#1 branch, após PR#1 merge → `gh pr edit <PR#2> --base master`
4. **Cherry-pick em conflito**: se update-branch falha, criar branch new + cherry-pick + close old PR

## Workflow

```bash
# 1. Listar PRs abertos
gh pr list --repo TechFernandesLTDA/futeba-dos-parcas --state open --json number,title,headRefName,baseRefName

# 2. Ordenar por dependência (topological)
# - PRs sem deps primeiro (base = master)
# - PRs stacked depois (base = outra branch)

# 3. Para cada PR em ordem:
PR_NUM=N
gh pr update-branch $PR_NUM --repo TechFernandesLTDA/futeba-dos-parcas
sleep 2
gh pr merge $PR_NUM --repo TechFernandesLTDA/futeba-dos-parcas --admin --squash --delete-branch
sleep 1
gh pr view $PR_NUM --repo TechFernandesLTDA/futeba-dos-parcas --json state,mergedAt -q '{state, mergedAt}'

# 4. Para PR stacked (base era branch já mergeada):
gh pr edit $PR_NUM --base master --repo TechFernandesLTDA/futeba-dos-parcas
gh pr update-branch $PR_NUM --repo TechFernandesLTDA/futeba-dos-parcas
gh pr merge $PR_NUM --repo TechFernandesLTDA/futeba-dos-parcas --admin --squash --delete-branch
```

## Resolução de conflito

Se `gh pr update-branch` falha com `Cannot update PR branch due to conflicts`:

```bash
# 1. Worktree em master atual
WORK_DIR=/tmp/futeba-rebase-$$
git worktree add -b Codex/<original-branch>-rebased "$WORK_DIR" origin/master
cd "$WORK_DIR"

# 2. Cherry-pick commit do PR conflitante
COMMIT=$(gh pr view <N> --repo TechFernandesLTDA/futeba-dos-parcas --json commits -q '.commits[-1].oid')
git cherry-pick $COMMIT

# 3. Resolver conflito manualmente (Edit tool)
# editar arquivos, git add, git cherry-pick --continue

# 4. Push novo branch + PR + merge + close PR antigo
git push -u origin Codex/<original-branch>-rebased
NEW_PR=$(gh pr create --base master --title "..." --body "Resolve conflito de PR #<N>")
gh pr merge --admin --squash --delete-branch Codex/<original-branch>-rebased
gh pr close <N> --comment "Substituído por novo PR sem conflito."

# 5. Cleanup
git worktree remove --force "$WORK_DIR"
```

## Permissions

PRs que tocam `.github/workflows/**` exigem token com scope `workflow`. Se merge falha:
```
refusing to allow an OAuth App to create or update workflow ... without `workflow` scope
```
User precisa rodar:
```bash
gh auth refresh -h github.com -s workflow
```
Depois retry merge.

## Auto-merge alternativa

Se quiser que merge aconteça automaticamente quando CI passar:
```bash
# Habilitar auto-merge no repo (1x):
gh api -X PATCH /repos/TechFernandesLTDA/futeba-dos-parcas -f allow_auto_merge=true

# Por PR (sem --admin):
gh pr merge <N> --repo TechFernandesLTDA/futeba-dos-parcas --auto --squash --delete-branch
```

NÃO combinar `--auto` + `--admin` (mutuamente exclusivos).

## Pós-merge train

1. Validar master HEAD: `gh api repos/TechFernandesLTDA/futeba-dos-parcas/commits/master -q .sha`
2. Cleanup worktrees: `git worktree list | grep agent- | awk '{print $1}' | xargs -I{} git worktree remove -f -f {}`
3. Trigger deploy se necessário: usar `futeba-deploy`
4. Validar pipeline: usar `futeba-status`
