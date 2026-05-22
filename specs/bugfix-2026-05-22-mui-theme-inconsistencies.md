# BUGFIX: Inconsistências no tema MUI — BottomNav light hardcoded, sombra card fraca, TextField dark border

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** AI Assistant
> **Data:** 2026-05-22
> **Issue:** #1513

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

1. `MuiBottomNavigationAction` no light theme usa constante estática `primary.main` (`#00852A`) em vez de `theme.palette.primary.main` dinâmico
2. Sombras do `MuiCard` e `MuiPaper` no light theme com `rgba(0,0,0,0.08)` são invisíveis sobre background `#FCFCFC`
3. `MuiTextField` no dark mode sem override de border — contrasta mal com `background.paper = #1E293B`

### 1.2 Comportamento Esperado (Correto)

1. BottomNav light deve usar `theme.palette.primary.main` (dinâmico, como o dark theme já faz)
2. Sombras no light devem usar `rgba(0,0,0,0.12)` para serem visíveis
3. TextField no dark deve ter borderColor via `theme.palette.divider`

### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `web/src/theme/index.ts` | Overrides de MuiBottomNavigationAction, MuiCard, MuiPaper, MuiTextField |

---

## 2. Solução

### Fix 1: BottomNav light → callback com theme
### Fix 2: Sombra Card/Paper light → `rgba(0,0,0,0.12)`
### Fix 3: TextField dark → border override com `theme.palette.divider`

---

## 3. Verificação

- [ ] `npm run build` passa
- [ ] `npm run lint` passa
- [ ] BottomNav selected color acompanha primary dinâmico no light
- [ ] Cards visíveis sobre background off-white no light
- [ ] TextField border visível no dark mode
