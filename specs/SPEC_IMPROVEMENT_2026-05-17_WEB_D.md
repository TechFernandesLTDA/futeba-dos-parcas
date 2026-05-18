# SPEC: Web UI Improvements — PR D (Issues #1274, #1276, #1277, #1278)

**Status:** APPROVED
**Data:** 2026-05-17
**Autor:** Claude (web-frontend-dev agent)
**Issues:** #1274, #1276, #1277, #1278
**PR:** `improvement/web-1274-1276-1277-1278`

---

## 1. REQUIREMENTS

### Contexto

Quatro melhorias de qualidade de UI para o web app, identificadas em auditoria de 2026-05-17.

### Escopo

| Issue | Prioridade | Descrição | Status |
|-------|-----------|-----------|--------|
| #1274 | low | Substituir `ListItemSecondaryAction` (deprecated MUI v5) em 5 telas | **JÁ RESOLVIDO** — ver seção 1.1 |
| #1276 | low | Corrigir skeleton de loading em `StatisticsScreen` para espelhar layout real | A IMPLEMENTAR |
| #1277 | medium | Adicionar gráfico donut (V/E/D) em `StatisticsScreen` usando SVG puro | A IMPLEMENTAR |
| #1278 | low | Internacionalizar labels hardcoded de abas em `GamesScreen` e `StatisticsScreen` | A IMPLEMENTAR |

### 1.1 Issue #1274 — Já Resolvida

Investigação via `grep -r "ListItemSecondaryAction" web/src/` retornou zero ocorrências.
Confirmado via `git log -S ListItemSecondaryAction -- web/` que a migração já foi feita
em PRs anteriores da wave de auditoria (provavelmente PR #1285).

O codebase usa corretamente a prop `secondaryAction` no `<ListItem>` (12 ocorrências
confirmadas em 7 arquivos). Nenhuma alteração de código necessária.

A issue #1274 será fechada via PR description com explicação.

---

## 2. UX/UI DESIGN

### #1276 — Skeleton melhorado

**Atual:** 2 blocos retangulares genéricos (120px + 200px)
```
[████████████████████] 120px
[████████████████████] 200px
```

**Proposto:** Espelha o layout real do conteúdo:
- Card de perfil: avatar circular (64px) + linhas de texto à direita
- 2 cards de conteúdo (~180px cada) representando abas

```
[○  ████████████  ] ← perfil (avatar + nome + level)
[████████████████ ] ← card de conteúdo 1
[████████████████ ] ← card de conteúdo 2
```

### #1277 — Donut chart V/E/D

**Posição:** Dentro do Card "Jogos" (aba Geral), acima da barra horizontal existente.
**Técnica:** SVG puro via `stroke-dasharray` / `stroke-dashoffset`.
**Cores:** Reutilizar tokens do tema para consistência com barra existente:
- Vitórias: `theme.palette.success.main`
- Empates: `theme.palette.warning.main`
- Derrotas: `theme.palette.error.main`

Layout: SVG centralizado (~120px) com legenda em linha abaixo.
Fallback: quando `totalGames === 0`, exibir círculo cinza com label "Sem dados".

### #1278 — Internacionalização das abas

Chaves i18n a criar em todos os 3 arquivos de locale:

**`games.tabs.*`** (GamesScreen):
- `all` / `scheduled` / `confirmed` / `live` / `finished`

**`statistics.tabs.*`** (StatisticsScreen):
- `general` / `goals` / `achievements`

---

## 3. TECHNICAL DESIGN

### Arquivos a modificar

| Arquivo | Issue | Tipo de alteração |
|---------|-------|------------------|
| `web/src/pages/statistics/StatisticsScreen.tsx` | #1276, #1277, #1278 | Skeleton + SVG donut + i18n tabs |
| `web/src/pages/games/GamesScreen.tsx` | #1278 | Tab labels → i18n (linhas 121-125 APENAS) |
| `web/src/i18n/locales/pt-BR.json` | #1278 | Adicionar `games.tabs.*` e `statistics.tabs.*` |
| `web/src/i18n/locales/en.json` | #1278 | Idem |
| `web/src/i18n/locales/es.json` | #1278 | Idem |

### Restrições técnicas

- **Sem bibliotecas de gráficos**: `recharts`, `chart.js`, `nivo`, `d3`, `@mui/x-charts`
  não estão no `package.json` e NÃO devem ser instalados. SVG puro obrigatório.
- **GamesScreen.tsx linha 94**: `aria-label="Filtrar jogos"` é propriedade de PR C — NÃO TOCAR.
- **Cores**: somente `theme.palette.*` — nenhum hex hardcoded.
- **Hooks**: todos declarados antes de qualquer `if`/early return.

### Implementação do donut SVG

O donut usa a técnica clássica de `stroke-dasharray`:

```
raio = 45, circunferência = 2π × 45 ≈ 282.7
fatia_V = (wins/total) × 282.7
fatia_E = (draws/total) × 282.7
fatia_D = (losses/total) × 282.7

Para cada arco:
- stroke-dasharray: `${fatia} ${circunferência}`
- stroke-dashoffset: `-${offset_acumulado}`
```

Renderizado em um componente auxiliar `DonutChart` dentro do mesmo arquivo,
usando `useTheme()` para cores.

---

## 4. TASKS

- [x] Escrever spec (esta)
- [ ] **Commit 1** (#1276): Corrigir skeleton `StatisticsScreen`
- [ ] **Commit 2** (#1277): Adicionar donut SVG em `StatisticsScreen`
- [ ] **Commit 3** (#1278): i18n tabs em `GamesScreen` + `StatisticsScreen` + 3 locales
- [ ] Verificar: `cd web && npm run build && npx vitest run && npm run lint`
- [ ] Abrir PR com `Closes #1276 #1277 #1278` e menção que #1274 já estava resolvida

---

## 5. DEFINITION OF DONE (Web)

- [ ] TypeScript compila sem erros (`npm run build`)
- [ ] ESLint sem warnings (`npm run lint`)
- [ ] Responsivo: 320px+, tablet, desktop
- [ ] Suporte dark/light theme via tokens MUI
- [ ] Estados loading, error, empty e success todos presentes
- [ ] Nenhuma cor hardcoded (apenas `theme.palette.*`)
- [ ] Comentários em PT-BR
- [ ] 3 commits atômicos (1 por issue)
