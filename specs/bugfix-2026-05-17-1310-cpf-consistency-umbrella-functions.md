# BUGFIX: Umbrella CPF — consistência/contrato/cobertura (partes functions)

> **Status:** `APPROVED`
> **Severidade:** `LOW`
> **Autor:** Claude (CPF audit wave 2026-05-17)
> **Data:** 2026-05-17
> **PR:** #TBD
> **Issue:** #1310 (apenas partes L1/L6/L8 — partes client em PR separado)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
- **L1** `verification.ts:150-157`: re-verify de CPF reescreve `cpf_index`
  com `merge:false` → `createdAt` resetado a cada reverificação.
- **L6** `validation/cpf.ts:72`: `maskCpf` fallback deve padronizar `***`
  (functions já retorna `***`; divergência está no web/kotlin — fora do
  ownership desta wave).
- **L8** `anti-abuse.ts:109-186`: `logVerificationFailure` sem rate limit →
  spam infla coleções `verification_failures`/`audit_logs` (custo).

### 1.2 Comportamento Esperado (Correto)
- L1: `cpf_index` set com `merge:true` (preserva `createdAt`).
- L6: confirmado functions-side já correto (`***`).
- L8: rate limit por `auth.uid` em `logVerificationFailure`.

## 2. Análise de Causa Raiz
L1: `merge:false` apaga doc inteiro. L8: callable de log sem proteção de abuso.

### 2.2 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/verification.ts` | L1: merge:true em cpf_index |
| `functions/src/auth/anti-abuse.ts` | L8: rate limit |

## 3. Solução Proposta
- L1: `tx.set(indexRef, {uid, createdAt: now}, {merge: true})`.
- L6: nenhum código (já correto); documentar no PR.
- L8: `checkRateLimit(auth.uid, {maxRequests:20, windowMs:3_600_000,
  keyPrefix:"log_verif_fail"})` — limite generoso (log legítimo) mas barra spam.

## 4. Verificação
- [x] Build/lint/jest verdes

## 5. Prevenção Futura
Auditar `merge:false` em paths re-entrantes; rate-limit em endpoints de log.

## Histórico
| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Triado, spec aprovada, partes functions implementadas |
