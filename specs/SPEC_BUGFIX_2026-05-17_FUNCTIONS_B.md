# BUGFIX: processNotificationQueue filtro multi-tipo + overload morto updateStreak(Long) + try/catch morto compact-streaks

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM` (#1282) / `LOW` (#1283)
> **Autor:** Renan Locatiz Fernandes
> **Data:** 2026-05-17
> **PR:** TBD — fix/functions-bugs-1282-1283

---

## 1. Descrição dos Bugs

### Bug A — #1282 (MEDIUM): filtro de preferências de notificação usa tipo único para fila multi-tipo

#### 1.1 Comportamento Atual (Errado)

`processNotificationQueue` em `functions/src/notifications/batch-sender.ts` busca até 200 docs PENDING
de tipos misturados (ex: GAME_REMINDER, MVP_RECEIVED, ACHIEVEMENT na mesma fila). Porém,
computa um único `typeForFilter = pendingSnap.docs[0]?.data()?.type` e aplica esse tipo único
a **todos** os usuários do Set unificado — independente do tipo da notificação que cada usuário
vai receber. O `groupId` é sempre passado como `undefined` para `shouldNotifyUser`.

Resultado: um usuário que silenciou GAME_REMINDER pode receber GAME_REMINDER (porque o filtro
usou o tipo do doc[0] — ex: ACHIEVEMENT — e ele não silenciou ACHIEVEMENT). Inversamente,
um usuário pode ser bloqueado de receber ACHIEVEMENT porque o doc[0] era GAME_REMINDER e ele
silenciou GAME_REMINDER.

#### 1.2 Comportamento Esperado (Correto)

O filtro de preferências deve ser aplicado **por doc, com o tipo correto daquele doc**.
Cada doc da fila tem seu próprio `data.type` e seus próprios `data.userIds`. O filtro
`shouldNotifyUser(uid, type, groupId)` deve usar o `type` do doc sendo processado, não
o tipo do primeiro doc da fila. O `groupId` deve ser derivado de `data.data?.groupId`
quando disponível.

#### 1.3 Causa Raiz

Fix #1143 adicionou o bloco de filtro (linhas 313-333) antes do loop de processamento
por doc (linha 341+), mas extraiu o tipo apenas do `docs[0]`. Como a fila é multi-tipo,
essa extração deve ser movida para dentro do loop de cada doc.

#### 1.4 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `functions/src/notifications/batch-sender.ts` | Bloco de filtro nas linhas 313-333 usa `docs[0].type` para toda a fila |

---

### Bug B — #1283 (LOW): overload morto updateStreak(Long) + try/catch morto em compact-streaks

#### 1.1 Comportamento Atual (Errado)

**B1 — Overload Long:**
`FirebaseDataSource.updateStreak(userId, streak: Int, lastGameDate: Long)` grava
`"last_game_date" to lastGameDate` (Long epoch-ms) violando o contrato `String "yyyy-MM-dd"`
do modelo `UserStreak`. Não há caller vivo — mas qualquer caller futuro corromperia streaks
silenciosamente (`get<String?>` retorna `null` → streak reseta para 1).

**B2 — try/catch morto:**
`compact-streaks.ts` linha 226-238: `try { lastGameDate = new Date(data.last_game_date) } catch { ... }`
O construtor `new Date()` **nunca lança** — retorna `Invalid Date`. O catch é código morto.
Um valor corrompido como `null` ou objeto Timestamp resultaria em `Invalid Date`, que
comparado com `thirtyDaysAgo` retorna `false`, silenciosamente pulando o reset do streak expirado.

#### 1.2 Comportamento Esperado (Correto)

**B1:** O overload morto deve ser removido de `commonMain`, `nativeAndAndroidMain` e `wasmJsMain`
(apenas se confirmado sem caller — grep confirmou: zero callers diretos de `.updateStreak(` no
shared ou app que não sejam a definição da função).

**B2:** O try/catch morto deve ser substituído por verificação explícita `isNaN(lastGameDate.getTime())`
com log adequado, garantindo que valores corrompidos sejam detectados e logados.

#### 1.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `shared/src/commonMain/.../FirebaseDataSource.kt` | Declaração `expect fun updateStreak(Long)` a remover |
| `shared/src/nativeAndAndroidMain/.../FirebaseDataSource.kt` | Implementação `actual fun updateStreak(Long)` a remover |
| `shared/src/wasmJsMain/.../FirebaseDataSource.kt` | Stub `actual fun updateStreak(Long)` a remover |
| `functions/src/maintenance/compact-streaks.ts` | try/catch morto linhas 226-238 a substituir |

---

## 2. Solução Proposta

### Bug A — batch-sender.ts

Remover o bloco de filtro centralizado (pré-loop) e mover o filtro **para dentro do loop**
de processamento por doc, usando o `data.type` e `data.data?.groupId` de cada doc.

```typescript
// ANTES (tipo único para toda a fila):
const typeForFilter = (pendingSnap.docs[0]?.data()?.type as string) || "GAME_REMINDER";
const filteredUserIds: string[] = [];
for (const uid of allUserIds) {
  const ok = await shouldNotifyUser(uid, typeForFilter, undefined);
  if (ok) filteredUserIds.push(uid);
}
totalTargeted = filteredUserIds.length;
const tokenMap = await fetchTokensInBatch(filteredUserIds);

// DEPOIS (filtro por doc, tipo correto):
// Bloco centralizado removido.
// fetchTokensInBatch usa allUserIds (sem pré-filtro).
// Dentro do loop de cada doc:
const docUserIds = (data.userIds as string[]) || [];
const docType = (data.type as string) || "GAME_REMINDER";
const docGroupId = (data.data as Record<string, string> | undefined)?.groupId;
const filteredDocUserIds: string[] = [];
for (const uid of docUserIds) {
  try {
    const ok = await shouldNotifyUser(uid, docType, docGroupId);
    if (ok) filteredDocUserIds.push(uid);
  } catch {
    filteredDocUserIds.push(uid); // fail-open
  }
}
```

### Bug B — compact-streaks.ts

```typescript
// ANTES (try/catch morto):
try {
  lastGameDate = new Date(data.last_game_date);
} catch {
  console.warn(...);
}

// DEPOIS (checagem explícita isNaN):
lastGameDate = new Date(data.last_game_date);
if (isNaN(lastGameDate.getTime())) {
  console.warn(
    "[STREAK_MAINTENANCE] Data invalida para " +
    `${userId}: ${data.last_game_date}`
  );
  lastGameDate = null;
}
```

### Bug B — FirebaseDataSource.kt (3 arquivos)

Remover as declarações/implementações do overload `updateStreak(userId, streak: Int, lastGameDate: Long)`
em commonMain, nativeAndAndroidMain e wasmJsMain.

---

## 3. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Filtro por doc aumenta Firestore reads (N leituras de prefs por user por doc) | Comportamento já era assim em `sendNotificationToUser`; batch-sender já faz N reads; impacto marginal |
| Remoção do overload quebra build KMP | Grep confirma zero callers — build deve passar |
| Mudança em compact-streaks afeta reset de streaks | Lógica de reset preservada; apenas melhora detecção de valor inválido |

---

## 4. Verificação

### 4.1 Testes

- [x] Build TypeScript: `npm run build` verde
- [x] Suite Jest: `npx jest --no-coverage` verde (~599 passed)
- [x] Lint: `npm run lint` verde
- [x] Grep de callers do overload confirma zero callers antes de remover

### 4.2 Checklist

- [x] Bug A: filtro de preferências usa tipo do doc correto, não docs[0]
- [x] Bug B: try/catch morto substituído por checagem isNaN
- [x] Bug B: overload Long removido de commonMain + nativeAndAndroidMain + wasmJsMain
- [x] Sem novos warnings de lint
- [x] Commits atômicos: 1 por issue

---

## 5. Prevenção Futura

- Filtros de preferência em filas multi-tipo devem sempre ser aplicados por item, nunca por tipo único extraído do primeiro item
- Construtores `new Date()` nunca lançam — sempre validar com `isNaN(date.getTime())`
- Overloads de tipos divergentes do contrato do modelo devem ser descartados na PR de origem

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-15 | Auditoria automatizada | Bugs reportados em #1282 e #1283 |
| 2026-05-17 | Renan Locatiz Fernandes | Spec criada e aprovada |
| 2026-05-17 | Renan Locatiz Fernandes | Fix implementado |
