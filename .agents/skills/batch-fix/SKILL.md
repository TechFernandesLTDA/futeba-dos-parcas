---
name: batch-fix
description: Corrige múltiplas issues similares em paralelo com agentes especialistas. Usar quando "corrigir todas as issues", "batch fix", "resolver em lote", "fix #X #Y #Z"
arguments: [issue_numbers]
disable-model-invocation: true
allowed-tools: Bash(gh *) Task Grep Glob Read Write Edit
---

# Batch Fix

Corrige múltiplas issues em paralelo, usando agentes especialistas por domínio.

## Fluxo

### 1. Coleta
Para cada issue em `$ARGUMENTS`:
```bash
gh issue view <N> --json title,body,labels
```

### 2. Agrupamento
Agrupar issues por domínio:
- **web**: telas, componentes, hooks, estilos
- **android**: Compose, ViewModels, resources
- **functions**: Cloud Functions, triggers, callables
- **firestore**: rules, indexes, schema

### 3. Paralelização
Lançar 1 agent por domínio, cada um recebendo seu lote de issues:
```
Task(description="Fix web issues #630-#642", subagent="general", prompt="...")
Task(description="Fix android issues #659,#667,#668,#673", subagent="general", prompt="...")
Task(description="Fix functions issues #644-#654", subagent="general", prompt="...")
```

### 4. Consolidação
- Cada agente retorna lista de arquivos alterados e mudanças feitas
- Verificar consistência entre agentes (sem conflitos de merge)
- Rodar build global: `npm run build` (web + functions)

### 5. Commit + PR
- Um commit único com todos os fixes
- PR com checklist de issues fechadas
- `gh pr merge --admin --squash`

### 6. Fechamento
```bash
for issue in <lista>; do gh issue close $issue -c "Resolvido em #<PR>"; done
```

## Padrões de eficiência

- **Máximo 5 agentes paralelos** — mais que isso causa contenção de I/O
- **Agrupar por domínio** — cada agente especializado em seu stack
- **Validar após cada agente** — build parcial antes do merge global
- **Conventional Commits** — `fix(escopo): descrição`

## Exemplo
```
/batch-fix 630 631 632 633 634 635 636 637 638 639 640 641 642
```
→ Agrupa por web/android/functions → lança 3 agentes → consolida → PR único
