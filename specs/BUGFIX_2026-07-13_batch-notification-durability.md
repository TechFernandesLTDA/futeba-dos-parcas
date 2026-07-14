# BUGFIX: Durabilidade e métrica do envio FCM em chunks

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-13
> **Issues:** #3585, #3594

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

O progresso de `sendMulticastInChunks` só é escrito no documento da fila
depois que todos os chunks terminam. Uma interrupção entre chunks deixa o
documento `PROCESSING` sem o progresso já confirmado pelo FCM e o cleanup o
reabre para reenvio integral. Além disso, `totalTargeted` mistura um conjunto
global deduplicado com ajustes por arrays de cada documento e pode subcontar
usuários repetidos com preferências diferentes.

### 1.2 Comportamento Esperado (Correto)

Antes do envio, o documento deve registrar os tokens ainda pendentes. Depois
de cada resposta de chunk, uma transação curta deve persistir os tokens
entregues e o conjunto pendente remanescente. Um retry deve selecionar apenas
os tokens pendentes e sempre excluir tokens já entregues. `totalTargeted` deve
ser o tamanho do conjunto final deduplicado de usuários aprovados por
preferência em pelo menos um documento.

### 1.3 Passos para Reproduzir

1. Enfileirar um documento com mais de 500 tokens.
2. Confirmar a entrega do primeiro chunk e interromper a execução antes do
   segundo.
3. Executar o cleanup que retorna o documento para `PENDING`.
4. Reprocessar e observar o primeiro chunk sendo enviado novamente.
5. Em outra execução, incluir o mesmo usuário em dois documentos e bloquear
   apenas um dos tipos nas preferências; observar `totalTargeted` incorreto.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Firebase Cloud Functions / FCM |
| Versão | Functions 1.9.0 |
| Frequência | Em interrupções de lotes com múltiplos chunks |
| Impacto | Push duplicado, custo FCM e métricas incorretas |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

O claim `PENDING -> PROCESSING` é atômico, mas a confirmação de entrega é
postergada até o retorno completo de `sendMulticastInChunks`. O cleanup apenas
troca o status. O cálculo da métrica parte de `allUserIds` e depois subtrai
`userIds.length` por documento, grandezas com critérios de deduplicação
diferentes.

### 2.2 Causa Raiz

O limite transacional foi aplicado ao claim, mas não ao checkpoint entre
efeitos externos (FCM) e o estado da fila. A métrica foi mantida como contador
incremental em vez de ser derivada do estado final filtrado.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `functions/src/notifications/batch-sender.ts` | Checkpoint por chunk e métrica deduplicada |
| `functions/test/batch-sender.test.ts` | Regressões de interrupção/retry e overlap |

---

## 3. Solução Aprovada

### 3.1 Abordagem

1. Acumular IDs aprovados por preferência em um `Set` e derivar
   `totalTargeted` apenas ao fim.
2. Persistir `pending_tokens` com todo o dispatch antes da primeira chamada ao
   FCM, preservando retomada mesmo se a execução cair antes do primeiro
   checkpoint.
3. Permitir que `sendMulticastInChunks` invoque um callback após cada resposta
   de chunk. O callback executa uma transação no documento, une sucessos em
   `delivered_tokens` e remove do pendente todos os destinos terminados,
   mantendo somente falhas transientes e chunks ainda não processados.
4. Se o checkpoint falhar, interromper antes do próximo chunk. O documento
   permanece `PROCESSING`; o cleanup poderá reabri-lo com o último checkpoint
   durável.
5. Manter os limites de 500 tokens do FCM e usar uma leitura/escrita Firestore
   adicional por chunk, sem transação por token.

### 3.2 Semântica de falhas

FCM e Firestore não oferecem uma transação distribuída. Existe uma janela
inevitável entre a confirmação do FCM e o commit do checkpoint. A correção
garante retomada sem duplicar chunks cujo checkpoint foi persistido e impede
que outro chunk seja enviado quando esse commit falha; não promete exactly-once
se o processo morrer exatamente nessa janela.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Escritas extras | Uma transação por chunk (máximo 500 tokens), não por token |
| Limite de tamanho do documento | Arrays já existiam; ficam limitados aos tokens do próprio doc |
| Checkpoint falhar após FCM | Não iniciar chunk seguinte; manter estado recuperável |
| Token entregue desaparecer do pending | União deduplicada de entregues e recomputação transacional |

---

## 4. Verificação

- [x] Teste: chunk 1 confirmado, checkpoint registrado e interrupção antes do chunk 2.
- [x] Teste: retry exclui tokens entregues e envia apenas pendentes.
- [x] Teste: usuário repetido em docs com preferências distintas conta uma vez.
- [x] Testes focados de `batch-sender` passam em Node 22.
- [x] Build e lint de Functions passam.
- [x] Suíte completa de Functions passa.
- [x] `git diff --check` passa.

---

## 5. Release

Correção interna de Cloud Functions, sem mudança de contrato de cliente. Deve
entrar no próximo release consolidado de Functions e ser mencionada nas notas
como melhoria de confiabilidade do envio de notificações em massa.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-13 | Codex | Spec criada e aprovada antes da implementação |
| 2026-07-13 | Codex | Implementação e verificação concluídas |
