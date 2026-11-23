# BUGFIX: Jogo novo grava `players: []`, que ninguém lê

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `LOW`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `45946afa`
> **Origem:** simulação de uso no emulador (PR #4621), issue #4629 item 28

---

## 1. Problema

O documento `games/{gameId}` nasce com `players: []` e o campo nunca muda. Quem joga está em
`confirmations` e nos contadores `players_count` e `goalkeepers_count`. O campo vazio só confunde quem lê o
documento.

Escritores em `origin/master`:

| Onde | Linha |
|---|---|
| web, criar jogo | `web/src/hooks/useGames.ts:738` |
| web, duplicar jogo | `web/src/hooks/useDuplicateGameCopy.ts:108` |
| functions, próximo jogo da recorrência | `functions/src/games/recurrence-engine.ts:388` |
| Android, criar jogo | `app/.../data/repository/GameRepositoryImpl.kt:106` |

## 2. Conferência de leitores

Busca em `origin/master` por `.players`, `"players"`, `'players'` e `players:` nos lugares abaixo. Os nomes
parecidos (`players_count`, `max_players`, `team1_players`, `blocked_players`) ficaram de fora.

| Lugar | Resultado |
|---|---|
| `firestore.rules` | nenhuma regra lê ou exige `players` em `games` (create, update, `hasAll`, `keys()`) |
| `firestore.indexes.json` | nenhum índice com `players` |
| `functions/src` | nenhum leitor em `games`. O `.select("players")` de `weekly-ranking.ts:396` é da coleção `dream_team`; `leaderboard-cache`, `nearby-players` e `season-cycle` montam respostas próprias |
| `web/src` | nenhum leitor. O tipo `Game` declarava `players: string[]`, mas nenhum mapeador preenchia o campo e nenhuma tela o lia. Os outros `players` são da liga, do time dos sonhos, de jogadores próximos e do sorteio |
| `shared/src`, `composeApp/src`, `iosApp` | o modelo `Game` do KMP não tem `players`. `PublicPlayerProjection` lê `players` da resposta de uma callable, não do jogo. A criação do iOS não grava o campo |
| `app/src` | só o escritor acima. `players = emptyList()` em `Entities.kt` e `ModelMappers.kt` é do cache local (Room), e `MockDataHelper` é dado de exemplo |

## 3. Correção

- Web e functions deixam de gravar o campo; o tipo `Game` do web perde `players`.
- Android: a mesma remoção em `GameRepositoryImpl.kt` vai no PR do Android da #4629, junto com os outros
  itens do Android, para um único ciclo de build.
- Documentos antigos continuam com `players: []`. Sem leitor, não há migração.

## 4. Testes

- `web/src/hooks/useGames.test.ts`: o jogo criado não tem `players`.
- `web/src/hooks/useDuplicateGameCopy.test.ts`: a cópia não tem `players` (antes o teste exigia `[]`).
- `functions/test/recurrence-engine.test.ts`: o próximo jogo da recorrência não tem `players`.
- Fixtures de `Game` no web sem o campo (`GameCard.test.tsx`, `HomeTabsLayout.test.tsx`).

## 5. Verificação

- [x] Testes e tipos do web e das functions verdes
- [ ] Deploy de `onGameFinishedCreateRecurrence` depois do merge (fica com o Renan)
- [ ] Web publicado depois do merge (fica com o Renan)
