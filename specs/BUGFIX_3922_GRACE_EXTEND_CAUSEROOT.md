# BUGFIX: Grace period de verificação — extensão + causa-raiz (#3922)

> **Status:** `IN_PROGRESS`
> **Severidade:** `HIGH`
> **Issue:** #3922
> **Data:** 2026-07-28
> **Decisão:** Estender (4ª extensão) + tratar causa-raiz estrutural

---

## 1. Contexto

O grace period de `isVerifiedOrGrace()` expira em 02/08 21:00 BRT. A data estava
hard-coded em 3 arquivos independentes sem constante compartilhada nem lever rápido.
Cada extensão anterior (#1018, #1571, #2122) mudava a data em um arquivo e esquecia
outro. O teste de rules auto-detona na virada. O VerificationBanner (mitigação da spec)
é código morto.

## 2. Solução

### 2.1 Estender a data: 2026-08-03 → 2026-10-03 UTC

### 2.2 Constante única compartilhada
- `functions/src/auth/verification-grace.ts` — fonte canônica para functions/
- `cashbox/callable.ts` e `games/join-public-game.ts` importam dela
- `firestore.rules` mantém o literal (linguagem diferente) com comentário linkando

### 2.3 Gate de paridade
- `scripts/check-verification-grace-parity.js` valida que rules date === TS constant
- Avisa quando a grace expira em <= 14 dias

### 2.4 Teste
- `verified-grace.test.ts` atualizado para refletir nova data
- Comentário documenta que o teste falha na expiração (sinal para decidir)

## 3. Follow-up (fora deste PR)
- Reviver VerificationBanner (web + android) enquanto houver grace
- Avaliar Remote Config como a spec FASE 5 pedia (lever sem deploy)
- Decidir sobre reads gateados além da spec (item 3 do issue)

## 4. Verificação
- [ ] `node scripts/check-verification-grace-parity.js` passa
- [ ] `cd functions && npm run build` passa
- [ ] Teste de rules atualizado
