---
name: context-pack
description: Empacota contexto completo de uma issue/feature para consumo eficiente. Usar quando "contexto da issue X", "o que preciso saber sobre", "resumo da feature", "levantar requisitos"
arguments: [issue_number]
context: fork
agent: Explore
allowed-tools: Bash(gh *) Grep Glob Read
---

# Context Pack

Empacota todo contexto necessário para resolver a issue `$0` em um único bloco coeso.

## O que extrair

### 1. Issue body
```bash
gh issue view $0 --json title,body,labels,assignees,comments
```

### 2. PRs relacionados
```bash
gh issue view $0 --json closedByPullRequestsReferences
```

### 3. Specs referenciadas
```bash
grep -rl "#$0" specs/ 2>/dev/null
```

### 4. Arquivos tocados
Se houver PRs linkados, extrair `files changed` de cada um e agrupar por diretório.

### 5. AGENTS.md rules aplicáveis
Verificar `.Codex/rules/` por regras relevantes ao domínio da issue (web, android, functions, firestore).

### 6. Agent memory
```bash
grep -rl "$0" .Codex/agent-memory/ 2>/dev/null
```

### 7. Padrões de código
Se a issue menciona um arquivo/componente específico, ler o componente e 2-3 vizinhos similares para entender convenções.

## Output esperado

```markdown
## Issue #XXX: Título

**Status**: OPEN | **Labels**: bug, web, priority:high
**Criada**: 2026-05-09 | **Assignees**: ninguém

### Descrição
[body resumido]

### Arquivos relevantes
- `web/src/pages/foo/FooScreen.tsx` (principal)
- `web/src/hooks/useFoo.ts` (hook relacionado)
- `web/src/types/foo.ts` (tipos)

### Regras aplicáveis
- `.Codex/rules/web-react.md`: Pattern de catch com feedback UI
- `AGENTS.md`: "Nunca hardcode colors"

### Contexto adicional
- Spec relacionada: `specs/feat-2026-05-08-foo.md`
- Memory: `.Codex/agent-memory/backend-validator/project_foo.md`

### Padrões de código
[trechos dos componentes vizinhos mostrando padrão]
```

## Instruções

1. Execute os comandos acima para coletar dados
2. Leia os arquivos relevantes (especialmente os principais)
3. Monte o pacote de contexto no formato acima
4. Apresente junto com: "Pronto para implementar. Quer que eu comece?"
