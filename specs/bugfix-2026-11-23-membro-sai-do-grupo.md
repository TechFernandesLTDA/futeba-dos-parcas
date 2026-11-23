# BUGFIX: Membro comum não consegue sair do grupo

> **Status:** `PROPOSED` (correção pedida pela sessão Central TF em 2026-11-23; a aprovação é o merge deste PR)
> **Severidade:** `HIGH`
> **Autor:** Claude (sessão da simulação de uso)
> **Data:** 2026-11-23
> **Base:** `origin/master` em `dcf5ac08`
> **Origem:** simulação de 13 semanas no emulador (PR #4621), achado 1 do relatório

---

## 1. Problema

Um membro comum (papel `MEMBER`) ou um admin que não é dono toca em "Sair do grupo" e recebe
`PERMISSION_DENIED`, no web, no Android e no shared/iOS. Na simulação, 0 de 4 saídas deram certo.

Os três apps saem com um **update** que marca o próprio vínculo como `INACTIVE`:

| App | Onde | O que grava |
|-----|------|-------------|
| Web | `web/src/hooks/useGroups.ts` (`removeGroupMembershipArtifacts`, chamado em `GroupSettingsScreen.tsx`) | `status: 'INACTIVE'`, `updated_at: serverTimestamp()` e apaga `users/{uid}/groups/{gid}` |
| Android | `GroupRepository.kt` (`leaveGroup`, transação) | `status: 'INACTIVE'` e apaga o espelho |
| Shared/iOS | `FirebaseGroupsDataSource.kt` (`leaveGroup`) | `status: 'INACTIVE'` e apaga o espelho (o iOS ainda não tem a ação na tela) |

A regra de update de `groups/{groupId}/members/{memberId}` tem três ramos: admin moderando um MEMBER,
dono mudando papéis e dono editando o próprio vínculo. Nenhum deixa o próprio membro mudar o próprio
status. A regra de delete permitiria sair, mas nenhum app usa delete. O teste de regras só cobria o delete
(`firestore-rules-tests/src/groups.test.ts`, "membro ativo comum ainda pode sair do grupo").

## 2. Correção

Ramo novo na regra de update, só para a saída voluntária:

- só o próprio membro (`memberId == userId()`);
- papel `MEMBER` ou `ADMIN`, e não ser o `owner_id` do grupo (o dono transfere antes, como hoje);
- papel inalterado;
- status atual `ACTIVE` (ou ausente, em vínculos antigos), e o novo status só pode ser `INACTIVE`. Banido
  ou removido não muda o próprio status, então não ganha um caminho para apagar o vínculo e reentrar;
- só `status` e `updated_at` mudam; se `updated_at` mudar, tem de ser a hora do servidor.

As condições comuns aos ramos continuam valendo (`user_id` igual ao id do documento e `user_id`, `id` e
`joined_at` inalterados).

Por que na regra, e não trocar os apps para delete: a regra vale para todas as versões já instaladas, sem
publicar app nas lojas, e mantém o histórico do vínculo, que o contador (`onMemberWritten`) e as telas de
ex-membro já tratam.

Nenhum campo novo fica legível e nenhum dado de outra pessoa é tocado.

## 3. Fora deste PR

O web também atualiza `confirmations/{jogo}_{uid}` de cada jogo futuro do grupo. Quando a pessoa não tem
confirmação num desses jogos, o documento não existe e o lote inteiro falha. Isso derruba a saída e a
remoção de membro mesmo com esta regra corrigida. A correção é só no cliente e vai em PR próprio
("remover membro com jogo futuro", achado 2).

## 4. Testes

`firestore-rules-tests/src/groups.test.ts`, bloco "groups/members — saída voluntária por update":

- passam: lote do web, transação do Android, admin não dono, vínculo antigo sem status;
- falham: dono, banido, removido, outro status, mudar papel, campo extra, `updated_at` do cliente, tirar
  outra pessoa.

Os quatro casos que devem passar falham na regra atual e passam com a correção (saídas no PR).

## 5. Verificação

- [ ] `npm test` em `firestore-rules-tests` verde
- [ ] Deploy de `firestore:rules` depois do merge (fica com o Renan)
