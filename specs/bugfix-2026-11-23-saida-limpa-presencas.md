# BUGFIX: Quem sai ou é removido do grupo continua nos jogos futuros

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `MEDIUM`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `45946afa`
> **Origem:** issue #4629, seção "Encontrado durante as correções" (saída e remoção, #4622 e #4627)

---

## 1. Problema

Quando alguém sai do grupo ou é removido, o vínculo muda de `ACTIVE` para `INACTIVE` ou `REMOVED`, mas a
pessoa continua nos jogos futuros do grupo:

- **Web:** `removeGroupMembershipArtifacts` (`web/src/hooks/useGroups.ts`) cancela só as confirmações
  `CONFIRMED`. A regra de `confirmations` deixa o admin do grupo fazer só a passagem `CONFIRMED` para
  `CANCELLED`, então as confirmações `PENDING` e `WAITLIST` ficam no jogo.
- **Android e shared/iOS:** `leaveGroup` muda o vínculo e apaga o espelho `users/{uid}/groups/{gid}`, sem
  tocar nos jogos. Nem as confirmações `CONFIRMED` são canceladas.
- **Fila de espera** (`games/{id}/waitlist/{uid}`, `WAITING` ou `NOTIFIED`): nenhum app limpa. Quem saiu do
  grupo pode ser chamado para uma vaga de um grupo do qual não faz mais parte.

## 2. Correção

Trigger novo `onMemberDepartedCleanupGames` (`functions/src/groups/member-departure-cleanup.ts`), em
`groups/{groupId}/members/{memberId}`, separado do contador `onMemberWritten`.

**Quando roda:** o vínculo deixa de ser ativo (`ACTIVE`, ou sem status em vínculos antigos, para qualquer
outro status, ou o documento é apagado). A regra de "ativo" é a do contador (`isActiveMember`).

**Fica de fora:** o merge de contas, que desativa o vínculo do alias com `merged_to_uid` e move as
confirmações para a conta canônica. Cancelar ali levaria o `CANCELLED` para a conta canônica.

**O que faz**, nos jogos do grupo com status `SCHEDULED` ou `CONFIRMED` e sem `deleted_at` (o mesmo conjunto
que o web já usa):

- confirmações da pessoa com status `CONFIRMED`, `PENDING` ou `WAITLIST` passam para `CANCELLED`, com
  `updated_at` do servidor. Nenhum campo novo.
  - A passagem de `CONFIRMED` usa os triggers de sempre: `onConfirmationWrite` desconta `players_count` e
    `onGameVacancy` promove a fila de espera.
  - `PENDING` e `WAITLIST` não ocupavam vaga: os triggers de contagem e de vaga não fazem nada com elas.
- a entrada da pessoa na fila de espera, se `WAITING` ou `NOTIFIED`, é apagada, como quando ela mesma sai da
  fila. Se estava `NOTIFIED` (foi chamada e segurava a vaga até o prazo), a vaga passa ao próximo da fila por
  `promoteWaitlistOnVacancy`. Sem a entrada, a varredura de prazo vencido não acharia ninguém, e a vaga
  ficaria parada.

**Idempotência:** cada escrita roda numa transação que relê o documento e só age se ele ainda está no
estado de antes. A promoção da fila usa uma claim em `notif_dedup` pelo id do evento e do jogo, para uma
segunda entrega não chamar duas pessoas.

**Regras e clientes:** não mudam. O web continua cancelando as `CONFIRMED` no mesmo lote da saída; o trigger
encontra essas já canceladas e segue. As consultas são só de igualdade (`group_id` com `status in`, e
`game_id` com `user_id`), sem índice composto novo.

**Efeito para quem fica:** jogo público do grupo também entra, como no web hoje. Quem foi removido e quer
jogar uma pelada pública do grupo entra de novo pelo fluxo público.

## 3. Testes

`functions/test/permissions/group-departure-cleanup.test.ts` (Firestore falso):

- `INACTIVE`, `REMOVED`, `BLOCKED` e `BANNED` cancelam `CONFIRMED`, `PENDING` e `WAITLIST`;
- vínculo apagado e vínculo antigo sem status também limpam;
- jogo encerrado, apagado, de outro grupo e confirmação de outra pessoa ficam como estão;
- confirmação já cancelada e entrada da fila já expirada ficam como estão;
- `WAITING` sai da fila sem promover ninguém; `NOTIFIED` sai e promove o próximo uma vez só, mesmo com o
  evento entregue duas vezes;
- segunda entrega não muda nada;
- merge de contas não cancela;
- entrada no grupo, volta de quem saiu, edição de quem continua ativo e troca entre estados inativos são
  ignoradas.

## 4. Verificação

- [x] Build, lint e testes das functions verdes
- [ ] Deploy de `onMemberDepartedCleanupGames` depois do merge (fica com o Renan)
- [ ] Vínculos que já saíram antes do deploy não são limpos. Se o Renan quiser, um backfill é outro passo,
      com OK dele
