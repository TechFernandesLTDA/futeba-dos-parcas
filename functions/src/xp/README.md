# XP Processing Module

Sistema de processamento de XP com garantias de **idempotência**, **atomicidade** e **performance**.

## 2026-07 Settings Migration

- `app_settings/gamification` continua aceitando o contrato legado com campos flat (`xp_per_goal`, `xp_win`, etc.).
- O backend agora também lê blocos opcionais compatíveis sem migração destrutiva:
  - `xpActions`
  - `performanceBonuses`
  - `behaviorBonuses`
  - `retentionBonuses`
- Deploy seguro:
  - publicar Functions primeiro;
  - depois seedar/editar `app_settings/gamification` com os novos blocos ou novos campos flat;
  - nenhum backfill retroativo de `xp_logs` é executado.
- Novos campos operacionais gravados a partir do deploy:
  - `users.last_played_game_date`
  - `users.last_played_month_key`
  - `users.last_comeback_month_key`
  - `users.monthly_streak`
  - `statistics.recordedEventsGames`
  - breakdown expandido em `xp_logs`

---

## 🎯 Problema Resolvido

### Antes
```typescript
// ❌ PROBLEMA: XP pode ser duplicado em retries
await db.collection("users").doc(userId).update({
  experience_points: admin.firestore.FieldValue.increment(100)
});

await db.collection("xp_logs").doc().set({
  user_id: userId,
  game_id: gameId,
  xp_earned: 100
});

// Se a function for retentada: +100 XP NOVAMENTE! 💥
```

### Depois
```typescript
// ✅ SOLUÇÃO: Idempotência via transaction_id
const result = await processXpIdempotent({
  gameId: "game123",
  userId: "user456",
  xpEarned: 100,
  // ...
});

if (result.alreadyProcessed) {
  console.log("XP já processado. Pulando retry.");
}

// Múltiplas chamadas = 1 processamento ✨
```

---

## 📦 API Reference

### `processXpIdempotent(data)`

Processa XP para um único jogador com garantia de idempotência.

**Parâmetros:**
```typescript
interface XpTransactionData {
  gameId: string;           // ID do jogo
  userId: string;           // ID do usuário
  xpEarned: number;         // XP total ganho (pode ser negativo)
  xpBefore: number;         // XP antes do jogo
  xpAfter: number;          // XP depois do jogo
  levelBefore: number;      // Nível antes
  levelAfter: number;       // Nível depois
  breakdown: XpBreakdown;   // Detalhamento do XP
  metadata: XpMetadata;     // Metadados do jogo
}

interface XpBreakdown {
  participation: number;    // XP por presença
  goals: number;            // XP por gols
  assists: number;          // XP por assistências
  saves: number;            // XP por defesas
  result: number;           // XP por resultado (vitória/empate)
  mvp: number;              // XP por MVP
  cleanSheet: number;       // XP por clean sheet (goleiro)
  milestones: number;       // XP por milestones
  streak: number;           // XP por streak
  penalty: number;          // XP de penalidade (negativo)
}

interface XpMetadata {
  goals: number;
  assists: number;
  saves: number;
  wasMvp: boolean;
  wasCleanSheet: boolean;
  wasWorstPlayer: boolean;
  gameResult: "WIN" | "DRAW" | "LOSS";
  milestonesUnlocked: string[];
}
```

**Retorno:**
```typescript
interface XpProcessingResult {
  success: boolean;
  transactionId: string;
  alreadyProcessed: boolean;
  error?: string;
}
```

**Exemplo:**
```typescript
import { processXpIdempotent } from "./xp/processing";

const result = await processXpIdempotent({
  gameId: "abc123",
  userId: "xyz789",
  xpEarned: 150,
  xpBefore: 500,
  xpAfter: 650,
  levelBefore: 5,
  levelAfter: 6,
  breakdown: {
    participation: 10,
    goals: 50,      // 5 gols * 10 XP
    assists: 21,    // 3 assists * 7 XP
    saves: 0,
    result: 20,     // Vitória
    mvp: 30,        // Foi MVP
    cleanSheet: 0,
    milestones: 50, // Desbloqueou milestone
    streak: 0,
    penalty: 0
  },
  metadata: {
    goals: 5,
    assists: 3,
    saves: 0,
    wasMvp: true,
    wasCleanSheet: false,
    wasWorstPlayer: false,
    gameResult: "WIN",
    milestonesUnlocked: ["GOALS_10"]
  }
});

if (result.success && !result.alreadyProcessed) {
  console.log("✅ XP processado com sucesso!");
} else if (result.alreadyProcessed) {
  console.log("ℹ️ XP já foi processado anteriormente");
} else {
  console.error("❌ Erro ao processar XP:", result.error);
}
```

---

### `processXpBatch(transactions)`

Processa múltiplos jogadores em batch com idempotência.

**Performance**: Até **500 operações** por batch (vs 60+ operações sequenciais antes).

**Exemplo:**
```typescript
import { processXpBatch } from "./xp/processing";

// Processar 20 jogadores de uma vez
const transactions = players.map(player => ({
  gameId: "game123",
  userId: player.id,
  xpEarned: calculateXp(player),
  // ... outros campos
}));

const results = await processXpBatch(transactions);

const successful = results.filter(r => r.success).length;
const skipped = results.filter(r => r.alreadyProcessed).length;

console.log(`${successful}/${transactions.length} processados`);
console.log(`${skipped} já existiam (idempotência)`);
```

---

### `retryXpOperation(operation, maxRetries, backoffMs)`

Executa operação com retry automático e exponential backoff.

**Exemplo:**
```typescript
import { retryXpOperation } from "./xp/processing";

const result = await retryXpOperation(
  async () => {
    // Operação que pode falhar temporariamente
    return await processXpIdempotent(data);
  },
  maxRetries: 3,           // Até 3 tentativas
  initialBackoffMs: 1000   // Backoff inicial de 1s
);

// Tentativa 1: Imediato
// Tentativa 2: 1s depois (2^0 * 1000ms)
// Tentativa 3: 2s depois (2^1 * 1000ms)
// Tentativa 4: 4s depois (2^2 * 1000ms)
```

**Erros que causam retry:**
- `ABORTED` (code 10) - Contenção no Firestore
- `UNAVAILABLE` (code 14) - Serviço indisponível
- `DEADLINE_EXCEEDED` - Timeout
- Network errors (ECONNRESET, ETIMEDOUT)

---

## 🔧 Utilitários

### `generateTransactionId(gameId, userId)`

Gera um transaction ID determinístico.

```typescript
import { generateTransactionId } from "./xp/processing";

const txId = generateTransactionId("game123", "user456");
// "game_game123_user_user456"

// Mesma chamada sempre retorna o mesmo ID
const txId2 = generateTransactionId("game123", "user456");
console.log(txId === txId2); // true
```

### `isTransactionAlreadyProcessed(transactionId)`

Verifica se uma transação já foi processada.

```typescript
import { isTransactionAlreadyProcessed } from "./xp/processing";

const alreadyProcessed = await isTransactionAlreadyProcessed(
  "game_abc123_user_xyz789"
);

if (alreadyProcessed) {
  console.log("Transação já processada. Pulando.");
}
```

---

## 🚀 Integração com Código Existente

### Opção 1: Processamento Híbrido (Migração Gradual)

Use `processXpHybrid()` para manter backward compatibility:

```typescript
import { processXpHybrid } from "./xp/migration-example";

// Funciona com ambos sistemas (antigo e novo)
await processXpHybrid({
  gameId,
  userId,
  currentXp,
  finalXp,
  currentLevel,
  newLevel,
  settings,
  conf,
  result,
  isMvp,
  cleanSheetXp,
  streakXp,
  milesXp,
  penaltyXp,
  newMilestones
}, batch); // batch opcional (usado no sistema antigo)
```

**Controle via Feature Flag:**
```javascript
// Firestore > app_settings > xp_processing
{
  enable_idempotent_processing: true  // Usar novo sistema
}
```

### Opção 2: Migração Direta

Substitua o código antigo diretamente:

```typescript
// ❌ ANTES (index.ts - linhas 600-650)
batch.update(db.collection("users").doc(uid), userUpdate);
batch.set(logRef, log);

// ✅ DEPOIS
import { processXpIdempotent } from "./xp/processing";

await processXpIdempotent({
  gameId,
  userId: uid,
  xpEarned: xp,
  xpBefore: currentXp,
  xpAfter: finalXp,
  levelBefore: currentLevel,
  levelAfter: newLevel,
  breakdown: {
    participation: settings.xp_presence,
    goals: conf.goals * settings.xp_per_goal,
    assists: conf.assists * settings.xp_per_assist,
    saves: conf.saves * settings.xp_per_save,
    result: resultXp,
    mvp: mvpXp,
    cleanSheet: cleanSheetXp,
    milestones: milesXp,
    streak: streakXp,
    penalty: penaltyXp
  },
  metadata: {
    goals: conf.goals,
    assists: conf.assists,
    saves: conf.saves,
    wasMvp: isMvp,
    wasCleanSheet: cleanSheetXp > 0,
    wasWorstPlayer: conf.is_worst_player,
    gameResult: result,
    milestonesUnlocked: newMilestones
  }
});
```

---

## 🧪 Testes

### Unit Tests
```bash
cd functions
npm test -- xp/processing.test.ts
```

### Teste Manual (Firebase Emulator)
```bash
# Iniciar emulators
firebase emulators:start --only functions,firestore

# Processar mesmo jogo 3x
curl -X POST http://localhost:5001/.../processXp \
  -d '{"gameId": "test123", "userId": "user456"}'

curl -X POST http://localhost:5001/.../processXp \
  -d '{"gameId": "test123", "userId": "user456"}'

curl -X POST http://localhost:5001/.../processXp \
  -d '{"gameId": "test123", "userId": "user456"}'

# Verificar Firestore: Deve ter apenas 1 xp_log
```

---

## 📊 Performance

### Antes (Sistema Antigo)
```
Processar jogo com 20 jogadores:
- 20 reads sequenciais (users)
- 20 reads sequenciais (statistics)
- 20 reads sequenciais (streaks)
- 60 writes (user + log + stats)
= ~80 operações Firestore
= ~30 segundos
```

### Depois (Sistema Novo)
```
Processar jogo com 20 jogadores:
- 3 reads paralelos (users, stats, streaks em batch)
- 1 batch write (500 ops)
= 4 operações Firestore
= <5 segundos
```

**Ganho**: **6x faster** 🚀

---

## 🔐 Garantias

### Idempotência
✅ Múltiplas chamadas com mesmos parâmetros = 1 processamento
✅ Retry seguro infinitas vezes
✅ Não há risco de XP duplicado

### Atomicidade
✅ User XP e xp_log sempre consistentes
✅ Rollback automático em falhas
✅ Firestore Transactions garantem ACID

### Consistência
✅ Transaction ID determinístico
✅ Double-check dentro de transaction (race conditions)
✅ Logs estruturados para auditoria

---

## 🐛 Troubleshooting

### "Transação já processada"
```
[XP_IDEMPOTENCY] Transação game_abc123_user_xyz789 já processada. Pulando.
```

**Causa**: XP já foi processado anteriormente (comportamento esperado em retries).
**Ação**: Nenhuma. Sistema funcionando corretamente.

### "Erro ao processar XP: contention"
```
[XP_RETRY] Tentativa 1/3 falhou. Retry em 1000ms...
```

**Causa**: Contenção no Firestore (múltiplas escritas simultâneas).
**Ação**: Retry automático. Se persistir, verificar carga do sistema.

### "Missing transaction_id"
```
[BACKFILL] Log abc123 sem transaction_id
```

**Causa**: Log criado antes da migração.
**Ação**: Executar `backfillTransactionIds()` para adicionar IDs.

---

## 📚 Referências

- [Spec Completa](../../../specs/BACKEND_OPTIMIZATION_SPEC.md)
- [Migration Guide](./migration-example.ts)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Idempotency Patterns](https://stripe.com/docs/api/idempotent_requests)

---

## 🤝 Contribuindo

1. Adicionar testes em `processing.test.ts`
2. Executar `npm run build` para compilar
3. Testar com emulators antes de deploy
4. Atualizar esta documentação

---

## 📝 Changelog

### 2026-02-02 - v1.0.0
- Implementação inicial
- Idempotência via transaction_id
- Batch processing (500 ops)
- Retry com exponential backoff
