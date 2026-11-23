# BUGFIX: Recusado ou ex-membro não consegue pedir para entrar de novo

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `MEDIUM`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `45946afa`
> **Origem:** simulação de uso no emulador (PR #4621), issue #4629 item 22

---

## 1. Problema

Em grupo público, quem teve o pedido recusado ou saiu do grupo não consegue pedir para entrar de novo.

- **Web:** a tela do grupo mostra "Seu pedido foi recusado" sem botão, e com pedido `APPROVED` (quem saiu
  depois de aprovado) não mostra nada.
- **Cliente:** `requestJoin` grava o pedido com `setDoc` em `groups/{gid}/join_requests/{uid}`. Se o
  documento antigo existe, a escrita é um update, e a regra só deixa dono ou admin atualizar um pedido
  `PENDING`. A escrita é negada.
- **Function:** `onJoinRequestApproved` pula a aprovação quando o documento de membro existe. Quem saiu fica
  com o vínculo `INACTIVE`, então mesmo um pedido novo aprovado não devolvia a pessoa ao grupo.

## 2. Correção

**Regras:** não mudam. O create já aceita quem nunca foi membro ou tem vínculo `INACTIVE`, e o dono do pedido
já pode apagá-lo. Os testes novos provam que apagar e criar de novo funciona.

**Web (`useMyJoinRequest`, `GroupDetailScreen`):**

- Para pedir de novo, apaga o pedido antigo (`REJECTED` ou `APPROVED`) e cria um `PENDING` novo, em duas
  escritas separadas.
- Lê o próprio documento de membro, que a regra deixa ler:
  - sem pedido, recusado, ou aprovado com vínculo `INACTIVE`: botão para pedir ("Pedir de novo" depois de
    recusado);
  - aprovado sem vínculo ainda: sem botão. O `onJoinRequestApproved` está criando o membro, e pedir de novo
    nessa hora apagaria a aprovação;
  - vínculo `REMOVED`, `BLOCKED` ou `BANNED`: aviso de que o organizador encerrou a participação, sem botão
    (a regra de create recusa esses casos).

**Function (`onJoinRequestApproved`):**

- Vínculo `INACTIVE`: reativa o membro. Usa `set` sem merge, com o mesmo formato da criação: `role: MEMBER`,
  `status: ACTIVE`, `joined_at` novo, `invited_by` igual a quem aprovou. Assim um ex-admin volta como membro e
  nada de antes da saída fica no documento. Também grava de novo `users/{uid}/groups/{gid}`.
- Na reativação a function não soma em `member_count` nem grava `_counted_by_join_request`: a passagem de
  `INACTIVE` para `ACTIVE` já é contada pelo `onMemberWritten` (`REACTIVATED`). Somar nos dois lugares
  contaria a pessoa duas vezes.
- `ACTIVE`, `REMOVED`, `BLOCKED` e `BANNED` continuam ignorados. A checagem fica dentro da transação, e uma
  segunda entrega da aprovação encontra o membro `ACTIVE` e sai.

**Fora desta correção:**

- Grupo privado: a regra de create exige `is_public == true`.
- Android: a mesma correção do cliente (`createGroupJoinRequest` apaga e cria) vai no PR do Android da
  #4629, junto com os outros itens do Android. Depois do deploy da function, a aprovação de quem saiu já
  funciona para os dois apps.

## 3. Testes

- `functions/test/permissions/group-membership.test.ts` (Firestore falso):
  - ex-membro `INACTIVE` volta como `MEMBER ACTIVE`, sem o papel e os campos antigos;
  - aprovação seguida do `onMemberWritten` deixa `member_count` com +1, uma vez só;
  - segunda entrega não muda o membro;
  - `REMOVED`, `BLOCKED` e `BANNED` continuam fora.
- `web/src/hooks/useJoinRequests.test.ts`:
  - recusado apaga e cria, nessa ordem;
  - aprovado com vínculo `INACTIVE` pode pedir; aprovado sem vínculo ainda não pode;
  - `PENDING` e `ACTIVE` não oferecem o botão;
  - `REMOVED`, `BLOCKED` e `BANNED` bloqueiam.
- `firestore-rules-tests/src/join-requests.test.ts`:
  - sobrescrever o pedido recusado é negado;
  - recusado apaga e cria;
  - `INACTIVE` lê o vínculo, apaga e cria;
  - `REMOVED` apaga, mas não cria.

## 4. Verificação

- [x] Testes das functions, do web e das regras verdes
- [ ] Deploy de `onJoinRequestApproved` depois do merge (fica com o Renan)
- [ ] Web publicado depois do merge (fica com o Renan)
