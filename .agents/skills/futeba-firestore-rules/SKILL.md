---
name: futeba-firestore-rules
description: Editar/validar/deploy security rules + indexes do Firestore. Inclui custom claims pattern (PERF_001), emulator testing, common pitfalls. Use quando o usuário pedir "alterar rules", "novo index", "permission denied", "security audit".
---

# Futeba Firestore Rules

Security rules do projeto seguem padrão PERF_001 (custom claims via JWT, evita 40% Firestore reads).

## Arquivos

- `firestore.rules` — security rules
- `firestore.indexes.json` — composite indexes

## Padrão Custom Claims (PERF_001)

```javascript
// PREFIRA (0 reads — usa JWT token):
function isAdmin() {
  return request.auth.token.role == 'ADMIN';
}

// EVITE (1 read por chamada — Firestore lookup):
function isAdmin() {
  return isAuthenticated() && getUserRole() == 'ADMIN';
}
```

Custom Claims setados via Cloud Function `setUserRole` em `functions/src/auth/custom-claims.ts`.

## Helpers existentes

```javascript
function isAuthenticated() { return request.auth != null; }
function isAdmin() { return request.auth.token.role == 'ADMIN'; }
function isGroupAdmin(groupId) { return get(/databases/$(database)/documents/groups/$(groupId)).data.adminIds.hasAny([request.auth.uid]); }
function isGameOwner(gameId) { return get(/databases/$(database)/documents/games/$(gameId)).data.ownerId == request.auth.uid; }
```

## Workflow

```bash
# 1. Editar firestore.rules

# 2. Validar sintaxe local (sem deploy)
firebase emulators:exec --only firestore "echo 'rules compiled OK'" --project futebadosparcas

# 3. Test com emulator
firebase emulators:start --only firestore,auth --project futebadosparcas
# Em outro terminal: rodar tests Functions ou app conectado

# 4. Deploy seletivo (apenas rules)
firebase deploy --only firestore:rules --project futebadosparcas --non-interactive

# 5. Validar via console
# https://console.firebase.google.com/project/futebadosparcas/firestore/rules
```

## Common pitfalls

### `Unused function` warnings (cosmético, não bloqueia)
Helpers definidos mas não chamados. Remover ou marcar `// @ts-ignore` se temporário.

### `Invalid variable name: request`
Erro em `firestore.exists(...)` (deveria ser `exists(...)`). Função top-level do Firestore Rules.

### `whereIn` queries limitadas a 10 items
Em código (não rules):
```kotlin
ids.chunked(10).map { chunk -> async { firestore.collection("X").whereIn(FieldPath.documentId(), chunk).get().await() } }.awaitAll()
```

### Composite indexes faltando
Sintoma: app retorna `FAILED_PRECONDITION` com link pra criar index.

Workflow:
```bash
# 1. Click no link do erro → cria via UI
# 2. Após criação, exportar:
firebase firestore:indexes --project futebadosparcas > firestore.indexes.json
git add firestore.indexes.json && commit
```

OU adicionar manual em `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "games",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "scheduledAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy: `firebase deploy --only firestore:indexes --project futebadosparcas`

## Testing rules

`functions/test/` tem testes de regras com firebase-rules-unit-testing:
```typescript
const testEnv = await initializeTestEnvironment({
  projectId: "futebadosparcas-test",
  firestore: { rules: readFileSync("../firestore.rules", "utf8") },
});
const alice = testEnv.authenticatedContext("alice", { role: "ADMIN" });
await assertSucceeds(setDoc(doc(alice.firestore(), "users/bob"), { name: "Bob" }));
```

## Rollback

Se rules deploy quebrou prod:
```bash
# Revert via git
git revert <commit-of-bad-rules>
firebase deploy --only firestore:rules --project futebadosparcas

# OU rollback direto via console (Firestore Rules → History → previous)
```
