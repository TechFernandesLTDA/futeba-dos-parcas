# SPEC: Bugfix Visual Audit P0 (Web)

**Status:** APPROVED
**Date:** 2026-05-03
**Owner:** TechFernandesLTDA
**Type:** Bugfix (Web only)

---

## Contexto

Auditoria visual paralela com 4 agentes Sonnet 4.6 (design system, responsivo, a11y, UX states) identificou 4 problemas P0 no web app deployado em https://futebadosparcas.web.app. Reports completos em `/tmp/audit_{1..4}_*.md`.

---

## Escopo: 4 fixes P0

### P0-1: Contraste WCAG AA da cor primária (light theme)

**Problema:** `palette.primary.main = #00C853` tem ratio **2.24:1** sobre branco. Falha WCAG AA (req 4.5:1 normal, 3.0:1 large). Usado como cor de texto em 10+ telas e como background com `contrastText: white` em chips/botões filled.

**Files afetados:**
- `web/src/theme/index.ts` (definição da palette)
- `pages/auth/LoginScreen.tsx:113` (h4 título)
- `pages/home/tabs/GamesTab.tsx:258` (body2 horário)
- `pages/game/LiveGameScreen.tsx:320,331` (h2 placar)
- `pages/livegame/LiveStatsScreen.tsx:164` (h2)
- `pages/statistics/StatisticsScreen.tsx:182` (h5)
- `pages/statistics/WeeklyRecapScreen.tsx:178` (h3)
- `pages/profile/ProfileScreen.tsx:214` (h5)
- `pages/tactical/TacticalBoardScreen.tsx:296` (subtitle2)
- `components/common/SkipNav.tsx:29` (próprio acessibility wrapper falha)

**Fix:** Trocar `primary.main` de `#00C853` para `#00852A` (ratio ~4.76:1 vs branco). Preserva identidade visual (continua verde Brasil) e atinge WCAG AA. Manter `dark: #00852A` ou ajustar pra `#005A1C`.

### P0-2: Position fixed escapam do MobileShell em sm+

**Problema:** `MobileShell` (`App.tsx:278-290`) limita conteúdo a 480px centrado, mas 11 elementos `position: fixed` usam `left:0/right:0` ou `right:16` do viewport. Em tablet/desktop, BottomNav e action bars esticam toda a tela; FABs aparecem desconectados no canto.

**Files afetados (11):**
- `pages/home/HomeScreen.tsx:67-72` (BottomNav)
- `pages/group/GroupDetailScreen.tsx:343-353` (action bar)
- `pages/game/GameDetailScreen.tsx:483-493` (action bar)
- `pages/game/LiveGameScreen.tsx:391` (controls)
- `pages/game/MVPVoteScreen.tsx:372` (vote button)
- `pages/games/GamesScreen.tsx:182` (FAB)
- `pages/groups/GroupsScreen.tsx:91` (FAB)
- `pages/home/tabs/GamesTab.tsx:304` (FAB)
- `pages/home/tabs/GroupsTab.tsx:237` (FAB)
- `pages/map/LocationsMapScreen.tsx:238` (FAB)
- `pages/livegame/LiveEventsScreen.tsx:214` (FAB)

**Fix:** Centralizar fixed bars/FABs com cálculo respeitando shell:
- BottomNav/action bars: `left: { sm: '50%' }, right: { sm: 'auto' }, transform: { sm: 'translateX(-50%)' }, width: { xs: '100%', sm: 480 }`
- FABs: posicionar relativo ao centro: `right: { xs: 16, sm: 'calc(50% - 240px + 16px)' }` ou usar wrapper container.

### P0-3: Hierarquia de headings (sem `<h1>` em 55 telas)

**Problema:** Nenhuma página tem `<h1>` semântico. Leitores de tela esperam `h1` por página pra orientação. Atualmente todas começam com `h5/h6`.

**Files afetados (escolher páginas principais):**
- LoginScreen, RegisterScreen, HomeScreen, GroupDetailScreen, GameDetailScreen, ProfileScreen, RankingScreen, StatisticsScreen, GamesScreen, GroupsScreen

**Fix:** Adicionar `component="h1"` ao Typography do título principal de cada tela top-level. `variant` controla aparência (mantém tamanho atual), `component` controla semântica.

### P0-4: Erros Firebase brutos ao usuário

**Problema:** 5 ocorrências de `showError((err as Error).message)` expõem mensagens técnicas em inglês. Já existe `utils/firebaseErrors.ts` com `getFirestoreErrorMessage()` traduzido PT-BR.

**Files afetados (5):**
- `pages/game/GameDetailScreen.tsx:100,112,127`
- `pages/group/GroupDetailScreen.tsx:100`
- `pages/game/LiveGameScreen.tsx:259`

**Fix:** Substituir `showError((err as Error).message)` por `showError(getFirestoreErrorMessage(err))`.

---

## Out of scope (ficam pra próximo PR)

- P1/P2 issues (Silver/Bronze divergente, MuiBottomNavigation hardcoded colors, ROLE_CONFIG duplicado, PlayerCard 30+ hardcoded hex, etc.)
- Adaptive navigation (NavigationRail tablet, sidebar desktop)
- Pluralização "1 jogos" → "1 jogo"
- Whitespace excessivo desktop (shell maxWidth)
- Lighthouse audit (Chrome MCP indisponível)

---

## Definition of Done

- [ ] WCAG AA: ratio primary ≥ 4.5:1 sobre branco
- [ ] BottomNav e FABs ficam dentro do shell em sm+
- [ ] Top 10 telas têm `<h1>` semântico
- [ ] Erros Firebase mostram mensagem PT-BR ao usuário
- [ ] `npm run build` passa sem warnings novos
- [ ] Smoke test manual: login + home + criar jogo

---

## Plano de implementação

1. Branch `claude/fix-visual-audit-p0` (a partir de master `7f896f1`)
2. 4 commits separados (um por P0)
3. Build local + smoke test
4. PR + admin merge
5. Deploy `firebase deploy --only hosting`

---

## Relacionado

- `/tmp/audit_1_design_system.md`
- `/tmp/audit_2_responsive.md`
- `/tmp/audit_3_a11y.md`
- `/tmp/audit_4_ux_microcopy.md`
- `.claude/SESSION_HANDOFF.md`
- `specs/DECISIONS.md`
