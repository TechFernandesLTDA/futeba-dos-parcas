# BUGFIX: Contas unificadas (merged) continuam pesquisáveis publicamente

> **Status:** `TRIAGED`
> **Severidade:** `HIGH` (privacidade / identidade — perfil desativado exposto em busca)
> **Autor:** SDD follow-up #3556
> **Data:** 2026-07-12
> **PR:** _(a abrir)_
> **Issue de origem:** #3556 (account unification Eduardo Jordi)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Quando duas contas são unificadas (`completeAccountMerge`), a conta **origem**
(source) é marcada com `account_status: "merged"` em `users/{sourceUid}`, mas o
campo `is_searchable` **não é limpo**. Como todos os caminhos de busca pública
filtram exclusivamente por `is_searchable == true` — sem inspecionar
`account_status` — a conta origem desativada **continua aparecendo** na busca de
jogadores, no ranking da Liga, em reforços de posição e em head-to-head.

Isso foi observado em produção ao unificar a conta Hotmail do Eduardo Jordi na
Gmail canônica: a conta merged permanecia pesquisável até correção manual.

### 1.2 Comportamento Esperado (Correto)

1. Uma conta com `account_status == "merged"` **nunca** deve ser retornada por
   nenhum caminho de busca pública (regras, cache da Liga, nearby players).
2. O fluxo de merge (`completeAccountMerge`) deve definir `is_searchable: false`
   no documento origem ao marcá-lo como `merged` (defense-in-depth: o dado raiz
   reflete o estado desativado).

### 1.3 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Web + Cloud Functions + Firestore Rules (multiplataforma) |
| Frequência | Sempre que ocorre um merge de contas |
| Impacto | Perfil desativado exposto publicamente; identidade duplicada na busca |
| Dados de produção | **Correção do Jordi já aplicada manualmente** (campo limpo em prod) |

> **Nota importante:** o ajuste pontual de dados do Eduardo Jordi já foi feito em
> produção. Esta spec trata **apenas do hardening da lógica** para evitar
> recorrência em merges futuros.

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Foram auditados todos os caminhos que decidem se um `users/{uid}` é "pesquisável":

| Camada | Arquivo | Função/Condição | Exclui `merged`? |
|--------|---------|-----------------|------------------|
| Firestore Rules (read pública) | `firestore.rules:643-655` | `allow read` inline | **NÃO** |
| Cloud Function (cache Liga) | `functions/src/cache/leaderboard-cache.ts:884-892` | `isPublicSearchableUser()` | **NÃO** |
| Cloud Function (nearby players) | `functions/src/social/nearby-players.ts:362-368` | filtro inline em `loadPublicProfiles()` | **NÃO** |
| Cloud Function (operação de merge) | `functions/src/auth/account-merge.ts:1047-1050` | escrita do estado merged | **Não limpa `is_searchable`** |
| Web (queries cliente) | `web/src/components/search/SearchPanel.tsx:193`, `web/src/hooks/usePositionReinforcements.ts:94`, `web/src/pages/statistics/HeadToHeadScreen.tsx:72` | `where('is_searchable','==',true)` | Depende de `is_searchable` estar limpo |

Nenhum dos filtros de busca inspeciona `account_status`. Adicionalmente, o merge
que **deveria** ser a fonte da verdade (escrever `is_searchable: false`) não o
faz. `account_status == 'merged'` só aparece nas rules em **dois** pontos, ambos
no caminho de **escrita/update** (`firestore.rules:737, 742`), nunca no de leitura
pública.

### 2.2 Causa Raiz

Dupla omissão:
1. A operação de merge (`account-merge.ts:1047-1050`) seta `account_status:
   "merged"` mas **não zera `is_searchable`**, deixando o documento num estado
   contraditório (merged + pesquisável).
2. Os filtros de busca pública (rules + functions) consideram apenas
   `is_searchable`/`deleted_at`, **sem cruzar com `account_status`**, então não
   há defesa em profundidade caso o campo `is_searchable` esteja desatualizado.

### 2.3 Definição atual de `isPublicSearchableUser` (insuficiente)

`functions/src/cache/leaderboard-cache.ts:884-892`:

```ts
function isPublicSearchableUser(
  data: FirebaseFirestore.DocumentData
): boolean {
  if (data.deleted_at != null || data.deletedAt != null) return false;
  if (data.is_searchable === false || data.isSearchable === false) {
    return false;
  }
  return data.is_searchable === true || data.isSearchable === true;
}
```

Falta a guarda `account_status != "merged"`.

### 2.4 Condição atual de `allow read` em `firestore.rules:643-655` (insuficiente)

```
allow read: if isOwner(userId) || isAdmin() || (
  isAuthenticated() &&
  (resource.data.is_searchable == true || resource.data.isSearchable == true) &&
  (!('deleted_at' in resource.data) || resource.data.deleted_at == null) &&
  ... // checa PII ausente, mas SEM account_status
);
```

### 2.5 Arquivos Afetados

| Arquivo | Linha | Motivo |
|---------|-------|--------|
| `firestore.rules` | 643-655 | Adicionar exclusão `account_status != 'merged'` na leitura pública |
| `functions/src/cache/leaderboard-cache.ts` | 884-892 | `isPublicSearchableUser` deve rejeitar `account_status == 'merged'` |
| `functions/src/social/nearby-players.ts` | 362-368 | Filtro de `loadPublicProfiles` deve rejeitar `merged` |
| `functions/src/auth/account-merge.ts` | 1047-1050 | Merge deve setar `is_searchable: false` na conta origem |

---

## 3. Solução Proposta

### 3.1 Abordagem

**Defense-in-depth em 4 camadas:**

- **Camada 1 (fonte da verdade):** o merge escreve `is_searchable: false` junto
  com `account_status: "merged"`. Assim queries cliente (`where('is_searchable',
  '==', true)`) já excluem o perfil naturalmente.
- **Camada 2 (regras):** `allow read` pública nega leitura quando
  `account_status == 'merged'`, mesmo que `is_searchable` esteja desatualizado.
- **Camada 3 (functions — Liga):** `isPublicSearchableUser` rejeita `merged`.
- **Camada 4 (functions — nearby):** `loadPublicProfiles` rejeita `merged`.

A combinação garante que um merge incompleto/legado (campo não limpo) ainda seja
filtrado pelos caminhos server-side e pelas rules.

### 3.2 Código Antes/Depois

**Fix 1 — `firestore.rules:643-655`** (adicionar guarda de `account_status`):

```
// DEPOIS (acrescentar uma linha na condição pública)
allow read: if isOwner(userId) || isAdmin() || (
  isAuthenticated() &&
  (resource.data.is_searchable == true || resource.data.isSearchable == true) &&
  (!('account_status' in resource.data) || resource.data.account_status != 'merged') &&
  (!('deleted_at' in resource.data) || resource.data.deleted_at == null) &&
  ... // PII checks existentes mantidos
);
```

> Observação: `account_status` é server-only (`firestore.rules:742` exige
> `fieldUnchanged` no update do owner e `:682` proíbe no create), então o owner
> não pode manipulá-lo para fugir do filtro.

**Fix 2 — `functions/src/auth/account-merge.ts:1047-1050`** (limpar `is_searchable`):

```ts
// DEPOIS
tx.set(sourceUserRef, {
  account_status: "merged",
  is_searchable: false,
  updated_at: verifiedAt,
}, {merge: true});
```

**Fix 3 — `functions/src/cache/leaderboard-cache.ts:884-892`** (`isPublicSearchableUser`):

```ts
// DEPOIS
function isPublicSearchableUser(
  data: FirebaseFirestore.DocumentData
): boolean {
  if (data.deleted_at != null || data.deletedAt != null) return false;
  if (data.account_status === "merged") return false;
  if (data.is_searchable === false || data.isSearchable === false) {
    return false;
  }
  return data.is_searchable === true || data.isSearchable === true;
}
```

**Fix 4 — `functions/src/social/nearby-players.ts:362-368`** (`loadPublicProfiles`):

```ts
// DEPOIS (acrescentar account_status ao predicado existente)
if (
  data.is_searchable !== true ||
  data.account_status === "merged" ||
  data.deleted_at != null ||
  data.deletedAt != null ||
  data.status === "DELETED" ||
  data.is_active === false
) {
  return null;
}
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Conta ativa marcada erroneamente como `merged` some da busca | Reverter `account_status` é operação admin; regra só oculta perfil público, não apaga dados |
| Documentos legados já merged sem `is_searchable: false` | As guards de rules + functions cobrem o gap até backfill; (ver §6) |
| Query `where('is_searchable','==',true)` deixou de retornar merged | Comportamento desejado — é o objetivo do fix |
| Regressão em testes existentes de rules | Novos testes isolados em uid próprio; não reutilizar seeds A-E |

---

## 4. Verificação

### 4.1 Testes de Security Rules (emulador)

Adicionar em `firestore-rules-tests/src/users.test.ts` (seguir padrão
`assertSucceeds`/`assertFails` com `seedDoc` + `authenticatedContext`, ver
`firestore-rules-tests/src/helpers.ts`):

- [ ] **(novo)** Seed `users/{UID_MERGED}` com `is_searchable: true` E
      `account_status: "merged"` E sem PII → outro player deve **falhar** a
      leitura (`assertFails`). _(cobre o bug do Jordi)_
- [ ] **(novo)** Seed `users/{UID_MERGED_LEGACY}` com `is_searchable: true` E
      `account_status: "merged"` mas **sem** o novo guard → confirmar falha antes
      do fix, sucesso após.
- [ ] **regressão** `users/{UID_USERS_A}` (`is_searchable: true`, sem
      `account_status`) continua legível por outro player (`assertSucceeds`).
- [ ] **regressão** Owner ainda lê o próprio perfil merged (`isOwner`).
- [ ] **regressão** Admin ainda lê perfil merged (`isAdmin`).

Comando: `cd firestore-rules-tests && npm test` (sob
`firebase emulators:exec --only firestore,storage`).

### 4.2 Testes de Cloud Functions (Jest)

`functions/test/leaderboard-cache.test.ts`:
- [ ] **(novo)** Doc com `account_status: "merged"` (mesmo com
      `is_searchable: true`) **não entra** no mapa de usuários públicos da Liga.

`functions/test/nearby-players.test.ts`:
- [ ] **(novo)** Candidato com `account_status: "merged"` é filtrado em
      `loadPublicProfiles`.

`functions/test/account-merge.test.ts` (se existir; senão criar):
- [ ] **(novo)** Após `completeAccountMerge`, o doc origem contém
      `account_status: "merged"` **e** `is_searchable: false`.

Comando: `cd functions && npx jest --no-coverage leaderboard-cache nearby-players account-merge`.

### 4.3 Checklist de Aceitação

- [ ] `firestore.rules` rejeita leitura pública de `account_status == 'merged'`.
- [ ] `isPublicSearchableUser` rejeita `merged`.
- [ ] `loadPublicProfiles` rejeita `merged`.
- [ ] `completeAccountMerge` seta `is_searchable: false` na conta origem.
- [ ] Novos testes de rules passam no emulador.
- [ ] `cd web && npm run build` (tsc + vite) passa — sem mudança de tipos.
- [ ] `cd functions && npm run build && npm run lint` passa.
- [ ] `cd firestore-rules-tests && npm test` verde.
- [ ] Conta ativa permanece pesquisável (sem regressão).

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

- Não existe teste de rules nem de function cobrindo o estado `merged` (grep por
  `merged|account_status` em `firestore-rules-tests/` retorna vazio).
- O filtro de busca pública espelhou-se em 3 lugares (rules, cache, nearby)
  sem um predicado único centralizado — cada cópia omitiu `account_status`.

### 5.2 Ações para evitar recorrência

- [ ] Adicionar casos de teste para o estado `merged` em rules + functions.
- [ ] Considerar extrair um predicado compartilhado `isSearchableUser(data)` em
      `functions/src/` para evitar drift entre leaderboard-cache e nearby-players.
- [ ] Documentar em `AGENTS.md` (seção Web patterns) que todo novo caminho de
      busca pública deve considerar `account_status`, `deleted_at` e
      `is_searchable` conjuntamente.

---

## 6. Backfill de dados (opcional, follow-up)

Documentos merged legados que ainda têm `is_searchable: true` continuarão
filtrados pelas guards de rules + functions (defense-in-depth). Um backfill
opcional pode normalizar o campo raiz:

```js
// functions/src/scripts/backfill-merged-is-searchable.ts (opcional)
// Para cada users/{uid} com account_status == "merged":
//   set is_searchable: false (merge: true)
```

> A correção manual do Jordi já cobre o caso de produção conhecido. O backfill é
> sanitização para qualquer outro documento legado.

---

## 7. Escopo de mudança (resumo)

| Camada | Toca? | Detalhe |
|--------|-------|---------|
| `firestore.rules` | Sim | Leitura pública nega `merged` |
| Cloud Function — merge (`account-merge.ts`) | **Sim** (existe) | Seta `is_searchable: false` na origem |
| Cloud Function — cache Liga (`leaderboard-cache.ts`) | Sim | `isPublicSearchableUser` rejeita `merged` |
| Cloud Function — nearby (`nearby-players.ts`) | Sim | Filtro rejeita `merged` |
| Web | Não (query depende de `is_searchable`, já correto após merge) | — |
| Android/iOS | Não | Busca via Firestore respeita as rules/`is_searchable` |

> **Existe uma Cloud Function de merge?** Sim: `functions/src/auth/account-merge.ts`
> (`completeAccountMerge`, onCall v2). O fix 2 é aplicado nela.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-12 | SDD #3556 | Spec criada a partir do handoff do caso Eduardo Jordi |
