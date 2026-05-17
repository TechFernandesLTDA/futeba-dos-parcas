# BUGFIX: verifyCpf sem rate limiting — enumeration por timing differential

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Claude (CPF audit wave 2026-05-17)
> **Data:** 2026-05-17
> **PR:** #TBD
> **Issue:** #1304

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
`verifyCpf` (`functions/src/auth/verification.ts:46-173`) não aplica rate
limit. Um atacante autenticado pode submeter muitos CPFs e usar diferença de
timing (duplicate check via transaction) para enumerar CPFs já registrados.

### 1.2 Comportamento Esperado (Correto)
Rate limit por `auth.uid`: máx 5 requests / hora. Excedente → `resource-exhausted`.

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz
Callable de verificação sensível sem `checkRateLimit`. Helper já existe
(`functions/src/middleware/rate-limiter.ts`), usado em `canSendSmsOtp`.

### 2.2 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/verification.ts` | adicionar checkRateLimit pós-auth |
| `functions/test/role-actions.test.ts` | teste de rate limit |

## 3. Solução Proposta

### 3.1 Abordagem
Logo após o auth check em `verifyCpf`, chamar
`checkRateLimit(auth.uid, {maxRequests:5, windowMs:3_600_000, keyPrefix:"verify_cpf"})`.
Se `!allowed`, lançar `HttpsError("resource-exhausted", ...)` com retryAfter.

## 4. Verificação
- [x] Teste: 6ª chamada rejeitada com `resource-exhausted`
- [x] `npm run build` / `lint` / `jest` verdes

## 5. Prevenção Futura
Rate limit padrão em toda callable que faz lookup sensível.

## Histórico
| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Bug triado, spec aprovada, fix implementado |
