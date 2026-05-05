# SPEC: Phone+CPF Verification — Fase 5 Enforcement

**Status:** APPROVED
**Date:** 2026-05-04
**Owner:** TechFernandesLTDA
**Type:** Security Enforcement
**Predecessor:** Fase 1 (#444), Fase 2 (#445), Fase 3 (#446) — todas merged

---

## Contexto

Foundations das Fases 1-3 prontas:
- Cloud Functions `verifyCpf` + `setUserVerified` em prod
- Web + Android onboarding screens
- CPF/Phone storage + Custom Claim `verified`

Falta: **enforcement** — atualmente `verified` é setado mas NADA nas regras impede usuário não-verified de criar jogos, votar MVP, etc.

## Objetivo

Aplicar `isVerified()` em rules de write críticas, com **grace period** pra usuários existentes (Remote Config).

## Mudanças

### 1. firestore.rules — helper isVerified()

```javascript
function isVerified() {
  // Pos-grace: exige custom claim verified=true
  // Pre-grace: permite todos autenticados
  // Grace flag controlado server-side via Remote Config
  // (clientes nao podem bypassar)
  return request.auth != null &&
         request.auth.token.verified == true;
}

// Helper conditional pra grace period via param de groups
function isVerifiedOrGrace() {
  return isAuthenticated() && (
    request.auth.token.verified == true ||
    // Grace period ate 2026-06-04 (30d apos deploy)
    request.time < timestamp.date(2026, 6, 4)
  );
}
```

### 2. Aplicar em writes críticos

| Collection / Action | Rule update |
|---------------------|-------------|
| `games` create | + isVerifiedOrGrace() |
| `confirmations` create | + isVerifiedOrGrace() |
| `mvp_votes` create | + isVerifiedOrGrace() |
| `groups` create | + isVerifiedOrGrace() |
| `cashbox_transactions` create | + isVerifiedOrGrace() |
| `game_events` create | + isVerifiedOrGrace() |

Reads NÃO bloqueados (usuário existente vê dados).

### 3. UI: banner de aviso

Web + Android: banner amarelo persistente pra usuários sem `verified=true` lembrando do prazo.

```typescript
// web/src/components/VerificationBanner.tsx
- Mostra apenas se !verified
- Calcula dias restantes ate 2026-06-04
- Botão "Verificar agora" → /onboarding/phone
- Dismissable apenas até 7 dias antes do fim do grace
```

### 4. Métricas

Log Cloud Function quando `verified=true` é setado pela primeira vez:
- audit_logs collection: `{ type: 'USER_VERIFIED', uid, at, source: 'web|android|ios' }`

Permite acompanhar % migração.

---

## Test Plan

- [ ] Emulator: usuário !verified durante grace pode criar game
- [ ] Emulator: usuário !verified após grace é negado
- [ ] Emulator: usuário verified=true sempre permitido
- [ ] Web: banner aparece pra !verified, esconde se verified
- [ ] Smoke prod: criar grupo + jogo + vote funciona pra users existentes (during grace)

---

## Risks

| Risco | Mitigação |
|-------|-----------|
| Usuários abandonam onboarding | Banner não-bloqueante 30d |
| Bug em isVerified() bloqueia todo mundo | grace check evita disrupção total |
| Custom claim não propaga após verifyCpf | force token refresh já implementado nas Fases 2/3 |

---

## Closes

Closes #448 (Phone+CPF Fase 5 Enforcement).
