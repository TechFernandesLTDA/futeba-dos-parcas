# BUGFIX: setUserVerified revoga refresh tokens em toda chamada (não idempotente)

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (CPF audit wave 2026-05-17)
> **Data:** 2026-05-17
> **PR:** #TBD
> **Issue:** #1308

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
`setUserVerified` (`functions/src/auth/verification.ts` ~L243-248) chama
`admin.auth().revokeRefreshTokens()` incondicionalmente, mesmo quando o
usuário já está com `verified: true`. Revogar refresh tokens força o cliente
a reautenticar, que dispara nova chamada de `setUserVerified` → loop
self-perpetuating cross-platform (web + Android #1313).

### 1.2 Comportamento Esperado (Correto)
Se `userRecord.customClaims?.verified === true`, a callable deve ser
idempotente: retornar cedo sem revogar tokens nem reescrever claims/mirrors.

### 1.3 Passos para Reproduzir
1. Usuário conclui verificação (claim `verified=true`)
2. Cliente (web/Android) revalida e chama `setUserVerified` de novo
3. Tokens revogados → reauth → nova chamada → loop

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz
Ausência de short-circuit idempotente antes das escritas. `revokeRefreshTokens`
só deveria rodar na transição `false → true`.

### 2.2 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/verification.ts` | early-return idempotente |

## 3. Solução Proposta

### 3.1 Abordagem
Logo após `admin.auth().getUser(targetUid)`, se
`userRecord.customClaims?.verified === true`, retornar
`{success:true, uid, alreadyVerified:true}` — pula mirror, setCustomUserClaims
e revokeRefreshTokens (todos redundantes para usuário já verificado).

## 4. Verificação
- [x] Teste: 2ª chamada não invoca `revokeRefreshTokens` nem
  `setCustomUserClaims` (em `test/role-actions.test.ts`)
- [x] `npm run build` / `lint` / `jest` verdes

## 5. Prevenção Futura
Idempotência explícita em toda callable que muda estado de auth.

## Histórico
| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Bug triado, spec aprovada, fix implementado |
