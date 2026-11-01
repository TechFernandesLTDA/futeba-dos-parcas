# BUGFIX: cleanupOldAlerts termina com FAILED_PRECONDITION (índice composto ausente)

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM` (limpeza semanal de alertas nunca roda; coleção `alerts` cresce sem limite)
> **Autor:** Claude (autorizado pelo dono)
> **Data:** 2026-11-01
> **Issue:** #4479

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
A function agendada `cleanupOldAlerts` (`functions/src/monitoring/alerting.ts`, segunda 04:00 BRT)
falha em produção. Log de 2026-10-26T07:00Z: `9 FAILED_PRECONDITION: The query requires an index`
(`alerts`: `acknowledged` ASC, `created_at` ASC, `__name__` ASC).

### 1.2 Comportamento Esperado (Correto)
A query `acknowledged == true` + `created_at < cutoff` + `orderBy(created_at)` executa e remove os
alertas acknowledged com mais de 30 dias.

## 2. Análise de Causa Raiz
`firestore.indexes.json` e os índices ativos em prod não tinham índice composto para `alerts`.
Prova read-only em prod (REST runQuery): a query do cleanup retorna 400 FAILED_PRECONDITION; os
controles (só igualdade; só range + orderBy em `created_at`) retornam OK.

## 3. Solução
Adicionar em `firestore.indexes.json` o índice `alerts` (COLLECTION): `acknowledged` ASC,
`created_at` ASC. Sem mudança no código da function.

## 4. Deploy
Exige `firebase deploy --only firestore:indexes` (a function não muda). Depois, aguardar o índice
ficar READY e conferir a próxima execução (segunda 04:00 BRT).

## 5. Testes
`functions/test/monitoring/alerting.test.ts`: guarda que a query do cleanup tem o índice declarado.
