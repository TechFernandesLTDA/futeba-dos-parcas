# BUGFIX: Placar final não chega aos documentos de `teams`

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `dcf5ac08`
> **Origem:** simulação de 13 semanas no emulador (PR #4621), achado "placar não chega aos times"

---

## 1. Problema

`finishGameLifecycle` (`functions/src/games/lifecycle.ts`) grava o placar final no jogo (`team1_score`,
`team2_score`) e marca `live_scores` como finalizado, mas não toca em `teams/{id}.score`, que fica em 0.

Quem lê `teams.score` sem outra fonte:

- ranking semanal (`functions/src/growth/weekly-ranking.ts`): todo jogo conta como empate;
- confronto direto no web (`web/src/hooks/useHeadToHead.ts`): vitórias e derrotas ficam em 0;
- card do time no Android: "0 gols" em jogo finalizado.

Badges e liga do grupo leem o placar do jogo e já estão certos.

## 2. Correção

1. No `finishGameLifecycle`, os documentos de `teams` do jogo são lidos junto com os eventos e o `live_scores`.
   O placar de cada time vem do mapa canônico `live_scores.scores` (#3942) e, para times fora dele, dos ids
   legados `team1_id`/`team2_id` com o placar do jogo. Sem nenhum id em `live_scores`, dois times recebem o
   placar na ordem do id do documento, a mesma usada no início do jogo.
2. A gravação de `score` (e `updated_at`) em cada time acontece na mesma transação que passa o jogo a
   `FINISHED`. Time apagado durante o jogo não é recriado.
3. Script `scripts/migrations/backfill-team-scores.js` corrige os jogos já finalizados com a mesma conta. Só
   leitura por padrão; `--apply` grava só `score` e `updated_at`, e só quando o valor difere. Quem roda em
   produção é o Renan.

Nenhuma regra do Firestore mudou e nenhum campo novo fica legível.

## 3. Fora deste PR

- Os leitores de `teams.score` não mudam. Ler o placar do jogo como alternativa pode ser feito depois, mas
  não é necessário com o campo correto.

## 4. Testes

`functions/test/game-lifecycle.test.ts`, bloco "placar nos documentos de teams":

- grava o placar de cada time na mesma transação do `FINISHED`;
- jogo de 3 times recebe o placar de cada um pelo mapa `scores`;
- time apagado durante o jogo não é recriado;
- `finalTeamScores` com ids legados e com `live_scores` antigo sem ids.

Os quatro falham no código atual e passam com a correção.

`scripts/migrations/backfill-team-scores.test.js` e uma rodada no emulador local: 3 times corrigidos em 2 jogos
finalizados, jogo ao vivo intocado, segunda leitura sem nada a corrigir.

## 5. Verificação

- [ ] `npm run build`, `npm run lint` e `npx jest` em `functions` verdes
- [ ] Deploy de `finishGameLifecycle` depois do merge (Renan)
- [ ] Backfill em produção: dry-run, conferir a contagem, depois `--apply` (Renan)
