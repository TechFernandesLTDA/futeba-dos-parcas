# BUGFIX: busca pública de jogadores sem LIST em `users`

> **Status:** `APPROVED`
> **Issue:** #3691
> **Data:** 2026-07-14
> **Plataformas:** Web + Cloud Functions + Firestore Rules

## Invariante

Convites e reforços só podem consumir uma projeção pública com campos esportivos
explicitamente permitidos. Perfil privado, removido ou com PII materializada não
pode aparecer, derrubar a consulta inteira nem justificar relaxar a leitura de
`users/{uid}`.

## Causa raiz

- `InvitePlayersScreen` executava busca por prefixo diretamente em `users` sem
  `is_searchable == true`; qualquer documento não público negava o LIST.
- A mesma tela carregava os perfis de membros com `where(documentId(), 'in', ...)`,
  embora `groups/{groupId}/members` já guarde nome e foto denormalizados.
- `usePositionReinforcements` fazia LIST em `users` com `is_searchable == true`.
  A regra também exige ausência de PII, predicado que uma query não consegue
  declarar; um único documento legado com PII negava o lote todo.

## Decisão

1. Reutilizar a callable autenticada `getLeaguePlayers`, que lê com Admin SDK e
   devolve somente uma whitelist pública, para busca de convite e reforços.
2. Ampliar essa projeção apenas com sinais esportivos necessários aos reforços:
   posição preferida, ratings numéricos e booleans calculados de disponibilidade
   hoje/presença recente. Não retornar e-mail, telefone, gênero, data de
   nascimento, medidas corporais, tokens ou timestamps de atividade.
3. Ler nome/foto dos membros do próprio documento de membership denormalizado.
4. Separar `get` de `list`: GET público mantém os predicados atuais e LIST da
   coleção raiz passa a ser exclusivo de admin.
5. Centralizar hidratações por IDs conhecidos em `getUsersByIds`, agora apoiado
   pela mesma callable e por `userIds` sanitizados (máximo 500).

## Arquivos

- `functions/src/cache/leaderboard-cache.ts`
- `functions/test/leaderboard-cache.test.ts`
- `web/src/services/cloudFunctions.ts`
- `web/src/pages/groups/InvitePlayersScreen.tsx`
- `web/src/components/search/SearchPanel.tsx`
- `web/src/pages/statistics/HeadToHeadScreen.tsx`
- `web/src/hooks/usePositionReinforcements.ts`
- consumidores Web de `getUsersByIds`
- `web/src/utils/positionReinforcements.ts`
- testes Web focais
- `firestore-rules-tests/src/users.test.ts`

## Critérios de aceite

- Convite e reforço não executam LIST em `users`.
- Busca retorna somente perfis pesquisáveis e ativos por projeção sanitizada.
- Perfil com PII na origem não vaza nenhum campo sensível na resposta.
- Perfil privado ou soft-deleted não entra na projeção.
- Regras de `users` não são relaxadas.
- Nenhum consumidor Web faz LIST na coleção raiz `users`; as ocorrências
  restantes são apenas subcoleções próprias `users/{uid}/...`.
- Emulador cobre LIST limpo, privado e com PII.
- Testes focais de Functions/Web, lint e builds passam.

## Fora de escopo

- Alterar a preferência `is_searchable`.
- Deploy, merge ou release.

## Inventário final de acessos restantes

O grep por `collection(db, 'users'` permanece somente para subcoleções com
autorização própria/owner, como `groups`, `game_templates`, `favorite_squads`,
`rating_history`, `badges` e `hidden_feed_posts`. Não resta busca nem hidratação
LIST na coleção raiz. Leitura administrativa continua autorizada pela rule de
LIST e leitura pontual de perfil continua no caminho GET existente.
