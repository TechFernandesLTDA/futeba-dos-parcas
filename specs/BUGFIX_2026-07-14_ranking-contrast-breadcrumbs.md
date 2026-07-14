# BUGFIX: contraste das medalhas e breadcrumbs sem IDs brutos

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Data:** 2026-07-14
> **Issues:** #3629, #3646

## Problema

O ranking semanal usa os tokens `gold`, `silver` e `bronze` diretamente como
cor do troféu sobre o card. No tema claro, especialmente a prata, o contraste
não alcança 3:1. Nos breadcrumbs, a heurística de ID é executada antes dos
mapas de rotas estáticas, fazendo segmentos como `challenges`, `notifications`
e `gamification` serem tratados como IDs e exibirem slug ou ID interno.

## Invariantes

- Os tokens canônicos de medalha permanecem inalterados e continuam
  theme-aware.
- O ícone da medalha tem contraste mínimo de 3:1 contra sua superfície em
  light, dark e dark OLED.
- A posição, navegação por teclado e nome acessível de cada linha do ranking
  permanecem funcionais.
- Segmentos estáticos conhecidos sempre vencem a heurística de ID.
- IDs dinâmicos e slugs desconhecidos nunca são exibidos como fallback.
- Labels continuam vindo dos catálogos PT-BR/en/es.
- Rotas estáticas irmãs ficam declaradas antes das rotas parametrizadas para
  tornar a precedência explícita, sem alterar guards ou destinos.

## Solução aprovada

1. Renderizar cada medalha como badge circular cuja superfície usa o token da
   medalha e cujo troféu usa `theme.palette.getContrastText()`.
2. Manter a medalha decorativa para o nome acessível já fornecido pela linha e
   preservar foco/acionamento do `CardActionArea`.
3. Resolver caminho exato e sub-rota estática antes de aplicar a heurística de
   ID em `useAutoBreadcrumbs`.
4. Para IDs cujo pai não possua label dinâmica conhecida, não criar breadcrumb
   em vez de expor o valor técnico.
5. Ordenar `/group/create`, `/profile/edit` e `/location/create` antes das rotas
   parametrizadas equivalentes em `App.tsx`.

## Critérios de aceitação

- Gold, silver e bronze exibem troféu com contraste >= 3:1 nos três temas.
- `/group/:groupId/challenges` resulta em `Grupo > Desafios` sem o ID.
- `/settings/gamification` e `/settings/notifications` usam labels traduzidos.
- Segmentos longos desconhecidos e IDs aninhados não aparecem no trail.
- Testes focados, build, lint e `git diff --check` passam.

## Verificação

- `cd web && npx vitest run src/pages/ranking/WeeklyRankingScreen.test.tsx src/hooks/useAutoBreadcrumbs.test.tsx`
- `cd web && npm run build`
- `cd web && npm run lint`
- `git diff --check`

## Risco e release

Mudança somente Web, sem schema, backend ou payload. Deve integrar a próxima
release Web consolidada; versionamento, release notes e deploy não fazem parte
desta branch isolada.
