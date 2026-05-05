# SPEC: Critical Security Fixes (Privilege Escalation)

**Status:** APPROVED
**Date:** 2026-05-04
**Owner:** TechFernandesLTDA
**Type:** Security Bugfix
**Priority:** CRITICAL — privilege escalation real

---

## Contexto

Auditoria 2026-05-03 (issues #421-#442) identificou 4 vulnerabilidades CRITICAL de escalada de privilégios. Esta spec resolve todas em uma PR consolidada.

## Issues a fechar

### #427 — Self-promotion OWNER via TOCTOU (firestore.rules:1004-1009)
**Vetor**: Branch `!exists(/groups/$(groupId))` permite criar `/groups/X/members/Y` com `role=OWNER` ANTES do dono criar grupo X. Atacante pré-cria membership como OWNER em groupIds previsíveis.

**Fix**: Remover branch `!exists()`. OWNER membership só via Cloud Function trigger (Admin SDK).

### #428 — Impersonation via confirmations create (firestore.rules:497-502)
**Vetor**: Branch "dono do jogo cria summon" não enforça `user_id != self`, doc-id pattern, nem `status='PENDING'`. Dono pode criar conf docs com user_id=vítima e usar como evidência falsa.

**Fix**: Validações extras na branch summon: pattern doc-id, status PENDING, user_id != self.

### #429 — setUserRole sem App Check + sem revokeRefreshTokens (custom-claims.ts:77,289)
**Vetor**:
- `appCheck: false` hardcoded em prod → token admin roubado serve em qualquer cliente.
- Sem `revokeRefreshTokens(uid)` após `setCustomUserClaims` → JWT velho válido por 1h após demoção.

**Fix**:
- `appCheck: process.env.NODE_ENV === 'production'`
- Adicionar `await admin.auth().revokeRefreshTokens(uid)` após mudança de role.

### #438 — confirmations.update sem fieldUnchanged (firestore.rules:504-513)
**Vetor**: Dono da confirmação atualiza QUALQUER campo (incluindo `is_mvp`, `was_present`, `checked_in`).

**Fix**: Whitelist `onlyAllowedFields(['is_on_the_way', 'eta_minutes', 'on_the_way_at'])` no branch self-update. Campos sensíveis exigem game owner ou Cloud Function.

---

## Implementação

### firestore.rules

**Helper `onlyAllowedFields` já existe** ou precisa ser criado:

```javascript
function onlyAllowedFields(allowed) {
  return request.resource.data.diff(resource.data).affectedKeys().hasOnly(allowed);
}
```

#### Mudança 1 — groups/members create (#427)
Antes:
```javascript
(request.resource.data.role == 'OWNER' && request.resource.data.user_id == userId() &&
 !exists(/databases/$(database)/documents/groups/$(groupId)))
```
Depois: **branch removida**. Membership OWNER apenas via Cloud Function `onGroupCreated` trigger.

#### Mudança 2 — confirmations create (#428)
Antes:
```javascript
(isGameOwner(request.resource.data.game_id) &&
 request.resource.data.game_id != null)
```
Depois:
```javascript
(isGameOwner(request.resource.data.game_id) &&
 request.resource.data.user_id != userId() &&
 isValidConfirmationId(confirmationId, request.resource.data.game_id, request.resource.data.user_id) &&
 request.resource.data.get('status', 'PENDING') == 'PENDING')
```

#### Mudança 3 — confirmations update self (#438)
Antes:
```javascript
(resource.data.user_id == userId())  // sem restrição
```
Depois:
```javascript
(resource.data.user_id == userId() &&
 onlyAllowedFields(['is_on_the_way', 'eta_minutes', 'on_the_way_at',
                     'updated_at']))
```

### functions/src/auth/custom-claims.ts (#429)

#### Mudança 4 — setUserRole hardening
```typescript
export const setUserRole = secureCallable<SetUserRoleRequest>(
  {
    appCheck: process.env.NODE_ENV === 'production',  // era false
    requiredRole: 'ADMIN',
    rateLimit: {...},
  },
  async (data, context) => {
    ...
    await admin.auth().setCustomUserClaims(uid, {role});
    await admin.auth().revokeRefreshTokens(uid);  // novo
    return {success: true};
  }
);
```

#### Mudança 5 — migrateAllUsersToCustomClaims
Mesmo `appCheck: process.env.NODE_ENV === 'production'`.

### Cloud Function `onGroupCreated` (já existe?)
Verificar se função trigger já cria OWNER membership. Se sim, OK. Se não, adicionar:

```typescript
export const onGroupCreated = onDocumentCreated(
  'groups/{groupId}',
  async (event) => {
    const group = event.data?.data();
    if (!group?.owner_id) return;
    await admin.firestore()
      .doc(`groups/${event.params.groupId}/members/${group.owner_id}`)
      .set({
        user_id: group.owner_id,
        role: 'OWNER',
        joined_at: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});
  }
);
```

---

## Risk Assessment

| Mudança | Risco | Mitigação |
|---------|-------|-----------|
| Remove branch !exists groups/members | Cliente que cria grupo via SDK direto quebra | Cloud Function `onGroupCreated` trigger cobre. Verificar Android `CreateGroupUseCase` usa Cloud Function ou SDK direto. |
| Tighten confirmations create owner | Owner não pode mais criar fake conf | Intencional |
| Tighten confirmations update self | Bug em UI que escreve campos não-whitelist | Auditar usos client-side |
| App Check enforcement | Apps debug sem App Check Debug Token quebram | Setup já existe per CLAUDE.md (DebugAppCheckProviderFactory) |
| revokeRefreshTokens | Usuário precisa re-login após mudança de role | Aceitável — mudança rara |

---

## Test Plan

- [ ] Firestore Rules emulator tests:
  - [ ] Deny: criar /groups/foo/members/x role=OWNER quando /groups/foo não existe
  - [ ] Deny: dono cria conf com user_id=self via summon branch
  - [ ] Deny: jogador updateDoc({is_mvp: true}) na própria confirmação
  - [ ] Allow: jogador updateDoc({is_on_the_way: true})
- [ ] Cloud Functions:
  - [ ] setUserRole rejeita request sem App Check token em prod
  - [ ] Após setUserRole, JWT antigo invalidado (revokeRefreshTokens)
- [ ] Smoke prod:
  - [ ] Login normal funciona
  - [ ] Confirm presença funciona
  - [ ] Criar grupo funciona (via Cloud Function se houver, ou rule remanescente)

---

## Out of scope

- Issues #431, #433 (HIGH RBAC) — fix separado pra reduzir risco do PR atual
- Issues 422-426, 430, 432, 434, 436, 440, 442 (game lifecycle, location, XP) — backlog
- Field-level deny em users.fcm_token (#433) — refactor de profile, separado

---

## Closes
#427, #428, #429, #438 (4 CRITICAL).
