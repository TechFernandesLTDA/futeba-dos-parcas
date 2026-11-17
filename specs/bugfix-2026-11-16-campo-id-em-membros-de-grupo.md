# BUGFIX: campo `id` gravado em membros de grupo e no espelho de grupos do usuário (#4585)

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `MEDIUM` (a leitura do Android já tolera; os escritores continuavam criando o problema)
> **Autor:** Claude Code (issue #4585, avaliação de 16/11/2026)
> **Data:** 2026-11-16

---

## 1. Descrição do bug

Quatro escritores gravavam o campo `id` dentro de `groups/{grupo}/members/{uid}`, e dois deles também em
`users/{uid}/groups/{grupo}`. O modelo do Android usa `@DocumentId` em `id` e o mapper do Firestore lança quando
acha um campo gravado com o mesmo nome. Foi a origem do app fechando em "Meus grupos" e na lista de membros
(1.43.2 e 1.43.3). O #4566 e o #4569 corrigiram a leitura; os escritores ficaram.

Efeito enquanto os escritores existem: cada documento novo gera o aviso não fatal
`Campo gravado com o nome do @DocumentId em members` no Crashlytics (1 evento na 1.43.4) e fecha as versões do
app anteriores à 1.43.4.

## 2. Causa raiz

O "escritor desconhecido" registrado como pendência no #4569 eram estes:

| Arquivo | Caminho | Campo |
|---------|---------|-------|
| `web/src/hooks/useGroups.ts` (`useCreateGroup`) | membro dono, ao criar o grupo | `id: uid` |
| `functions/src/groups/invite-redeemed.ts` | membro e espelho, ao entrar por código | `id: userId`, `id: groupId` |
| `functions/src/groups/join-requests.ts` | membro e espelho, ao aprovar pedido | `id: userId`, `id: groupId` |
| `functions/src/notifications/presence-notifications.ts` | membro, ao aceitar convite | `id: invitedUserId` |

`account-merge.ts` só repassa o que já existe no documento (spread), não cria o campo.

## 3. Solução

Remover as seis linhas. Nenhum leitor usa o campo:

- web: `{ id: doc.id, ...dados }`;
- Android: `@DocumentId` em `data.model.GroupMember`; o espelho é lido por `userGroupFromFirestore(doc.id, ...)`;
- iOS (`shared/nativeAndAndroidMain`): `doc.id`;
- regras: nenhuma consulta a `data.id`; nenhuma consulta com `where('id', ...)` no repositório.

### Fora do escopo

- `teams`: o `id` gravado ali é lido pelo Android (`LiveGameRepository` usa `teams[n].id` vindo do campo). Fica.
- Outras coleções com `id` gravado (`confirmations`, `game_events`, `live_player_stats`, `notifications`,
  `users`): os modelos do Android dessas coleções não têm `@DocumentId`, então não há conflito.
- Limpeza de dados: em produção, só as contas fictícias da bateria têm o campo, de propósito.

### Riscos

Baixo. O campo é redundante com o ID do documento. O merge de contas e o `set(..., {merge: true})` do convite
aceito não apagam um `id` antigo, e nem precisam.

## 4. Verificação

- `functions`: `npm run build`, ESLint nos três arquivos e Jest das cinco suítes de convite, pedido e presença
  (82 testes).
- `web`: `tsc`, ESLint e Vitest de `useGroups` e `CreateGroupScreen` (34 testes).
- Bateria (`scripts/bateria/rodar.sh web` e `android`): criar grupo, entrar por pedido e por convite.

## 5. Publicação

Functions (`onInviteRedeemed`, `onJoinRequestApproved` e o gatilho de convite aceito) e hosting do web.
Sem mudança de regras nem de índices. Não exige versão nova do Android.

## 6. Prevenção

A bateria mantém documentos legados com `id` gravado (seed) para a leitura tolerante continuar coberta. O aviso
`reportConflictOnce` no Crashlytics passa a indicar escritor novo, e não mais ruído conhecido.
