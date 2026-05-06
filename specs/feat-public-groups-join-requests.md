# SPEC: Request-to-Join em Grupos Públicos (issue #517 Phase 2)

> **Status:** APPROVED (continuando do handoff 2026-05-06)
> **Tipo:** feature (full-stack)
> **Owner:** @renankakinho69
> **Data:** 2026-05-06
> **Refs:** #517 (issue), #521 (PR web Phase 1), #523 (PR Android Phase 1.b)

---

## 1. Requirements

### 1.1 Problema

Discovery de grupos públicos foi entregue em PR #521 (web) e PR #523 (Android),
mas é **read-only**: o usuário vê grupos públicos mas não tem como entrar.
Workaround atual é "pedir link de convite ao organizador" — fluxo manual fora
do app.

User original (chat 2026-05-06): _"grupo publico criado por mim nao fica
visivel para outro pedir para entrar"_. Phase 1+1.b resolveram a parte de
visibilidade. Phase 2 resolve a parte de pedir entrada.

### 1.2 Casos de uso

**UC1 — Usuário não-membro pede entrada em grupo público**
- Pré-condição: grupo `is_public=true`, usuário autenticado, não-membro, sem request prévio
- Ação: clica "Pedir entrada" em DiscoverGroupsScreen
- Resultado: cria `groups/{gid}/join_requests/{uid}` com `status=PENDING`. UI mostra "Aguardando aprovação"

**UC2 — Owner aprova solicitação**
- Pré-condição: owner ou admin do grupo, há requests com `status=PENDING`
- Ação: abre tela "Solicitações pendentes" (em GroupSettings/GroupDetail), clica Aprovar
- Resultado: rule permite update de `status=PENDING → APPROVED`. Cloud Function `onJoinRequestApproved` cria `members/{uid}` e dispara push pro requester

**UC3 — Owner rejeita solicitação**
- Idem UC2, mas `status → REJECTED`. Sem cascade. Sem notificação push (silencioso para evitar embaraço)

**UC4 — Requester desiste**
- Pré-condição: requester tem request PENDING próprio
- Ação: clica "Cancelar pedido" em DiscoverGroups
- Resultado: requester pode deletar próprio request

### 1.3 Critérios de aceite

- [ ] Não-membro consegue pedir entrada em grupo público
- [ ] Estado visível na UI quando tem request PENDING
- [ ] Owner vê lista de pending requests no grupo
- [ ] Aprovação adiciona usuário a `members/` automaticamente (via CF, não UI)
- [ ] Rejeição não adiciona membro
- [ ] Push notification chega ao requester quando aprovado
- [ ] Não é possível pedir 2x (rule rejeita create se request já existe)
- [ ] Membros existentes não veem botão "Pedir entrada"
- [ ] Owner pode revogar antes de aprovar (deleta o request)
- [ ] Cobertura de tests: rules (Layer 3), function (Layer 2), UI (Layer 1) — alvo 80%+

### 1.4 Fora de escopo

- Notificação ao owner quando alguém pede entrada (Phase 3)
- Aprovação em massa
- Auto-aprovação configurável por grupo
- Histórico de requests rejeitados (TTL 30 dias via maintenance function — Phase 3)
- iOS UI (depende reativar trabalho iOS)

---

## 2. UX/UI Design

### 2.1 Fluxo

```
DiscoverGroupsScreen
  └─ tap card grupo público (não-membro)
       └─ GroupDetailScreen (já existe, rule de read permite)
            ├─ se NÃO tem request: botão "Pedir entrada" (CTA primary)
            ├─ se tem request PENDING: chip "Aguardando aprovação" + botão "Cancelar pedido"
            └─ se tem request APPROVED: já é membro → ver tela normal
            └─ se tem request REJECTED: chip "Pedido recusado" (sem ação)

GroupSettingsScreen (owner/admin)
  └─ nova seção "Solicitações pendentes"
       └─ lista de requests PENDING com avatar + nome + tempo
            └─ ações: [Aprovar] [Recusar]
```

### 2.2 Telas e estados

**DiscoverGroupsScreen** (já existe):
- Mantém comportamento atual. Sem mudança visual no card.

**GroupDetailScreen** (modificar — web + Android):
- Header: se não-membro + público + sem request → botão "Pedir entrada"
- Header: se request PENDING → chip "Aguardando aprovação" + "Cancelar"
- Header: se request REJECTED → chip "Pedido recusado"
- Resto da tela: usuário vê info do grupo (rule já permite read em públicos)

**GroupSettingsScreen** (modificar — web + Android, owner/admin only):
- Nova seção "Solicitações pendentes (N)" antes de "Configurações"
- LazyColumn de cards: avatar, nome, "pediu há X tempo"
- Botões inline: ✓ Aprovar (primary) | ✗ Recusar (outlined)
- Loading per-action (botão substituído por spinner)
- Empty state se 0 pending: "Nenhuma solicitação pendente"

### 2.3 Notification

Push (FCM) ao requester quando APPROVED:
- Title: "Você foi aceito em {groupName}!"
- Body: "{ownerName} aprovou sua entrada. Toque pra abrir o grupo."
- Data: `{type: "GROUP_JOIN_APPROVED", groupId: "..."}`
- Tap action: navegar pra GroupDetailScreen do grupo

### 2.4 Acessibilidade

- contentDescription nos botões
- Touch targets ≥ 48dp
- Anúncio acessível quando estado muda (via `LiveRegion` no web, `liveRegion` no Compose)

---

## 3. Technical Design

### 3.1 Arquitetura

```
[Cliente Web/Android]
  ↓ create
groups/{gid}/join_requests/{uid}
  ↓ owner update status=APPROVED
[Firestore Rules: valida transição]
  ↓ trigger
[Cloud Function onJoinRequestApproved]
  ├─ create groups/{gid}/members/{uid}
  ├─ update groups/{gid}.member_count++
  ├─ create users/{uid}/groups/{gid}
  └─ send FCM push to requester
```

### 3.2 Modelo de dados

**`groups/{groupId}/join_requests/{userId}`** (subcoleção nova):

| Campo | Tipo | Required | Descrição |
|-------|------|----------|-----------|
| `user_id` | string | sim | UID do requester (igual ao docId) |
| `user_name` | string | sim | Nome no momento do request (snapshot) |
| `user_photo` | string? | não | Foto URL |
| `status` | string | sim | `PENDING` \| `APPROVED` \| `REJECTED` |
| `requested_at` | timestamp | sim | `serverTimestamp()` no create |
| `responded_at` | timestamp? | não | preenchido em update |
| `responded_by` | string? | não | UID do owner/admin que respondeu |

DocId = userId garante 1 request por usuário por grupo (idempotência natural).

### 3.3 Firestore Rules

```javascript
// Adicionar dentro de match /groups/{groupId}
match /join_requests/{requesterId} {
  // Read: requester vê próprio, owner/admin vê todos
  allow read: if isAuthenticated() && (
    requesterId == userId() ||
    isGroupOwnerById(groupId) ||
    isGroupAdmin(groupId) ||
    isAdmin()
  );

  // Create: só não-membro pede pro próprio uid em grupo público
  allow create: if isAuthenticated() &&
    requesterId == userId() &&
    request.resource.data.user_id == userId() &&
    request.resource.data.status == 'PENDING' &&
    // Grupo precisa ser público
    get(/databases/$(database)/documents/groups/$(groupId)).data.is_public == true &&
    // Não pode ser membro
    !exists(/databases/$(database)/documents/groups/$(groupId)/members/$(userId()));

  // Update: owner/admin transiciona PENDING → APPROVED|REJECTED
  allow update: if isAuthenticated() &&
    (isGroupOwnerById(groupId) || isGroupAdmin(groupId)) &&
    resource.data.status == 'PENDING' &&
    request.resource.data.status in ['APPROVED', 'REJECTED'] &&
    request.resource.data.responded_by == userId();

  // Delete: requester deleta próprio (cancelar) ou owner deleta qualquer (limpar)
  allow delete: if isAuthenticated() && (
    requesterId == userId() ||
    isGroupOwnerById(groupId) ||
    isGroupAdmin(groupId)
  );
}
```

### 3.4 Cloud Function

**`functions/src/groups/join-requests.ts`** (arquivo novo):

```typescript
export const onJoinRequestApproved = onDocumentUpdated(
  'groups/{groupId}/join_requests/{userId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Só processa transição PENDING → APPROVED
    if (before.status !== 'PENDING' || after.status !== 'APPROVED') return;

    const { groupId, userId } = event.params;
    const db = getFirestore();
    const batch = db.batch();

    // 1. Criar member
    const memberRef = db.doc(`groups/${groupId}/members/${userId}`);
    batch.set(memberRef, {
      id: userId,
      user_id: userId,
      user_name: after.user_name,
      user_photo: after.user_photo || null,
      role: 'MEMBER',
      status: 'ACTIVE',
      joined_at: FieldValue.serverTimestamp(),
      invited_by: after.responded_by,
    });

    // 2. Increment group.member_count
    batch.update(db.doc(`groups/${groupId}`), {
      member_count: FieldValue.increment(1),
      updated_at: FieldValue.serverTimestamp(),
    });

    // 3. Criar users/{uid}/groups/{gid} (denormalized)
    const groupSnap = await db.doc(`groups/${groupId}`).get();
    const group = groupSnap.data();
    batch.set(db.doc(`users/${userId}/groups/${groupId}`), {
      id: groupId,
      group_id: groupId,
      group_name: group?.name,
      group_photo: group?.photo_url || null,
      role: 'MEMBER',
      member_count: (group?.member_count || 0) + 1,
      joined_at: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // 4. Push notification (best-effort, não bloqueia)
    await sendApprovalPush(userId, groupId, group?.name).catch((e) => {
      logger.warn('push approval failed', { userId, groupId, error: e.message });
    });
  }
);
```

### 3.5 Segurança

- Rule de create exige `is_public == true` no grupo (impede pedir entrada em privado)
- Rule de create exige `!exists(.../members/$(userId))` (impede pedir já sendo membro)
- Rule de update exige owner/admin + transição válida (PENDING → APPROVED|REJECTED apenas)
- Cloud Function valida antes de criar member (defesa em profundidade)
- DocId == userId previne spam (1 request por user por grupo)

### 3.6 Performance

- Sub-coleção é per-group, queries naturalmente escopadas
- Listeners ativos só em GroupSettingsScreen (owner) — não em DiscoverGroups
- Index composto: nenhum necessário (query usa só docId ou orderBy requested_at)
- Limite implícito: ~1000 pending por grupo é razoável (Firestore aguenta)

---

## 4. Tasks (Breakdown PRs)

### PR A — Spec (este doc)
- [x] Criar `specs/feat-public-groups-join-requests.md`

### PR B — Layer 3: Firestore Rules + Tests
- [ ] Adicionar rules em `firestore.rules` (subcoleção `join_requests`)
- [ ] Tests em `firestore-rules-tests/src/join-requests.spec.ts` (~15 tests cobrindo todos os UCs + negative cases)
- [ ] CI roda em self-hosted

### PR C — Layer 2: Cloud Function + Tests
- [ ] `functions/src/groups/join-requests.ts` com `onJoinRequestApproved` trigger
- [ ] Helper `sendApprovalPush` em `functions/src/groups/notifications.ts`
- [ ] Export em `functions/src/index.ts`
- [ ] Jest tests em `functions/test/join-requests.test.ts` (~8 tests)

### PR D — Web UI
- [ ] Hook `useJoinRequest(groupId)` em `web/src/hooks/useJoinRequests.ts`
- [ ] Hook `usePendingJoinRequests(groupId)` (owner)
- [ ] Botão "Pedir entrada" em `GroupDetailScreen.tsx` (web)
- [ ] Seção "Solicitações pendentes" em `GroupSettingsScreen.tsx` ou nova rota
- [ ] Vitest tests para hooks

### PR E — Android UI
- [ ] `JoinRequestRepository` em `app/.../data/repository/`
- [ ] Hook em `GroupDetailViewModel` ou novo `JoinRequestViewModel`
- [ ] Botão "Pedir entrada" em `GroupDetailScreen.kt`
- [ ] Tela "Solicitações pendentes" em `GroupSettingsScreen.kt` (existe?) ou modal/bottom sheet
- [ ] Tests JUnit + MockK

### PR F — Deploy
- [ ] `firebase deploy --only firestore:rules`
- [ ] `firebase deploy --only functions:onJoinRequestApproved`
- [ ] Smoke test prod: criar request real → aprovar → verificar member criado + push chega

---

## 5. Validation

- [ ] Compile checks pass
- [ ] All test layers pass
- [ ] Deploy successful
- [ ] Smoke test em produção
- [ ] Issue #517 closed
