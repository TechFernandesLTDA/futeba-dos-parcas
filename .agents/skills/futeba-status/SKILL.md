---
name: futeba-status
description: Snapshot completo de saúde do projeto Futeba dos Parças — master HEAD, pipeline CI, runners self-hosted, RAM, hosting, Dependabot alerts, PRs/issues. Use quando o usuário pedir "status", "saúde do projeto", "como está o CI", ou após operações que tocam pipeline/deploy.
---

# Futeba Status

Reporta saúde de TODOS os componentes em uma vista consolidada. ~30s.

## Execução

Rode em paralelo via `mcp__plugin_context-mode_context-mode__ctx_batch_execute` (preferido — output controlado):

```bash
# Master HEAD
gh api repos/TechFernandesLTDA/futeba-dos-parcas/commits/master -q '"\(.sha[0:7])  \(.commit.message | split("\n")[0])"'

# Pipeline overall (last 30)
gh run list --repo TechFernandesLTDA/futeba-dos-parcas --limit 30 --json status,conclusion -q '[.[]] | group_by(.status + "/" + (.conclusion // "-")) | map({key: (.[0].status + "/" + (.[0].conclusion // "-")), count: length}) | sort_by(-.count)'

# Master pipeline last 6 workflows
gh run list --repo TechFernandesLTDA/futeba-dos-parcas --branch master --limit 6 --json status,conclusion,workflowName -q '.[] | "\(.conclusion // .status)\t\(.workflowName)"'

# In progress + queued
gh run list --repo TechFernandesLTDA/futeba-dos-parcas --status in_progress --limit 5 --json workflowName,headBranch -q '.[] | "\(.workflowName)\t\(.headBranch)"'
gh run list --repo TechFernandesLTDA/futeba-dos-parcas --status queued --limit 5 --json workflowName,headBranch -q '.[] | "\(.workflowName)\t\(.headBranch)"'

# Runners
gh api repos/TechFernandesLTDA/futeba-dos-parcas/actions/runners -q '.runners[] | "\(.name)\t\(.status)\tbusy=\(.busy)"' | sort

# RAM (somente se runner self-hosted local)
vm_stat | head -3 | awk '/free/ {printf "Free RAM: %.1f GB\n", $3 * 16384 / 1024 / 1024 / 1024}'

# Hosting + PRs + Issues + Dependabot
curl -sI https://futebadosparcas.web.app | head -1
gh pr list --repo TechFernandesLTDA/futeba-dos-parcas --state open --json number,title
gh issue list --repo TechFernandesLTDA/futeba-dos-parcas --state open --json number,title
gh api repos/TechFernandesLTDA/futeba-dos-parcas/dependabot/alerts --paginate -q '[.[] | select(.state=="open") | .security_advisory.severity] | group_by(.) | map({severity: .[0], count: length})'
```

## Output esperado

Tabela markdown com:
- Master HEAD + último commit
- Pipeline overall (success/failure/in_progress/queued counts)
- Workflows mais recentes em master
- Runners online + busy
- RAM livre (se aplicável)
- Hosting status (200/erro)
- PRs/issues abertas
- Dependabot alerts por severidade

Sempre destaque o que requer atenção (ex: pipeline com >2 failures recentes, RAM <2GB, PR/issue acumulado).
