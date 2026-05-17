# BUGFIX: Branches de segurança do verifyCpf sem teste (gap de cobertura)

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Claude (CPF audit wave 2026-05-17)
> **Data:** 2026-05-17
> **PR:** #TBD
> **Issue:** #1305

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
`functions/test/role-actions.test.ts:348-405` testa `verifyCpf` só no
happy-path: o mock de transaction sempre retorna `{exists:false}`. Branches
críticos de segurança não exercitados: duplicate CPF, CPF-change block, salt
ausente/curto, rate limit (#1304) e idempotência de setUserVerified (#1308).

### 1.2 Comportamento Esperado (Correto)
Cobertura dos branches de segurança via mocks específicos por teste.

## 2. Análise de Causa Raiz
Mock global de `checkRateLimit` (`allowed:true`) e transaction `{exists:false}`
mascaram todos os caminhos de rejeição.

### 2.2 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/test/role-actions.test.ts` | novos casos |

## 3. Solução Proposta
Adicionar testes:
- duplicate CPF: `tx.get` → `{exists:true,data:()=>({uid:'other'})}` →
  `already-exists`
- CPF-change block: privateRef com `cpfHash` diferente → `permission-denied`
- salt ausente/curto: `CPF_SALT` removido/curto → `failed-precondition`
- rate limit (#1304): override per-test `checkRateLimit` → `{allowed:false}`
- idempotência (#1308): 2ª chamada não invoca `revokeRefreshTokens`

Override do mock global de `checkRateLimit` via
`jest.requireMock(...).checkRateLimit = jest.fn()...` dentro do teste.

## 4. Verificação
- [x] `npx jest test/role-actions.test.ts --no-coverage` verde

## 5. Prevenção Futura
Exigir teste por branch de rejeição em callables sensíveis.

## Histórico
| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Bug triado, spec aprovada, fix implementado |
