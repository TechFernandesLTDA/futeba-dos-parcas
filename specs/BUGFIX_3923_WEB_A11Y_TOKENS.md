# BUGFIX: Tokens `.dark` idênticos light/dark + falhas de contraste AA na web

> **Status:** `IN_PROGRESS`
> **Severidade:** `MEDIUM`
> **Autor:** claude
> **Data:** 2026-07-28
> **Issues:** #3923 (raiz), #3919, #3918, #3920, #3921

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

1. **#3923 (raiz)**: `darkPalette.{error,warning,info}.dark` em `shared/design-tokens.json`
   são idênticos aos da `palette` light. O gate `check-design-tokens-parity.js` é cego a
   essa classe (valida conformidade cross-plataforma, não assimetria intra-plataforma).
2. **#3919**: `DemoDataChip` pinta texto com `warning.dark` sem guarda de tema → 1.5:1 no dark.
3. **#3918**: Paleta light não define `action.selected` → item selecionado da nav fica em 3.98:1.
4. **#3920**: Chips de role em `/admin/users` usam a mesma matiz como texto e fundo tintido
   → PLAYER 2.41:1 no light.
5. **#3921**: Dois selects diferentes em `/locations` com o rótulo idêntico "Mensalidade".

### 1.2 Comportamento Esperado (Correto)

Todos os textos/chips atingem WCAG AA (4.5:1) nos dois temas. Tokens `.dark` invertem
entre paletas (como `success` já faz). Gate previne recorrência. Filtros têm rótulos distintos.

---

## 2. Análise de Causa Raiz

| role | `palette.dark` (light) | `darkPalette.dark` (dark) | inverte? |
|---|---|---|---|
| error | `#B71C1C` | `#B71C1C` | NÃO |
| warning | `#8A3A00` | `#8A3A00` | NÃO |
| info | `#004399` | `#004399` | NÃO |
| success | `#005A1C` | `#2E7D32` | SIM (referência) |

Consumer sites usam `.dark` como cor de texto sem checar `theme.palette.mode`, quebrando
no dark theme. O padrão correto já existe em `GameCard.tsx`.

---

## 3. Solução

### 3.1 Token (raiz — #3923)

`shared/design-tokens.json` + `web/src/theme/index.ts` — `darkPalette.{error,warning,info}.dark`
recebem valores que invertem (tons médios, distintos do light, seguindo o precedente de `success`):

| role | dark `.dark` (novo) |
|---|---|
| error | `#C56560` |
| warning | `#CC7A2F` |
| info | `#3A8FC4` |

### 3.2 Consumer sites theme-aware

- `DemoDataChip.tsx`: `mode === 'dark' ? warning.light : warning.dark`
- `HomeTab.tsx` (Avatar reconectar): mesmo padrão
- `LoginScreen.tsx` + `RegisterScreen.tsx` (hover border Google): `info.light` no dark

### 3.3 action.selected no light (#3918)

Adicionar bloco `action: { selected: alpha(primary.main, 0.12) }` na paleta light.

### 3.4 Role chips (#3920)

`getRoleColor` em `UserManagementScreen.tsx` passa a retornar `.dark`/`grey[700]` no light.

### 3.5 Filtros (#3921)

Renomear: "Status da mensalidade" (L1049) e "Valor da mensalidade" (L1110).

### 3.6 Gate de prevenção (#3923)

`check-design-tokens-parity.js` ganha checagem intra-plataforma:
para cada role, `palette.<role>.dark !== darkPalette.<role>.dark` (e `.light`).

---

## 4. Verificação

- [ ] `node scripts/check-design-tokens-parity.js` passa (com novo gate intra-plataforma)
- [ ] `cd web && npm run build` (tsc) passa
- [ ] `cd web && npm run lint` passa
- [ ] DemoDataChip legível no dark
- [ ] Item selecionado da nav >= 4.5:1 no light
- [ ] Chips de role >= 4.5:1 no light
- [ ] Filtros têm rótulos distintos

## 5. Prevenção Futura

O gate intra-plataforma (item 3.6) teria pego os 3 tokens na primeira execução — é o
ponto principal para evitar a 4ª recorrência.
