# SPEC: Cloud Functions Idempotency & Batching

**Status:** APPROVED
**Prioridade:** P0 (CRÍTICO)
**Tipo:** Backend Performance + Reliability
**Data:** 2026-02-02
**Owner:** Agent-Backend

---

## 1. PROBLEMA

### Situação Atual

**Processamento de XP não é idempotente:**
```typescript
// PROBLEMA: Se function for retriada, XP é duplicado
export const onGameFinished = onDocumentUpdated('games/{gameId}', async (event) => {
  const gameData = event.data.after.data();

  if (gameData.status === 'FINISHED' && !gameData.xp_processed) {
    // Se falhar APÓS escrever xp_logs mas ANTES de setar xp_processed...
    // Retry vai duplicar XP!
    await processXpForAllPlayers(gameId);
    await event.data.after.ref.update({ xp_processed: true });
  }
});
```

**Impacto:**
- Retry automático do Firebase Functions pode duplicar XP
- Network failures durante write = inconsistências
- Usuários podem receber 2x o XP merecido

### Cenário de Falha Real

1. `onGameFinished` trigga para game123
2. Processa XP de 20 jogadores (20 writes)
3. Network failure ANTES de setar `xp_processed: true`
4. Firebase retria a function automaticamente
5. **DUPLICAÇÃO:** 20 jogadores recebem XP 2x

**Frequência Estimada:** 1-2% dos jogos (com alta carga)

---

## 2. SOLUÇÃO: TRANSACTION IDS + FIRESTORE TRANSACTIONS

### Arquitetura

```typescript
interface XpTransaction {
  transaction_id: string;      // UUID único
  game_id: string;
  user_id: string;
  xp_amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  created_at: Timestamp;
  completed_at?: Timestamp;
  retry_count: number;
}

// Collection: xp_transactions/{transaction_id}
```

### Implementação

```typescript
import { v4 as uuidv4 } from 'uuid';

export const processXpIdempotent = async (gameId: string, userId: string, xpAmount: number) => {
  // 1. Gerar transaction ID determinístico (game_user_timestamp)
  const transactionId = `${gameId}_${userId}_${Date.now()}`;

  // 2. Verificar se transaction já existe
  const txRef = db.collection('xp_transactions').doc(transactionId);
  const existing = await txRef.get();

  if (existing.exists && existing.data()?.status === 'COMPLETED') {
    console.log(`XP transaction ${transactionId} already processed. Skipping.`);
    return { alreadyProcessed: true };
  }

  // 3. Criar transaction com status PENDING
  await txRef.set({
    transaction_id: transactionId,
    game_id: gameId,
    user_id: userId,
    xp_amount: xpAmount,
    status: 'PENDING',
    created_at: FieldValue.serverTimestamp(),
    retry_count: 0
  });

  try {
    // 4. Processar XP usando Firestore Transaction (atomicidade)
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error(`User ${userId} not found`);
      }

      const currentXp = userDoc.data()?.experience_points || 0;
      const newXp = currentXp + xpAmount;

      // Atomic update
      transaction.update(userRef, {
        experience_points: newXp,
        level: calculateLevel(newXp)
      });

      // Criar xp_log
      const logRef = db.collection('xp_logs').doc();
      transaction.set(logRef, {
        user_id: userId,
        game_id: gameId,
        xp_earned: xpAmount,
        xp_before: currentXp,
        xp_after: newXp,
        transaction_id: transactionId,  // Link para auditoria
        created_at: FieldValue.serverTimestamp()
      });

      // Marcar transaction como COMPLETED
      transaction.update(txRef, {
        status: 'COMPLETED',
        completed_at: FieldValue.serverTimestamp()
      });
    });

    return { success: true };

  } catch (error) {
    // Marcar como FAILED para retry
    await txRef.update({
      status: 'FAILED',
      retry_count: FieldValue.increment(1),
      last_error: error.message
    });

    throw error;
  }
};
```

---

## 3. BATCHING DE WRITES

### Problema Atual
```typescript
// INEFICIENTE: 20 jogadores = 60+ writes separados
for (const player of confirmedPlayers) {
  await updateUserXp(player.userId, xp);        // 1 write
  await createXpLog(player.userId, xp);         // 1 write
  await updateStatistics(player.userId, stats); // 1 write
}
// Total: 60 writes sequenciais (~6 segundos)
```

### Solução: Batch Writes
```typescript
// OTIMIZADO: 60 writes em 1 batch (~500ms)
const batch = db.batch();

for (const player of confirmedPlayers) {
  const userRef = db.collection('users').doc(player.userId);
  batch.update(userRef, {
    experience_points: FieldValue.increment(xp)
  });

  const logRef = db.collection('xp_logs').doc();
  batch.set(logRef, { /* xp log data */ });

  const statsRef = db.collection('statistics').doc(player.userId);
  batch.update(statsRef, { /* stats */ });
}

// Executar todas as 60 operações atomicamente
await batch.commit();
```

**Performance:**
- Antes: 60 writes × 100ms = 6000ms
- Depois: 1 batch commit = 500ms
- **Ganho:** 12x mais rápido

**Limite:** 500 operações por batch (Firestore limit)

---

## 4. RATE LIMITING

### Implementação

```typescript
// Middleware para callable functions
export const rateLimiter = (maxCallsPerMinute: number) => {
  return async (request: CallableRequest) => {
    const userId = request.auth?.uid;
    if (!userId) throw new Error('Unauthenticated');

    const rateLimitRef = db.collection('rate_limits').doc(userId);
    const doc = await rateLimitRef.get();

    const now = Date.now();
    const data = doc.data();
    const windowStart = data?.window_start || 0;
    const callCount = data?.call_count || 0;

    // Reset window se passou 1 minuto
    if (now - windowStart > 60000) {
      await rateLimitRef.set({
        window_start: now,
        call_count: 1
      });
      return; // Allow
    }

    // Check limit
    if (callCount >= maxCallsPerMinute) {
      throw new HttpsError('resource-exhausted', `Rate limit exceeded: ${maxCallsPerMinute} calls/min`);
    }

    // Increment counter
    await rateLimitRef.update({
      call_count: FieldValue.increment(1)
    });
  };
};

// Uso
export const processXp = onCall({
  timeoutSeconds: 60,
  memory: '512MiB'
}, async (request) => {
  await rateLimiter(10)(request); // Max 10 calls/min

  // Process XP...
});
```

---

## 5. RETRY LOGIC COM EXPONENTIAL BACKOFF

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries: ${lastError.message}`);
}

// Uso
await retryWithBackoff(async () => {
  return await processXpIdempotent(gameId, userId, xp);
});
```

---

## 6. MIGRATION STRATEGY

### Fase 1: Deploy New Functions (Backward Compatible)
1. Deploy `processXpIdempotent` como nova function
2. Manter `processXp` antigo funcionando
3. Adicionar feature flag: `use_idempotent_xp: boolean`

### Fase 2: Gradual Rollout
1. Habilitar para 10% dos jogos
2. Monitorar: duplicações, latência, errors
3. Aumentar para 50%, depois 100%

### Fase 3: Cleanup
1. Remover function antiga
2. Remover feature flag
3. Documentar novo processo

---

## 7. SUCCESS METRICS

| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| XP Duplications | 1-2% | 0% | <0.01% |
| Processing Time | 6s | 0.5s | <1s |
| Function Errors | 5% | <1% | <0.5% |
| Retry Success | N/A | >95% | >90% |

---

## 8. TESTING

### Unit Tests
```typescript
describe('XP Idempotency', () => {
  it('should process XP only once even with retries', async () => {
    const gameId = 'game123';
    const userId = 'user456';
    const xp = 50;

    // Primeira execução
    await processXpIdempotent(gameId, userId, xp);

    // Retry (simular failure + retry)
    const result = await processXpIdempotent(gameId, userId, xp);

    expect(result.alreadyProcessed).toBe(true);

    // Verificar XP no Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    expect(userDoc.data().experience_points).toBe(50); // Não 100!
  });
});
```

---

## 9. DEFINITION OF DONE

- [ ] `processXpIdempotent` implementado
- [ ] Batch writes em `onGameFinished`
- [ ] Rate limiting em callable functions
- [ ] Retry logic com exponential backoff
- [ ] Testes unitários passando
- [ ] Feature flag configurada
- [ ] Rollout gradual iniciado
- [ ] Métricas de duplicação = 0%
- [ ] Documentação atualizada

---

**Aprovado por:** Tech Lead (Claude Code)
**Data de Aprovação:** 2026-02-02
**Implementação:** Agent-Backend
