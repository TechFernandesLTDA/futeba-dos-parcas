# BUGFIX: Campos CPF mirror não protegidos em firestore.rules — issue #1306

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Renan Locatiz Fernandes
> **Data:** 2026-05-17
> **PR:** #1306

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

A branch `owner-update` em `users/{uid}` (~L410-449) aplica `fieldUnchanged()` para campos de gamificação e PII, mas **não inclui** `verifiedAt` nem `cpfVerifiedAt`. Esses dois campos são escritos exclusivamente pelas Cloud Functions `setUserVerified` e `verifyCpf` via Admin SDK (bypass de rules). Sem a proteção, qualquer cliente autenticado pode escrever:

```js
updateDoc(doc('users', myUid), { cpfVerifiedAt: serverTimestamp() })
// → campo refletido em listeners sem que a Cloud Function tenha sido chamada
```

### 1.2 Comportamento Esperado (Correto)

`cpfVerifiedAt` e `verifiedAt` devem ser imutáveis via regras client-side, da mesma forma que `experience_points` e `role`. A Cloud Function continua escrevendo via Admin SDK (que ignora rules).

### 1.3 Causa Raiz

Campos foram adicionados posteriormente à última revisão de `fieldUnchanged()`. A whitelist ficou defasada.

### 1.4 Impacto

- NÃO é bypass de autenticação — a fonte de verdade para verificação é o custom claim `verified` (JWT), não esses campos.
- É integridade de dado: qualquer UI ou listener que exiba badge/status com base em `verifiedAt`/`cpfVerifiedAt` pode ser enganado por um cliente malicioso.

---

## 2. Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `firestore.rules` | Adicionar `fieldUnchanged('verifiedAt')` e `fieldUnchanged('cpfVerifiedAt')` na branch owner-update |
| `firestore-rules-tests/src/users.test.ts` | Adicionar testes cobrindo os campos agora protegidos |

> `cpfMasked` foi investigado: reside apenas em `users_private/{uid}`, não em `users/{uid}`. Não requer proteção aqui.

---

## 3. Solução

Adicionar na linha de `allow update` da branch `owner-update`:

```js
// ANTES (incompleto)
fieldUnchanged('email') &&
fieldUnchanged('fcm_token') &&
// ...

// DEPOIS
fieldUnchanged('email') &&
fieldUnchanged('fcm_token') &&
// CPF-audit #1306: campos mirror gravados SÓ por Cloud Function
fieldUnchanged('verifiedAt') &&
fieldUnchanged('cpfVerifiedAt') &&
// ...
```

---

## 4. Testes

- `it("Player NÃO pode escrever 'cpfVerifiedAt' diretamente")`
- `it("Player NÃO pode escrever 'verifiedAt' diretamente")`
- `it("Player PODE atualizar campos básicos mesmo com as novas restrições")` (regressão)

---

## 5. Verificação

- [ ] `npm test` em `firestore-rules-tests/` passa verde
- [ ] Testes novos aparecem com assertFails para os campos protegidos
- [ ] Teste de regressão do update legítimo passa com assertSucceeds
