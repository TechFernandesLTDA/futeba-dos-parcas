# BUGFIX #3909 — completeAccountMerge ignora falhas do BulkWriter

| Campo | Valor |
|---|---|
| **Issue** | #3909 |
| **Status** | APPROVED |
| **Tipo** | Bugfix (segurança/integridade — fluxo de identidade e LGPD) |
| **Camadas** | Cloud Functions |
| **Origem** | Auditoria de Cloud Functions, 2026-07-24 |
| **Achado correlato** | #3908 |

---

## 1. Problema

Em `completeAccountMerge` (`functions/src/auth/account-merge.ts`), a migração de
`game_summons` (`:1230`), `group_invites` (`:1245`) e `notifications` (`:1254`)
é feita por um `BulkWriter` (`:1053`) cujo retorno de cada `set()` é
descartado. Não existe `onWriteError`/`onWriteResult` registrado, e a única
outra interação com o writer é `await writer.close()` (`:1354`).

Semântica do `BulkWriter` no Admin SDK: `set()` devolve `Promise<WriteResult>`;
o handler padrão de erro faz retry apenas de códigos retryable (até 10
tentativas) e depois **rejeita a promise individual**. `close()` resolve
quando não há mais escritas pendentes — ele não agrega nem propaga falhas
individuais. Descartar o retorno de `set()` tem duas consequências:

1. uma falha definitiva de escrita passa despercebida pelo código;
2. a promise rejeitada fica sem handler (unhandled rejection — em Node 22
   pode derrubar a instância).

### Por que a consequência é permanente

Logo após `writer.close()`, sem checar nada, o código segue para o estágio
irreversível: revalida telefone canônico (`:1359-1364`), marca
`irreversibleStage: "references_migrated"` (`:1366-1376`),
`auth.updateUser(sourceUid, {disabled: true, providersToUnlink})`
(`:1380-1383`) e `auth.revokeRefreshTokens(sourceUid)` (`:1384`). O pedido
termina como `completed`. Como um pedido `completed` faz curto-circuito e
devolve `success: true` incondicionalmente (`:751-759` e `:898-907`), **não
há caminho de retomada** — os documentos que falharam continuam apontando
para `sourceUid`, uma conta agora `disabled` com refresh tokens revogados.

Contraste com o resto da função: as migrações de `confirmations` (`:1187`) e
`game_templates` (`:1334`) usam `runTransaction` com releitura e contagem de
retorno, só apagando a origem após confirmar a cópia. As três coleções do
BulkWriter são as únicas sem verificação.

**Validação**: as três linhas, o `writer.close()` isolado e a ausência total
de `onWriteError`/`onWriteResult` no arquivo foram confirmados por leitura
direta de `functions/src/auth/account-merge.ts` antes de qualquer alteração.
A alegação da issue se sustenta integralmente — ao contrário do achado #3900
(coleção vazia em produção), aqui não há dado de produção que invalide o
achado, pois o problema é estrutural (código sem verificação), não uma
inconsistência de dado observável hoje.

---

## 2. Requisitos

| # | Requisito |
|---|---|
| R1 | Uma falha definitiva de escrita em `game_summons`, `group_invites` ou `notifications` é detectada **antes** do estágio irreversível (`irreversibleStage`, `disabled`, `revokeRefreshTokens`) |
| R2 | Quando há falha definitiva, o pedido **não** é marcado `completed` — fica retentável |
| R3 | Nenhuma promise de escrita do BulkWriter fica sem handler (`unhandledRejection`) |
| R4 | O caminho feliz (sem falhas) preserva o comportamento atual (mesmo `manifest`, mesma ordem de operações, mesmo retorno) |
| R5 | A retomada natural via lease (`PROCESSING_LEASE_MS`) continua funcionando após um abort — as escritas do BulkWriter usam `{merge: true}` com IDs determinísticos, então uma nova tentativa é idempotente |

---

## 3. Decisões de design

### D1 — Coletar promises de `set()` + checar após `close()`, em vez de `onWriteError`

A issue propõe duas alternativas. Optamos pela mais simples (a própria issue
chama de "alternativa mais simples"): capturar a promise devolvida por cada
`writer.set(...)`, anexar um `.catch()` que registra a falha em um array
local, e aguardar todas com `Promise.all` logo após `writer.close()`.

**Por quê, e não `onWriteError`**: registrar `onWriteError` exige reimplementar
a política de retry (a issue sugere um `RETRYABLE.has(error.code)` e um teto
de tentativas) só para decidir quando desistir — duplicando lógica que o
handler padrão do BulkWriter já faz corretamente (retry de códigos retryable
até 10 tentativas, depois rejeita). Capturar o retorno de `set()` aproveita
esse comportamento padrão sem reimplementar nada: cada promise só rejeita
depois que o SDK já esgotou os retries automáticos. Menos código, mesma
garantia, e sem risco de a política de retry customizada divergir da do SDK
em uma atualização futura.

O `.catch()` é anexado **imediatamente** à promise de cada `set()` (não
depois), o que elimina o risco de unhandled rejection por construção — não é
preciso esperar `close()` para "prender" o handler.

### D2 — Abortar sem tocar em `status`/lease, deixando a retomada natural agir

Quando há falhas, lançamos `HttpsError("internal", ...)` **antes** da
revalidação de telefone e do estágio irreversível. Não tocamos em
`status`/`processingLeaseId` do pedido — eles já foram setados para
`"processing"` + lease de `PROCESSING_LEASE_MS` (2 min) na aquisição da lease
no início da função (`:888-895`), muito antes do BulkWriter. Deixar esse
estado como está é suficiente: a lease expira sozinha, e a checagem de
retomada já existente (`:877-887`) permite uma nova tentativa depois disso.
Como as escritas do BulkWriter usam `{merge: true}` e não geram novos IDs, uma
nova tentativa reprocessa exatamente os documentos que faltaram sem duplicar
nada — mesmo padrão de idempotência que o comentário em `:865-866` já
documenta para o restante da função.

Rejeitamos ativamente escrever `status: "processing"` de novo (seria
redundante) ou introduzir um novo status (ex.: `"partially_failed"`) — SDD
mínimo: o mecanismo de retomada por lease expirada já resolve R2 e R5 sem
precisar de um estado novo no modelo de dados.

### D3 — Registrar o que falhou no próprio pedido, antes de abortar

Para satisfazer a diretriz da issue de deixar claro no estado do pedido o que
foi e o que não foi migrado quando há falha, gravamos um campo de diagnóstico
`lastBulkWriteFailure: {failures: [{path, code, message}], attemptedAt}` no
`account_merge_requests/{requestId}` via `set({..}, {merge: true})` simples
(sem transação — é só diagnóstico, não precisa da mesma garantia de
consistência do lease). Esse campo não interfere na retomada (não mexe em
`status`/`processingLeaseId`) e dá visibilidade operacional sem exigir uma
tela ou alerta novo — fora de escopo aqui.

### D4 — `code` do erro é best-effort

O erro que rejeita a promise de um write do BulkWriter no Admin SDK
(`BulkWriterError`) normalmente expõe `.code` (status gRPC) e `.message`. O
código captura `code` apenas se existir e for string; caso contrário grava só
`message`. Não há acoplamento a uma versão específica do SDK além do shape já
documentado (`Error` com `code?: unknown`).

---

## 4. Mudanças

| Arquivo | Mudança |
|---|---|
| `functions/src/auth/account-merge.ts` | Captura o retorno de cada `writer.set()` de `game_summons`/`group_invites`/`notifications`; agrega falhas; após `writer.close()`, aborta com `HttpsError` antes do estágio irreversível se houver falha (D1, D2, D3, D4) |
| `functions/test/auth/account-merge-complete.test.ts` | Mock de `bulkWriter().set()` passa a devolver `Promise<void>` (era síncrono) para refletir a API real; teste do caminho feliz ajustado onde necessário |
| `functions/test/auth/account-merge-complete.test.ts` | Novo teste: falha definitiva de escrita em `notifications` é detectada, estágio irreversível (`auth.updateUser`/`revokeRefreshTokens`/`irreversibleStage`) **não** é executado, pedido permanece `"processing"` |
| `functions/test/auth/account-merge-complete.test.ts` | Novo teste: ausência de unhandled rejection quando um `set()` do BulkWriter rejeita (asserção via listener de `process.on("unhandledRejection")` no teste) |

---

## 5. Critérios de aceite

- [ ] Caminho feliz: comportamento e `manifest` idênticos aos atuais (teste existente continua verde)
- [ ] Falha definitiva de escrita em qualquer uma das 3 coleções impede `auth.updateUser`/`auth.revokeRefreshTokens`/`irreversibleStage`
- [ ] Nesse caso, o pedido não fica `"completed"` — permanece `"processing"` com lease intacta
- [ ] Nenhuma unhandled rejection é emitida durante o teste de falha
- [ ] `npm run build`, `npm run lint` e `npx jest --no-coverage` verdes em `functions/` (baseline: 108 suites / ~1626 testes, 0 falhas — sem regressão)
- [ ] Diff-coverage ≥80% nas linhas novas do PR

---

## 6. Fora de escopo

- Endpoint/alerta operacional para consumir `lastBulkWriteFailure` — só o campo é gravado; consumo fica para uma issue futura, se necessário.
- Extrair a lógica de "coletar promises + abortar" para um helper reutilizável — escopo limitado às 3 coleções desta função; não há outro uso hoje de `bulkWriter()` no arquivo.
- #3908 (achado correlato da mesma auditoria) — arquivo/função diferente.
- Mudar a política de retry do BulkWriter (mantém o padrão do SDK — ver D1).
