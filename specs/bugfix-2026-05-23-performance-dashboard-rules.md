# BUGFIX: Performance Dashboard Rules

**Status**: APPROVED
**Issue**: #1687
**Data**: 2026-05-23

## Requirements

- Permitir que admins leiam `performance_metrics` no Firestore.
- Bloquear escrita client-side em `performance_metrics`.
- Remover cores hardcoded do `PerformanceDashboard`.
- Remover emojis de headings do dashboard.

## UX/UI

- Dashboard mantem layout atual.
- Headings usam texto limpo sem emojis.
- Cores seguem `theme.palette`/tokens MUI para funcionar em light/dark mode.

## Technical Design

- Atualizar `firestore.rules` com `allow read: if isAdmin()` e `allow write: if false` para `performance_metrics`.
- Atualizar `web/src/pages/admin/PerformanceDashboard.tsx` para usar tokens `success.main`, `warning.main` e `error.main`.
- Remover helpers/imports de icones nao utilizados.

## Tasks

1. Conferir acesso atual de `performance_metrics`.
2. Ajustar regra Firestore.
3. Ajustar cores/headings do dashboard.
4. Validar build web.
5. Validar rules quando possivel.

## Implementation

- `performance_metrics` agora permite apenas leitura por admin e bloqueia escrita client-side.
- `PerformanceDashboard` usa tokens MUI (`success.main`, `warning.main`, `error.main`) em vez de hex hardcoded.
- Headings do dashboard foram normalizados sem emojis.

## Verify

- [x] `npm run build` em `web/`
- [x] Regra `performance_metrics` permite leitura admin
- [x] Regra `performance_metrics` bloqueia escrita client-side
- [x] `JAVA_HOME="/opt/homebrew/opt/openjdk@21" PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" firebase emulators:exec --only firestore --project futebadosparcas "true"`
