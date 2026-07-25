# BUGFIX #3897 — onUserDeleted ganhou failurePolicy sem timeout, sem teto de idade e com anonFailed disparado por warning

| Campo | Valor |
|---|---|
| **Issue** | #3897 |
| **Status** | APPROVED |
| **Tipo** | Bugfix |
| **Camadas** | Cloud Functions (trigger v1) |
| **Origem** | Auditoria agendada de Cloud Functions, 2026-07-24 |
| **Regressão de** | #3877 (PR #3886) |

---

## 1. Problema

O fix do #3877 habilitou `failurePolicy: true` em `onUserDeleted`
(`functions/src/auth/account-cleanup.ts:61`) para que o `throw` final
("PII anonymization incomplete") deixasse de ser no-op e passasse a
reenfileirar a execução — sem ajustar mais nada em volta. A função é a mais
pesada do módulo de auth (818 linhas, ~16 loops `while(true)` paginados, 2
`collectionGroup`, deleção sequencial de Storage) e roda no timeout padrão
de 60s, sem `timeoutSeconds`, sem `memory` e sem teto de idade de evento.

Validei as três alegações por leitura direta de `account-cleanup.ts` antes
de corrigir:

- **Timeout**: confirmado — `runWith({failurePolicy: true})` sem
  `timeoutSeconds`/`memory`, enquanto `pii-migration.ts:363` e `:660` (fluxo
  irmão, também PII/LGPD) usam `timeoutSeconds: 540, memory: "512MiB"`.
- **`anonFailed` amplifica retry**: confirmado — os 4 blocos `try/catch` de
  anonimização (cashbox `:524-572`, reviews `:580-628`, groups `:632-705`,
  activities `:713-762`) ligam `anonFailed = true` tanto no `catch` quanto no
  guard de `MAX_ANON_ITERATIONS` excedido, e o `throw` final em `:805-808`
  não distingue a causa.
- **Sem teto de idade de evento**: confirmado por grep — nenhum
  `eventAge`/`MAX_EVENT_AGE`/`context.timestamp` em `account-cleanup.ts` nem
  em qualquer outro trigger `retry: true`/`failurePolicy: true` do repo
  (`invite-code.ts`, `pii-migration.ts`, `wall-media-*.ts`,
  `recurrence-engine.ts`, `presence-notifications.ts`,
  `profile-complete-claim.ts`).

O item 4 da issue (confirmar que `failurePolicy` realmente engata em
`auth.user().onDelete()` v1) **não é verificável neste ambiente** — exige
staging/produção. Ver §6.

---

## 2. Requisitos

| # | Requisito |
|---|---|
| R1 | O timeout e a memória da função são compatíveis com a carga real (16 loops + 2 collectionGroup + Storage sequencial) |
| R2 | Um evento de exclusão "velho" (retry tardio) aborta sem novo `throw` — nunca reinicia o backoff de retry |
| R3 | Só falha transitória (rede, quota, indisponibilidade) força `anonFailed`/retry; falha estrutural fica visível em log `error` sem reexecutar a limpeza inteira |
| R4 | Nenhuma mudança de comportamento reduz a cobertura de limpeza LGPD já existente |

---

## 3. Decisões de design

### D1 — `timeoutSeconds: 540, memory: "512MB"`

Alinhado com `pii-migration.ts` (mesma família funcional: PII/LGPD, paginação
por `while(true)`/500 docs). `account-cleanup.ts` usa `runWith` de
`firebase-functions/v1` — o tipo válido de `memory` no v1 é a string
`"512MB"` (não `"512MiB"`, que é sintaxe v2); confirmado em
`node_modules/firebase-functions/lib/v1/function-configuration.d.ts`
(`VALID_MEMORY_OPTIONS`).

### D2 — Teto de idade de evento: 24h, aborta com `return`, nunca `throw`

`auth.user().onDelete(handler)` do v1 aceita um segundo parâmetro
`context: EventContext`, que expõe `context.timestamp` (ISO 8601 do
momento em que o evento foi originado, não da tentativa atual). No início
do handler, calculamos a idade do evento e, se exceder 24h, logamos em
`error` (para alertar humano) e damos **`return`** — nunca `throw`. Um
`throw` aqui rearmaria exatamente o retry de 7 dias que o teto existe para
cortar. É o ponto que a issue marca como crítico e este é o motivo de ele
vir antes de qualquer outra mudança de comportamento no handler.

24h (não 7 dias) porque um usuário cuja exclusão não conseguiu completar o
cleanup em 24h de tentativas provavelmente tem uma causa estrutural (dado
malformado, permissão, bug) que backoff sozinho não resolve — moldura já
usada informalmente pelo guard `MAX_ANON_ITERATIONS` (aborta e loga `error`
em vez de rodar indefinidamente).

### D3 — Classificar transitório vs permanente só nos 4 `catch` de anonimização

A issue pede para "separar erro transitório de permanente antes de ligar
`anonFailed`" nos 9 sites listados (513 decl. + 536/567/592/623/643/700/725/757).
Adotado com escopo restrito aos **4 blocos `catch`** (567 cashbox, 623
reviews, 700 groups, 757 activities) — são os únicos que a issue de fato usa
como exemplo do defeito ("`anonFailed` é ligado por blocos `catch` que logam
em `warn` e seguem adiante"). Um classificador `isTransientFirestoreError`
lê `error.code` (status gRPC numérico que o Admin SDK/`google-gax` anexam a
falhas de rede, quota e indisponibilidade — `DEADLINE_EXCEEDED`,
`RESOURCE_EXHAUSTED`, `ABORTED`, `INTERNAL`, `UNAVAILABLE`, `UNKNOWN`,
`CANCELLED`): só nesses casos `anonFailed = true` (e o `catch` continua
logando em `warn`, porque o retry deve mesmo acontecer). Sem código
estruturado reconhecido — falha permanente — o `catch` loga em `error` e
**não** liga `anonFailed`.

**Deliberadamente fora do escopo desta decisão**: os 4 guards de
`MAX_ANON_ITERATIONS` excedido (536/592/643/725). Eles já logam em `error`
(sinal mais severo que os `catch`s) e representam um circuit breaker
estrutural — "a paginação não convergiu em 500k docs" —, não uma falha de
chamada Firestore isolada. A issue não os cita como exemplo do defeito, e
alterar esse comportamento (retry ou não) é uma decisão de produto
diferente da classificação transitório/permanente pedida. Mantidos como
estão: seguem forçando `anonFailed = true`. Consequência prática: o teste de
regressão `#2323` ("aborta quando a paginação não avança e atinge
MAX_ANON_ITERATIONS" → `rejects.toThrow`) continua válido sem alteração.

### D4 — Limpeza retomável (item 3 da issue): FORA DE ESCOPO

A issue sugere, como alternativa a D3, tornar a limpeza retomável (marcar
progresso por etapa em `users_private` ou doc de controle) para que o retry
continue de onde parou em vez de recomeçar. **Não implementado** — é uma
mudança estrutural grande (checkpoint por etapa, idempotência por sub-loop,
provavelmente um doc de progresso novo) desproporcional a uma carona de
bugfix, e D2+D3 já cobrem o risco concreto descrito na issue (retry de 7
dias virando reexecução cara) sem essa complexidade. Fica registrado como
possível follow-up caso o volume de retries de `onUserDeleted` em produção
se mostre problemático mesmo com o teto de 24h.

### D5 — Item 4 da issue (confirmar `failurePolicy` engatando em v1):
**NÃO VALIDADO NESTE PR**

Exigiria observar um retry real de uma Auth trigger v1 em staging/produção
— não reproduzível localmente nem pela suíte Jest (que mocka `runWith`).
Documentado explicitamente no PR: se `failurePolicy` não engatar de fato em
`auth.user().onDelete()` v1, o #3877 precisa ser reaberto e a limpeza
precisa migrar para um caminho com retry real comprovado (trigger v2 sobre
doc de tombstone, ou fila de tarefas) — D1/D2/D3 deste PR são necessários
mas não suficientes para fechar esse ponto.

---

## 4. Mudanças

| Arquivo | Mudança |
|---|---|
| `functions/src/auth/account-cleanup.ts` | `runWith({failurePolicy: true, timeoutSeconds: 540, memory: "512MB"})` (D1); handler ganha parâmetro `context: EventContext` + teto de 24h com `return` sem `throw` (D2); classificador `isTransientFirestoreError` + 4 `catch` de anonimização só ligam `anonFailed` para erro transitório, senão logam `error` sem forçar retry (D3) |
| `functions/test/account-cleanup-batch-reuse.test.ts` | Atualiza asserção de `runWithOptionsCaptured` para incluir `timeoutSeconds`/`memory`; novos testes: evento com mais de 24h aborta sem chamar Firestore e sem lançar; erro transitório em `catch` de anonimização liga `anonFailed` (lança); erro permanente em `catch` de anonimização não liga `anonFailed` (não lança, loga `error`) |

---

## 5. Critérios de aceite

- [ ] `runWith` declarado com `failurePolicy: true, timeoutSeconds: 540, memory: "512MB"`
- [ ] Evento com `context.timestamp` de mais de 24h atrás: handler retorna sem lançar e sem tocar Firestore
- [ ] Erro transitório (código gRPC reconhecido) em qualquer um dos 4 `catch` de anonimização ainda força retry (`anonFailed` + `throw` final)
- [ ] Erro permanente (sem código reconhecido) nos mesmos 4 `catch` não força retry, mas loga em `error`
- [ ] Teste de regressão `#2323` (MAX_ANON_ITERATIONS) continua passando sem alteração de comportamento
- [ ] Teste de regressão `#3877` (failurePolicy) atualizado para as novas opções de `runWith`
- [ ] `npm run build`, `npm run lint` e `npx jest` verdes em `functions/`

---

## 6. Fora de escopo

- **Item 3 completo da issue** (limpeza retomável / progresso por etapa) — ver D4.
- **Item 4 da issue** (confirmar engate de `failurePolicy` em trigger v1 real) — ver D5. Não afirmamos que foi validado.
- **#3901** (cursor de retomada do cron de nudges) — issue, arquivo e spec diferentes.

---

## 7. Verificação

Suíte de `functions/` (build + lint + jest). O comportamento de retry real
em produção (D5) está fora do alcance de teste unitário — a suíte cobre a
lógica determinística (timeout/memory declarados, teto de idade, split
transitório/permanente), não o comportamento do Cloud Functions runtime
diante de um `throw`.
