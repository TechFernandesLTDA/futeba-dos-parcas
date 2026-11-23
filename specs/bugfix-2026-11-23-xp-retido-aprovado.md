# BUGFIX: XP retido continua zerado depois que o admin aprova

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `dcf5ac08`
> **Origem:** simulação de 13 semanas no emulador (PR #4621), achado 7 "XP retido continua zerado mesmo depois de aprovado"

---

## 1. Problema

Quando uma confirmação é criada, `onConfirmationCreated` (`functions/src/voting/temporal-overlap.ts`) marca
`suspicious_overlap = true` se a pessoa tem outro jogo no mesmo horário. A marca pesa na nota de validação e
o jogo pode ficar com `xp_reward_status = HELD_FOR_REVIEW`.

O admin aprova pela callable `reviewHeldGameRewards` (`functions/src/games/reward-review.ts`), que só muda o
jogo para `ELIGIBLE` / `APPROVED`. O reprocessamento disparado por essa mudança passa por
`filterAndClampConfirmations` (`functions/src/xp/game-validation-gate.ts`), que exclui de novo toda
confirmação com a marca. Resultado:

- os jogadores marcados continuam sem XP, sem estatística e sem temporada, mesmo com o jogo aprovado;
- se sobram menos de 6 jogadores, ninguém ganha XP, nem o MVP, e `voting_xp_pending` fica `true`.

## 2. Correção

Aprovar é a decisão do admin de que a sobreposição deste jogo não é fraude. Na mesma transação que passa o
jogo a `ELIGIBLE`, a callable:

1. consulta `confirmations` com `game_id == gameId` e `suspicious_overlap == true` (só igualdade, sem índice
   composto novo);
2. grava em cada uma `suspicious_overlap = false`, `suspicious_overlap_cleared_at` (hora do servidor) e
   `suspicious_overlap_cleared_by` (uid do admin).

Como as confirmações e o jogo saem no mesmo commit, o trigger do jogo já lê as marcas limpas. O registro
original continua em `audit_logs/overlap_{confId}`.

Recusar (`REJECT`) não mexe nas confirmações.

Nenhuma regra do Firestore mudou. Os dois campos novos são gravados só pelo Admin SDK, em documentos que já
têm a mesma visibilidade, e não trazem dado pessoal (o uid do admin já fica em `xp_reward_reviewed_by` no
jogo).

## 3. Fora deste PR

- A sobreposição só é calculada quando a confirmação é criada; remarcar o jogo não reavalia.
- `getGameWindow` cai em `date` (meia-noite UTC) quando o jogo não tem `dateTime`. O #4624 faz o web gravar
  `dateTime` e preenche no servidor; depois dele, vale ler `date` + `time` no fuso da quadra também aqui.
- Só o admin global aprova, e só pela tela web `/admin/game-reviews`. Android e iOS não têm tela, e o iOS não
  mostra que o jogo está em análise.

Os três vão para o issue dos achados não graves.

## 4. Testes

`functions/test/reward-review.test.ts`:

- aprovar consulta as confirmações marcadas do jogo e limpa a marca de cada uma na mesma transação do jogo
  (falha no código atual, passa com a correção);
- recusar não consulta nem grava confirmações.

## 5. Verificação

- [ ] `npm run build`, `npm run lint` e `npx jest` em `functions` verdes
