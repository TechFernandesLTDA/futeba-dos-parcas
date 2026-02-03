# SPEC: Security Rules Optimization + Custom Claims Migration

**Status:** APPROVED
**Prioridade:** P0 (CRÍTICO)
**Tipo:** Performance + Security
**Data:** 2026-02-02
**Owner:** Agent-Security

---

## 1. CONTEXTO & PROBLEMA

### Problema Atual
As Firestore Security Rules fazem **excesso de `get()` calls**, cada um custando 1 read operation:

```javascript
// PROBLEMA: Chamado em TODA requisição
function getUserRole() {
  let userDoc = get(/databases/$(database)/documents/users/$(request.auth.uid));
  return userDoc != null ? userDoc.data.role : null;
}

// Usado em 15+ lugares nas rules
function isGroupMember(groupId) {
  let memberDoc = get(/databases/$(database)/documents/groups/$(groupId)/members/$(userId()));
  return memberDoc != null && memberDoc.data.status == 'ACTIVE';
}
```

**Impacto de Custo:**
- 1000 usuários ativos × 10 requests/dia × 2 get() calls = **20.000 reads extras/dia**
- Custo mensal: ~$3.60 (pequeno, mas escala linearmente)
- Com 10k usuários: **$36/mês** só em reads de permissão

### Métricas Atuais
- Firestore reads/dia: ~50k (estimado)
- % de reads para permissões: ~40% (20k/50k)
- Latência média de write: 150ms (inclui get() overhead)

---

## 2. SOLUÇÃO PROPOSTA

### Custom Claims Migration

**Firebase Custom Claims** são incluídos no JWT token, **sem custo adicional**.

```typescript
// Cloud Function para setar claims
export const setUserRole = onCall(async (request) => {
  const { uid, role } = request.data;

  // Validar que apenas admin pode mudar roles
  if (request.auth?.token?.role !== 'ADMIN') {
    throw new Error('Unauthorized');
  }

  await admin.auth().setCustomUserClaims(uid, { role });

  // Atualizar Firestore para sincronização
  await db.collection('users').doc(uid).update({
    role,
    claims_updated_at: FieldValue.serverTimestamp()
  });
});
```

**Security Rules Otimizadas:**
```javascript
// ANTES: 1 get() call
function isAdmin() {
  return isAuthenticated() && getUserRole() == 'ADMIN';
}

// DEPOIS: 0 get() calls
function isAdmin() {
  return request.auth != null && request.auth.token.role == 'ADMIN';
}
```

### Mudanças nas Rules

**1. Remover funções com get():**
- `getUserRole()` → `request.auth.token.role`
- `isGroupMember()` → Denormalizar status em Custom Claim
- `isGameOwner()` → Manter (complexo, mas cachear no client)

**2. Adicionar Rate Limiting:**
```javascript
// Prevenir spam de creates
function canCreateGame() {
  // Verificar timestamp do último game criado
  // (requer documento de rate limit por usuário)
  return true; // Simplificado por enquanto
}
```

**3. Validar Bounds Estritamente:**
```javascript
function isValidScore(score) {
  return score is number && score >= 0 && score <= 100; // Max 100 gols
}
```

---

## 3. MIGRATION STRATEGY

### Fase 1: Preparação (Sem Breaking Changes)
1. Deploy Cloud Function `setUserRole`
2. Script de migração para setar Custom Claims em usuários existentes
3. Atualizar Firestore Rules mantendo AMBAS as verificações:
   ```javascript
   function isAdmin() {
     return request.auth != null && (
       request.auth.token.role == 'ADMIN' ||  // Novo
       getUserRole() == 'ADMIN'                // Fallback antigo
     );
   }
   ```

### Fase 2: Rollout Gradual
1. Deploy app versão N+1 que lê `token.role`
2. Forçar refresh de tokens (logout/login) gradualmente
3. Monitorar métricas de Firestore reads (devem cair 30-40%)

### Fase 3: Cleanup
1. Após 95% dos usuários migrarem (2 semanas)
2. Remover fallback `getUserRole()` das rules
3. Documentar novo processo de role management

### Rollback Plan
Se houver problemas:
1. Revert Security Rules para versão anterior (instant)
2. Manter Custom Claims (não faz mal)
3. Investigar issue antes de retry

---

## 4. APP CHECK IMPLEMENTATION

### Configuração
```typescript
// functions/src/index.ts
import { defineString } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';

const appCheckToken = defineString('APP_CHECK_TOKEN');

export const processXp = onCall({
  enforceAppCheck: true, // IMPORTANTE
  consumeAppCheckToken: true
}, async (request) => {
  // Agora só aceita calls de apps verificados
});
```

**No Android App:**
```kotlin
// App.kt
FirebaseApp.initializeApp(this)
FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
    PlayIntegrityAppCheckProviderFactory.getInstance()
)
```

---

## 5. SUCCESS METRICS

### Objetivos (30 dias após deploy)
- ✅ Firestore reads/dia reduzidos em **30-40%**
- ✅ Latência de writes reduzida em **20ms** (média)
- ✅ 0 incidentes de segurança relacionados a roles
- ✅ App Check bloqueando >99% de requests não-verificados
- ✅ Custo de Firestore reduzido em **$10-15/mês**

### Monitoramento
```javascript
// Cloud Function de métricas
export const trackSecurityMetrics = onSchedule('every 1 hours', async () => {
  const metrics = {
    firestore_reads: await getFirestoreReads(),
    app_check_success_rate: await getAppCheckRate(),
    avg_write_latency: await getAvgLatency()
  };

  await db.collection('metrics').add({
    ...metrics,
    timestamp: FieldValue.serverTimestamp()
  });
});
```

---

## 6. TESTING PLAN

### Unit Tests (Security Rules)
```javascript
// firestore.test.js
describe('Security Rules - Custom Claims', () => {
  it('should allow admin to edit any game', async () => {
    const admin = testEnv.authenticatedContext('admin-uid', {
      role: 'ADMIN' // Custom claim
    });

    await assertSucceeds(
      admin.firestore().collection('games').doc('game1').update({
        status: 'FINISHED'
      })
    );
  });

  it('should deny non-admin to edit others games', async () => {
    const player = testEnv.authenticatedContext('player-uid', {
      role: 'PLAYER'
    });

    await assertFails(
      player.firestore().collection('games').doc('game1').update({
        owner_id: 'player-uid' // Tentar roubar ownership
      })
    );
  });
});
```

### Integration Tests
1. Criar usuário novo → Verificar Custom Claim setado
2. Mudar role de PLAYER → ADMIN → Verificar permissões
3. Simular 1000 requests → Medir reads

---

## 7. DEPENDENCIES & RISKS

### Dependências
- Firebase Admin SDK 11+
- App compilado com Firebase v33.7.0+
- Play Integrity API configurado no Google Cloud Console

### Riscos
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Custom Claims não sincronizam | Baixa | Alto | Fallback para Firestore durante transição |
| App Check bloqueia usuários legítimos | Média | Alto | Modo permissivo por 1 semana, depois enforce |
| Breaking change em auth | Baixa | Alto | Manter backward compatibility por 2 semanas |

---

## 8. DEFINITION OF DONE

- [ ] Cloud Function `setUserRole` deployed
- [ ] Script de migração executado (100% usuários)
- [ ] Security Rules atualizadas (com fallback)
- [ ] App Check configurado (modo enforce)
- [ ] Testes de Security Rules passando
- [ ] Documentação atualizada (CLAUDE.md)
- [ ] Métricas coletadas (baseline)
- [ ] Rollout gradual iniciado (10% → 50% → 100%)
- [ ] Monitoramento ativo (alertas configurados)
- [ ] Validação final: reads reduzidos >30%

---

**Aprovado por:** Tech Lead (Claude Code)
**Data de Aprovação:** 2026-02-02
**Implementação:** Agent-Security
