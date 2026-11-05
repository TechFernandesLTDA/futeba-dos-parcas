---
name: audit-batch
description: Executa auditoria completa em lote com agentes paralelos. Usar quando "auditar", "scan", "verificar padrões", "garantir consistência", "rodar auditoria"
context: fork
agent: Explore
allowed-tools: Bash(git *) Bash(gh *) Grep Glob Read
---

# Auditoria em Lote

Executa auditoria automatizada no codebase, varrendo múltiplos arquivos em paralelo com agentes especialistas.

## Fluxo

1. **Scan de patterns** — roda `grep` para hardcoded colors, deprecated APIs, fontSizes violando WCAG, `as any`, imports não usados
2. **Categorização** — classifica achados por severidade: CRITICAL, HIGH, MEDIUM, LOW
3. **Criação de issues** — `gh issue create` para cada categoria (agrupando similares)
4. **Sugestão de fixes** — propõe código de correção quando o padrão é mecânico

## Patterns a escanear

!`cat ${CLAUDE_PROJECT_DIR}/.Codex/rules/web-react.md 2>/dev/null | grep -A2 "NUNCA\|sempre\|obrigatorio\|Hardcoded"`

## Categorias de auditoria

| Categoria | Pattern | Severidade |
|-----------|---------|------------|
| Cores hardcoded | `'#...'` / `"#..."` fora de theme/ | HIGH |
| Tipografia | `fontSize: '0.6rem'` ou `0.7rem` | HIGH |
| Deprecated | `ListItem button`, `ListItemSecondaryAction` | MEDIUM |
| Type safety | `as any` | MEDIUM |
| Tokens MUI | `'white'`, `'#fff'`, `'#ffffff'` | HIGH |
| Imports | `import { X }` não usado | LOW |

## Output

Gera relatório no formato:
```
### Categoria: Hardcoded Colors (HIGH)
- `file.tsx:123` — `color: '#333'` → `color: 'text.primary'`
- `file.tsx:456` — `bgcolor: '#fff'` → `bgcolor: 'background.paper'`
```

Depois pergunta se deve criar issues e aplicar fixes automaticamente.
