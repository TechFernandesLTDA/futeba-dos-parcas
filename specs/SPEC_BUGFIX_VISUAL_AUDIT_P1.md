# SPEC: Bugfix Visual Audit P1 (Web)

**Status:** APPROVED
**Date:** 2026-05-03
**Owner:** TechFernandesLTDA
**Type:** Bugfix (Web only)
**Predecessor:** specs/SPEC_BUGFIX_VISUAL_AUDIT_P0.md

---

## Contexto

Continuação do PR #407 (P0 fixes mergeado). Trata os P1 mais impactantes identificados pela auditoria visual paralela com 4 agentes Sonnet 4.6.

---

## Escopo: 5 fixes P1

### P1-A: Pluralização correta

**Problema:** "1 membros", "1 jogos" em strings concatenadas. Quebra naturalidade PT-BR.

**Files:**
- `pages/group/GroupSettingsScreen.tsx:199, 256`
- `pages/group/GroupDetailScreen.tsx:472`
- `pages/ranking/RankingScreen.tsx:216`

**Fix:** Helper `pluralize(count, singular, plural)` em `utils/format.ts` ou inline ternary `${count} ${count === 1 ? 'jogo' : 'jogos'}`.

### P1-B: ToastContext close button

**Problema:** `IconButton size="small"` (30px, fail touch) sem `aria-label`. Ação primária dismiss de toast inacessível por leitor de tela.

**File:** `contexts/ToastContext.tsx:123`

**Fix:**
- `aria-label="Fechar notificação"`
- `sx={{ padding: '8px' }}` (área toque ~44px)

### P1-C: STATUS_CONFIG dark mode

**Problema:** `STATUS_CONFIG.bgColor` em `types/game.ts:214-218` hardcoded light hex. `GameCard.tsx:82` renderiza esses valores raw → quebra dark mode.

**Files:**
- `types/game.ts:214-218`
- `pages/home/components/GameCard.tsx:82`

**Fix:** Trocar hex hardcoded por keys de palette (ex: `'success.light'`, `'warning.light'`) e usar `theme.palette[X].light` no consumer.

### P1-D: Silver/Bronze divergente

**Problema:** Duas fontes de verdade para cores de medalha:
- `theme/index.ts gamificationColors`: silver=`#C0C0C0`, bronze=`#CD7F32`
- `DIVISION_CONFIG` (em algum lugar): silver=`#757575`, bronze=`#5D4037`

**Files:** Buscar `DIVISION_CONFIG` e unificar com `gamificationColors`.

**Fix:** `DIVISION_CONFIG` re-exporta de `theme/index.ts` ou usa `gamificationColors.silver/bronze` direto.

### P1-E: Error retry buttons

**Problema:** 5 telas mostram `<Alert severity="error">` sem botão "Tentar novamente". Usuário precisa recarregar página inteira.

**Files (per audit_4):**
- `pages/groups/GroupsScreen.tsx`
- `pages/home/tabs/GamesTab.tsx`
- `pages/game/GameDetailScreen.tsx`
- `pages/group/GroupDetailScreen.tsx`
- `pages/game/LiveGameScreen.tsx`

**Fix:** Adicionar botão `onClick={refetch}` no Alert action.

---

## Out of scope (P2 ou maior)

- MuiBottomNavigation hardcoded #FFFFFF/#1E293B (4 ocorrências)
- ROLE_CONFIG duplicado em GroupDetailScreen + GroupSettingsScreen
- PlayerCard 30+ hardcoded hex
- Adaptive navigation (NavigationRail tablet, sidebar desktop)
- Whitespace excessivo desktop (shell maxWidth)
- 6 IconButton size="small" remanescentes (NotificationsScreen, Tab busca)
- 3 toasts idênticos LiveGame (mensagem genérica)
- Empty states internos sem CTA

---

## Definition of Done

- [ ] Pluralização correta nas 4 telas
- [ ] ToastContext close acessível e ≥44px
- [ ] GameCard funciona em dark mode
- [ ] Silver/Bronze unificadas
- [ ] 5 telas com retry button
- [ ] `npm run build` passa
- [ ] PR aprovado + merged
- [ ] `firebase deploy --only hosting` executado

---

## Plano

1. Branch `claude/fix-visual-audit-p1` (a partir de master `363a714`)
2. Commits separados por P1
3. Build + smoke test
4. PR + admin merge
5. Deploy hosting

---

## Relacionado

- PR #407 (P0 predecessor)
- specs/SPEC_BUGFIX_VISUAL_AUDIT_P0.md
- /tmp/audit_{1..4}_*.md
