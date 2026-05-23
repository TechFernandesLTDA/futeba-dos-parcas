# BUGFIX: Web Router Preload Crash

**Status**: APPROVED
**Issue**: #1712
**Data**: 2026-05-23

## Requirements

- Restaurar a renderizacao inicial da aplicacao web em producao.
- Corrigir o crash `useLocation() may be used only in the context of a <Router> component`.
- Manter o preloading de recursos sem executar hooks de roteamento fora do `BrowserRouter`.

## UX/UI

- A tela inicial deve renderizar normalmente.
- Usuario deslogado deve ver o fluxo de login/redirecionamento existente.
- Nenhuma mudanca visual intencional.

## Technical Design

- Mover a chamada de `useResourcePreloading()` de `App()` para um componente/hook executado dentro do `BrowserRouter`.
- Preferir ajuste minimo em `web/src/App.tsx`.
- Nao alterar regras Firebase, providers ou lazy routes.

## Tasks

1. Reproduzir o crash localmente.
2. Mover `useResourcePreloading()` para contexto com router.
3. Rodar build web.
4. Validar runtime local com Playwright.

## Implementation

- `useResourcePreloading()` foi movido de `App()` para `AppRoutes()`, garantindo execucao dentro do `BrowserRouter`.
- O prefetch dinamico por caminho foi substituido por importadores explicitos para evitar 404 em modulos inexistentes.

## Verify

- [x] `npm run build` em `web/`
- [x] Runtime local nao apresenta `useLocation()` fora de router
- [x] `#root` renderiza conteudo
