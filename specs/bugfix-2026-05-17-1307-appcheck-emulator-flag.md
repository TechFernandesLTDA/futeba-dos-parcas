# BUGFIX: App Check enforced via NODE_ENV frágil

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (CPF audit wave 2026-05-17)
> **Data:** 2026-05-17
> **PR:** #TBD
> **Issue:** #1307

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
`enforceAppCheck: process.env.NODE_ENV === "production"` em
`verification.ts` (L52, L190, L283), `anti-abuse.ts` (L45, L112) e
`pii-migration.ts` (L173, L330, L400). `NODE_ENV` não é garantido como
`"production"` no runtime do Cloud Functions v2 → App Check pode ficar
desabilitado silenciosamente em prod.

### 1.2 Comportamento Esperado (Correto)
Usar `process.env.FUNCTIONS_EMULATOR !== "true"` — variável definida pelo
runtime das Functions, confiável: enforce em prod, desabilitado só no emulador.

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz
`NODE_ENV` é convenção Node, não setada pelo runtime GCF v2.
`FUNCTIONS_EMULATOR` é populada pelo Firebase Emulator Suite.

### 2.2 Arquivos Afetados
| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/verification.ts` | 3 sites |
| `functions/src/auth/anti-abuse.ts` | 2 sites |
| `functions/src/auth/pii-migration.ts` | 3 sites |

## 3. Solução Proposta
Trocar todos os `enforceAppCheck`/`consumeAppCheckToken` baseados em
`NODE_ENV === "production"` por `FUNCTIONS_EMULATOR !== "true"`,
consistentemente em todos os 8 sites.

## 4. Verificação
- [x] Build/lint/jest verdes
- [x] Grep confirma 0 sites remanescentes com NODE_ENV nestes 3 arquivos

## 5. Prevenção Futura
Constante compartilhada `IS_EMULATOR` se padrão crescer.

## Histórico
| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Bug triado, spec aprovada, fix implementado |
