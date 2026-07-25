# BUGFIX #3901 — Retomada do cron de nudges reinicia a varredura quando o usuário do cursor foi excluído

| Campo | Valor |
|---|---|
| **Issue** | #3901 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | Cloud Functions |
| **Origem** | Auditoria agendada de Cloud Functions, 2026-07-24 |
| **Regressão de** | Reintroduz o comportamento que #3875 (PR #3890) corrigiu |

---

## 1. Problema

O fix de #3875 introduziu um cursor persistido em
`system_state/gamification_nudges_cursor` para que `runGamificationNudges`
(`functions/src/gamification-nudges.ts`) cubra toda a base de usuários ao
longo de execuções sucessivas, em vez de reiniciar do início a cada dia (o que
nunca alcançava a cauda dentro do orçamento de 150s).

A retomada, porém, só usa o cursor persistido se o documento do usuário ainda
existir:

```ts
const resumeDoc = await db().collection("users").doc(lastUserId).get();
if (resumeDoc.exists) {
  cursor = resumeDoc as FirebaseFirestore.QueryDocumentSnapshot;
}
```

`users/{uid}` é apagado de verdade (não é soft-delete) em
`functions/src/auth/account-cleanup.ts:124` (`await userRef.delete()`). Se o
usuário no cursor excluir a conta entre duas execuções do cron, a próxima
execução não encontra o doc, `cursor` fica `null`, e a query seguinte é
montada **sem `startAfter`** — a varredura recomeça do primeiro usuário,
reintroduzindo a inanição da cauda que #3875 existia para resolver. O
comentário do bloco ("é robusto mesmo se ele foi removido") afirma o oposto
do que o código faz.

Verificado por leitura direta de `functions/src/gamification-nudges.ts:380-394`
e `functions/src/auth/account-cleanup.ts:120-126` — a alegação da issue se
sustenta.

### Como falha

1. Execução do dia N esgota `TIME_BUDGET_MS` e persiste `last_user_id = U`.
2. `U` exclui a conta; `onUserDeleted` apaga `users/U` de verdade.
3. Execução do dia N+1 não encontra `users/U`, zera o cursor e recomeça do
   primeiro usuário (por `orderBy(documentId())`).
4. O orçamento de tempo é gasto de novo na cabeça da base; a cauda nunca é
   alcançada.
5. O novo `last_user_id` persistido também está na cabeça — o ciclo pode se
   repetir indefinidamente sem nenhum log distinguindo "primeira execução do
   ciclo" de "retomada perdida".

---

## 2. Requisitos

| # | Requisito |
|---|---|
| R1 | A retomada usa o cursor persistido independentemente de o usuário referenciado ainda existir |
| R2 | O caminho de retomada não faz `get()` extra para validar o cursor |
| R3 | Comentário do bloco de retomada reflete o comportamento real |
| R4 | Um cursor persistido havia muito tempo (janela sem execução) não retoma de um ponto obsoleto indefinidamente |

---

## 3. Decisões de design

### D1 — Passar a `DocumentReference` ao `startAfter`, não o snapshot

Com `orderBy(FieldPath.documentId())`, o Firestore aceita como cursor tanto um
`DocumentSnapshot` quanto o próprio valor do campo de ordenação — que para
`documentId()` é uma `DocumentReference` (ou o ID em string), independente de
o documento existir. Trocar `resumeDoc: QueryDocumentSnapshot` (obtido via
`get()`) por `db().collection("users").doc(lastUserId)` (uma
`DocumentReference` construída sem I/O) resolve R1 e R2 na mesma mudança: o
cursor passa a ser válido mesmo que o doc tenha sido apagado, e não há mais
`get()` de validação no caminho de retomada.

### D2 — Teto de idade do cursor (48h), não descarte silencioso por ausência

A issue lista como "complemento recomendado" (não obrigatório) ignorar cursor
mais velho que ~48h. Adotado porque o dado (`updated_at`) já é lido no mesmo
`stateRef.get()` que já buscamos — não é um `get()` adicional — e cobre um
cenário real diferente do defeito principal: o cron pausado por dias (deploy
quebrado, quota, etc.) retomaria de um ponto que já não reflete a "cabeça"
atual da base de forma útil. Ao exceder 48h, o cursor é descartado e a
varredura reinicia do zero, com `logger.warn` explícito — differente do bug
original, aqui a decisão é system-driven e visível em log, não um efeito
colateral silencioso de `if (resumeDoc.exists)`.

**Não implementado**: log `warn` genérico "cursor descartado" para qualquer
outro motivo de invalidação, porque na versão corrigida não existe mais
nenhum outro caminho que descarte o cursor — ausência do doc do usuário deixou
de ser motivo de descarte (é exatamente o que este bugfix resolve). O único
descarte que resta é o de idade (D2), que já loga.

### D3 — Comentário do bloco reescrito

O comentário atual promete robustez a remoção mas o código fazia o oposto.
Reescrito para descrever o comportamento real pós-fix (D1) e a razão da
checagem de idade (D2).

---

## 4. Mudanças

| Arquivo | Mudança |
|---|---|
| `functions/src/gamification-nudges.ts` | Retomada usa `DocumentReference` direto (sem `get()`); novo teto `CURSOR_MAX_AGE_MS` (48h) usando `updated_at` já lido; comentário do bloco reescrito |
| `functions/test/gamification-nudges.test.ts` | Novo teste: usuário do cursor excluído → retomada continua do ponto seguinte, sem reiniciar; novo teste: cursor mais velho que 48h → descartado com `warn`, varredura reinicia |

---

## 5. Critérios de aceite

- [ ] Teste em que o usuário do cursor persistido não existe mais e a
      varredura continua do ponto seguinte, sem reiniciar
- [ ] Teste em que o cursor persistido tem mais de 48h e a varredura reinicia
      do zero com `logger.warn`
- [ ] Comentário do bloco de retomada alinhado ao comportamento real
- [ ] Nenhum `get()` extra no caminho de retomada
- [ ] `npm run build`, `npm run lint` e `npx jest` verdes em `functions/`

---

## 6. Fora de escopo

- Qualquer mudança no formato do doc de estado (`system_state/gamification_nudges_cursor`)
  além do já existente `last_user_id` + `updated_at`.
- #3897 (timeout/retry de `onUserDeleted`) — issue e arquivo diferentes,
  tratada em spec e PR separados.

---

## 7. Verificação

Suíte de `functions/` (build + lint + jest). Comportamento de retomada é
inteiramente coberto por teste unitário via `runGamificationNudges` exportada
com `pageLimit`/`timeBudgetMs`/`now` injetáveis — não depende de emulador.
