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
segunda entrega não chamar duas pessoas. A promoção roda antes de apagar a entrada `NOTIFIED`: se ela falha,
a entrada continua lá e a nova entrega do evento tenta de novo.

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
- se a promoção falha, a entrada `NOTIFIED` fica e a nova entrega promove; promoção já concluída não se
  repete;
- segunda entrega não muda nada;
- merge de contas não cancela;
- entrada no grupo, volta de quem saiu, edição de quem continua ativo e troca entre estados inativos são
  ignoradas.

## 4. Verificação

- [x] Build, lint e testes das functions verdes
- [ ] Deploy de `onMemberDepartedCleanupGames` depois do merge (fica com o Renan)
- [ ] Vínculos que já saíram antes do deploy não são limpos pelo trigger: o backfill da seção 5 faz isso,
      rodado pelo Renan

## 5. Backfill de quem saiu antes do deploy

> **Status:** `PROPOSED` (seção acrescentada a pedido da sessão Central TF em 2026-11-23; a aprovação é o
> merge do PR do backfill)

O trigger só age em saídas novas. Quem saiu ou foi removido antes do deploy continua nos jogos futuros do
grupo. O script `functions/src/scripts/backfill-departed-member-games.ts` passa por essas pessoas.

**A limpeza é a do trigger.** O script chama `cleanupDepartedMemberGames`, a mesma função, em vez de copiar
a lógica: mesmos jogos, mesmos status cancelados e a mesma passagem da vaga de quem estava `NOTIFIED`. Por
isso ele fica em `functions/src/scripts` e não em `scripts/migrations`, que não enxerga o código das
functions. Do padrão de `scripts/migrations` ele segue o resto: dry-run por padrão, `--apply` explícito,
`--project=`, logs `SCAN`, `DRY-RUN`, `APLICAÇÃO` e `DEPOIS`.

A função ganhou duas opções, que o trigger não passa:

- `dryRun`: conta o que faria, sem transação e sem a claim em `notif_dedup`.
- `backfill.departedAt`: o corte de jogo público, abaixo.

**Quem entra:** os vínculos em `groups/{grupo}/members/{pessoa}` que não estão ativos pelo `isActiveMember`
(`INACTIVE`, `REMOVED`, `BLOCKED`, `BANNED`), fora do merge de contas (`merged_to_uid`). A busca é um
collection group sem `where()`, filtrada no script, para não depender de índice. Vínculo apagado não é
encontrado e fica de fora.

**Jogo aberto ao público** (`visibility: PUBLIC_OPEN`, ou `is_public` legado): quem saiu pode entrar de novo
na fila como avulso (`joinGameWaitlist` aceita), e o trigger, que roda na hora da saída, nunca veria essa
entrada nova. O backfill desfaz só o que o trigger teria visto: confirmação (`created_at`) e entrada da fila
(`added_at`) até a data da saída, o `updated_at` do vínculo, que a saída pelo web grava. A saída pelo
Android não grava data; nesse caso o item de jogo público fica como está e entra na contagem
`jogoPublicoMantido`. Jogo só do grupo é limpo como no trigger, com ou sem data. Confirmar presença de novo
não é possível para quem saiu: `confirmGamePresence` recusa vínculo que não está ativo.

**Efeito no apply:** cada vaga repassada (`vagasRepassadas`) chama o próximo da fila com o push de vaga, como
no trigger. O dry-run mostra esse número antes.

**Idempotência:** cada escrita relê o documento. A passagem da vaga usa a claim
`member_departed:backfill:{grupo}:{pessoa}:{jogo}`: rodar de novo, mesmo depois de uma queda entre repassar a
vaga e apagar a entrada, não chama outra pessoa.

**Saída:** só ids e contadores, uma linha por pessoa com algo a fazer, sem nome nem contato.

**Como rodar** (Renan, depois do deploy do trigger):

```bash
cd functions && npm run build
node lib/scripts/backfill-departed-member-games.js --project=futebadosparcas
node lib/scripts/backfill-departed-member-games.js --apply --project=futebadosparcas
```

**Testes:** `functions/test/permissions/backfill-departed-member-games.test.ts` (Firestore falso): opções da
linha de comando, quem entra no scan, dry-run sem nenhuma escrita, apply igual ao trigger com a vaga
repassada uma vez, segunda rodada sem escrita, queda entre repassar e apagar, corte de jogo público com e sem
data, e merge de contas. Os testes do trigger continuam passando sem mudança.

**Verificação:**

- [x] Build, lint e jest das functions verdes
- [x] Emulador (`demo-futeba`): dry-run sem escrita, apply com 2 confirmações canceladas, 2 entradas da fila
      removidas e 1 vaga repassada, segundo apply sem mudança; jogo encerrado, ativo, merge e jogo público
      depois da saída ficaram como estavam
- [ ] Dry-run e apply em produção (Renan, depois do deploy de `onMemberDepartedCleanupGames`)
