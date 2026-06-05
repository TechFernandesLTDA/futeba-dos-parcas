# BUGFIX — "Descobrir Grupos" dá PERMISSION_DENIED (list query vs read-rule com get())

- **Status:** APPROVED
- **Issue:** #2522
- **Data:** 2026-06-04
- **Tipo:** Bugfix (Firestore Security Rules)
- **Camadas afetadas:** `firestore.rules`, `firestore.indexes.json`, `firestore-rules-tests/`

---

## 1. REQUIREMENTS

### Sintoma
No web, abrir a tela **Descobrir Grupos** retorna `PERMISSION_DENIED` — a lista de
grupos públicos não carrega para nenhum usuário.

### Causa-raiz
A query em `web/src/hooks/useGroups.ts` → `fetchPublicGroups`:

```ts
query(groupsRef, where('is_public','==',true), orderBy('created_at','desc'), fsLimit(100))
```

filtra **apenas** `is_public==true`. A read-rule de `groups` (firestore.rules, L1343)
ANDava 3 cláusulas:

1. `!('deleted_at' in resource.data) || resource.data.deleted_at == null || isAdmin()`
2. `isAdmin() || is_public==true || owner_id==userId() || isGroupMember(groupId)`
3. `isAdmin() || isGroupActive(groupId)` ← **get()-based** (status=='ACTIVE')

Num **list query**, o Firestore avalia a rule contra **cada doc retornado** e nega a
query **inteira** se qualquer doc não a satisfaz (não há "skip"). A query não garante
a cláusula 1 (deleted_at) nem a 3 (`isGroupActive` faz `get()` do próprio doc). O
cliente filtra `deleted_at`/`status==DELETED` **depois** do fetch — tarde demais.

**Resultado:** assim que um grupo público no top-100-por-`created_at` fica
não-ACTIVE (SUSPENDED/ARCHIVED) ou soft-deleted, a discovery quebra para todos
(bug **data-dependente**).

### Confirmação empírica (emulador de rules)
Teste de pinning seedou 1 grupo público ACTIVE + 1 público SUSPENDED + 1 público
soft-deleted e executou `collection('groups').where('is_public','==',true).get()`
como não-membro autenticado:

```
FirebaseError: Null value error. for 'list' @ L1343
code: 'permission-denied'
```

Confirma a cláusula 3 (`isGroupActive`, get-based) como culpada principal — o
`get()` em list query produz o "Null value error"; a cláusula 1 (deleted_at) é
co-culpada para o caso soft-deleted. L1343 é exatamente a `allow read` de groups.

### Não é regressão recente
`isGroupActive` na read-rule data de 2026-05-20 (8c912609), deployado na wave de
05-30. Pré-existente; exposto por mudança de dados.

---

## 2. TECHNICAL DESIGN

### Decisão
Reestruturar a read-rule de `groups` para que o ramo **público** seja
satisfazível por list query (sem `get()`, sem gate de `deleted_at` — o cliente já
filtra estado pós-fetch). Os gates estritos ficam **apenas** no ramo **privado**.

```javascript
allow read: if isAuthenticated() && (
  isAdmin() ||
  resource.data.is_public == true ||              // PÚBLICO: satisfazível por list
  (                                               // PRIVADO: gates estritos (single get)
    (!('deleted_at' in resource.data) || resource.data.deleted_at == null) &&
    isGroupActive(groupId) &&
    (resource.data.owner_id == userId() || isGroupMember(groupId))
  )
);
```

### Alternativa descartada
`where('status','==','ACTIVE')` na query + denormalização de `deleted_at`: mais
pesado, exige migração de dados/índice, e cai no trap de `where('deleted_at','==',null)`
não casar docs sem o campo. Ver `specs/DECISIONS.md` [2026-06-04].

### Tradeoff de segurança
Metadata de grupo público archived/soft-deleted vira legível por qualquer
autenticado (baixa sensibilidade — já era público). Subcoleções (members,
cashbox) seguem protegidas pelas suas próprias rules (#1035). Grupos PRIVADOS
(inclusive soft-deleted) seguem invisíveis a não-membro.

### Índice
A query não muda → continua exigindo o composite index `is_public ASC + created_at DESC`,
que não existia em `firestore.indexes.json`. Adicionado por consistência.

---

## 3. IMPLEMENTATION

- `firestore.rules` — read-rule de `groups` reestruturada (comentário PT-BR explicando list-query vs get()).
- `firestore.indexes.json` — novo índice `groups: is_public ASC + created_at DESC`.
- `firestore-rules-tests/src/groups.test.ts` — bloco `groups — descobrir (list query pública #2522)`:
  - (a) discovery list de público passa (era o pinning do bug — agora verde);
  - (b/b') grupo privado alheio NÃO é legível por não-membro (single get + list);
  - (c) grupo privado soft-deleted não vaza;
  - (d/d') membro/owner leem seu grupo normalmente.

---

## 4. VERIFY

- Pinning (rule ANTIGA): teste (a) FALHA com `permission-denied` ✅ (bug reproduzido).
- Pós-fix: `groups.test.ts` → **41/41 passam**.
- Suíte completa de rules-tests: **557/557 passam** (31 arquivos), zero regressão.

```bash
cd firestore-rules-tests && npx vitest run --no-file-parallelism
```

---

## DoD

- [x] Reproduzir no emulador (pinning falha com rule atual).
- [x] Rules test: discovery list passa; privado alheio não legível; soft-deleted privado não vaza.
- [x] Sem reabrir leitura de grupo PRIVADO por não-membro.
- [x] Suíte completa de rules-tests verde.
- [ ] PR aberto (mudança de rules → revisão humana, NÃO deployar).
