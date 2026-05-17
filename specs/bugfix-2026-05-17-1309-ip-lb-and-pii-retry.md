# BUGFIX: anti-abuse IP rate limit usa IP do LB + pii-migration retry inexistente

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (CPF audit wave 2026-05-17)
> **Data:** 2026-05-17
> **PR:** #TBD
> **Issue:** #1309

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
**M4** — `anti-abuse.ts` L66 e L144 usam `request.rawRequest?.ip`. Em GCF v2
atrás de Load Balancer, `.ip` é o IP do LB (constante) → rate limit por IP
inútil (todos compartilham mesmo bucket).

**M5** — `pii-migration.ts` `onUserDocUpdated` (L122-160): comentário afirma
"retry automático do Firebase" mas `onDocumentUpdated` v2 NÃO retenta sem
`retry: true` no trigger. PII pode dessincronizar silenciosamente.

### 1.2 Comportamento Esperado (Correto)
**M4** — Usar 1º hop de `x-forwarded-for` (IP real do cliente), fallback
`rawRequest?.ip`.
**M5** — `retry: true` no trigger `onUserDocUpdated` (mantém `throw err`
existente para ativar retry).

## 2. Análise de Causa Raiz
M4: `.ip` em ambiente com LB não reflete cliente. M5: trigger v2 default
`retry:false`; comentário desatualizado induz a erro.

### 2.2 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/anti-abuse.ts` | x-forwarded-for L66, L144 |
| `functions/src/auth/pii-migration.ts` | `retry:true` + comentário |

## 3. Solução Proposta
```ts
const xff = request.rawRequest?.headers?.["x-forwarded-for"];
const ip = (typeof xff === "string" ? xff.split(",")[0].trim() : "")
  || request.rawRequest?.ip || "unknown";
```
`onDocumentUpdated({region, document, retry: true}, ...)` + corrigir comentário.

## 4. Verificação
- [x] Build/lint/jest verdes

## 5. Prevenção Futura
Helper `clientIpFromRequest()` se padrão se repetir.

## Histórico
| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Bug triado, spec aprovada, fix implementado |
