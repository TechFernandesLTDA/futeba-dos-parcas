# ⚡ Firebase Cloud Functions - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [onGameComplete](#ongamecomplete)
- [onBadgeUnlock](#onbadgeunlock)
- [onSeasonEnd](#onseasonend)
- [Testing Localmente](#testing-localmente)
- [Deployment](#deployment)

---

## Visão Geral

Cloud Functions são serverless que executam automaticamente baseado em **eventos do Firestore**.

```
Android/Backend escreve em Firestore
    ↓
Firestore trigger
    ↓
Cloud Function executa
    ↓
Calcula XP, badges, ranking
    ↓
Atualiza Firestore
    ↓
Android observa mudanças e atualiza UI
```

**Localização:** `functions/src/index.ts`

**Runtime:** Node.js 20 + Firebase SDK

---

## onGameComplete

### Propósito

Processa jogo finalizado: calcula XP, badges, atualiza ranking.

### Quando Dispara

Quando game documento tem `status: 'FINISHED'` e `stats` array é preenchido.

```typescript
// Backend escreve isso:
{
    id: 'game-uuid',
    status: 'FINISHED',
    stats: [
        {
            userId: 'user-uuid-1',
            goals: 2,
            assists: 1,
            saves: 0,
            isMvp: false
        },
        {
            userId: 'user-uuid-2',
            goals: 0,
            assists: 0,
            saves: 5,
            isMvp: true
        }
    ]
}
```

### Lógica

```typescript
export const onGameComplete = functions
    .firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Só processar quando status muda para FINISHED
        if (before.status !== 'FINISHED' && after.status === 'FINISHED') {
            await processGameStats(after);
        }
    });

async function processGameStats(game) {
    const stats = game.stats;

    for (const stat of stats) {
        // 1. Calcular XP
        const xpEarned = calculateXP(stat, game);

        // 2. Atualizar user XP
        await updateUserXP(stat.userId, xpEarned);

        // 3. Verificar badges
        const newBadges = await checkBadges(stat.userId);

        // 4. Atualizar ranking
        await updateRanking(stat.userId);
    }
}
```

### Cálculo de XP

```typescript
function calculateXP(stat: GameStat, game: Game): number {
    let xp = 0;

    // XP de presença (base)
    xp += 10;

    // XP por gols
    xp += stat.goals * 5;

    // XP por assists
    xp += stat.assists * 3;

    // XP por saves (goleiros)
    xp += stat.saves * 2;

    // Bônus MVP
    if (stat.isMvp) {
        xp += 50;
    }

    // Bônus vitória (se time ganhou)
    if (game.winningTeamId) {
        const playerTeam = findPlayerTeam(stat.userId, game.teams);
        if (playerTeam.id === game.winningTeamId) {
            xp += 20;  // Bonus vitória
        }
    }

    // Bônus streak (se tem múltiplos games consecutivos)
    const streak = getUserStreak(stat.userId);
    if (streak >= 3) xp += 10;
    if (streak >= 7) xp += 20;
    if (streak >= 10) xp += 30;

    return xp;
}

// Exemplo:
// - Presença: +10
// - 2 gols: +10
// - 1 assist: +3
// - MVP: +50
// - Vitória: +20
// - Streak 7: +20
// TOTAL: 113 XP
```

### Verificação de Badges

```typescript
async function checkBadges(userId: string): Promise<string[]> {
    const newBadges: string[] = [];
    const user = await admin.firestore().collection('users').doc(userId).get();
    const stats = user.data().stats;

    // HAT_TRICK: 3 gols em um jogo
    if (stats.goalsInLastGame >= 3) {
        newBadges.push('HAT_TRICK');
    }

    // PAREDAO: Clean sheet (0 gols levados) como goleiro
    if (stats.isGoalkeeper && stats.goalsAllowedInLastGame === 0) {
        newBadges.push('PAREDAO');
    }

    // ARTILHEIRO_MES: Mais gols no mês
    if (stats.goalsThisMonth > stats.previousMonthMaxGoals) {
        newBadges.push('ARTILHEIRO_MES');
    }

    // FOMINHA: 100% presença no mês
    if (stats.attendanceThisMonth === 100) {
        newBadges.push('FOMINHA');
    }

    // STREAK_7: 7 jogos consecutivos
    if (stats.currentStreak >= 7) {
        newBadges.push('STREAK_7');
    }

    // STREAK_30: 30 jogos consecutivos
    if (stats.currentStreak >= 30) {
        newBadges.push('STREAK_30');
    }

    // MITO: Mais de 500 jogos
    if (stats.totalGamesAllTime >= 500) {
        newBadges.push('MITO');
    }

    // Salvar badges no Firestore
    for (const badge of newBadges) {
        await admin
            .firestore()
            .collection('users')
            .doc(userId)
            .collection('badges')
            .add({
                type: badge,
                unlockedAt: new Date(),
                xpReward: getBadgeXPReward(badge)
            });

        // Enviar notificação
        await sendBadgeNotification(userId, badge);
    }

    return newBadges;
}
```

### Atualizar Ranking

```typescript
async function updateRanking(userId: string): Promise<void> {
    const user = await admin
        .firestore()
        .collection('users')
        .doc(userId)
        .get();

    const userData = user.data();
    const currentXP = userData.xp || 0;
    const currentLevel = calculateLevel(currentXP);

    // Se nível subiu, trigger notificação
    if (currentLevel > userData.level) {
        await sendLevelUpNotification(userId, currentLevel);
    }

    // Atualizar leaderboard por schedule também
    const schedules = await getPlayerSchedules(userId);
    for (const schedule of schedules) {
        await updateScheduleRanking(userId, schedule.id);
    }
}

function calculateLevel(xp: number): number {
    // Cada nível requer: nivel * 1000 XP
    // Nível 1: 0-1000 XP
    // Nível 2: 1000-3000 XP
    // Nível 3: 3000-6000 XP (1000 + 2000)
    // Nível 4: 6000-10000 XP (1000 + 2000 + 3000)

    let level = 1;
    let totalRequired = 0;

    while (totalRequired + level * 1000 <= xp) {
        totalRequired += level * 1000;
        level++;
    }

    return level;
}
```

---

## onBadgeUnlock

### Propósito

Enviar notificação quando badge é desbloqueada.

### Quando Dispara

Quando novo documento é criado em `users/{userId}/badges`.

```typescript
export const onBadgeUnlock = functions
    .firestore
    .document('users/{userId}/badges/{badgeId}')
    .onCreate(async (snap, context) => {
        const badge = snap.data();
        const userId = context.params.userId;

        // Enviar notificação
        await admin.messaging().send({
            token: await getUserFCMToken(userId),
            notification: {
                title: 'Badge Desbloqueada! 🏆',
                body: `Você desbloqueou: ${badge.type}`
            },
            data: {
                type: 'BADGE_UNLOCKED',
                badgeId: badge.type,
                xpReward: badge.xpReward.toString()
            }
        });

        // Adicionar badge XP bonus
        await admin
            .firestore()
            .collection('users')
            .doc(userId)
            .update({
                xp: admin.firestore.FieldValue.increment(badge.xpReward)
            });
    });
```

---

## onSeasonEnd

### Propósito

Finalizar season, dar prêmios, resetar rankings.

### Quando Dispara

Manualmente via schedule ou quando season.endDate é atingida.

```typescript
export const onSeasonEnd = functions
    .pubsub
    .schedule('0 0 1 * *')  // 1º dia do mês às 00:00
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        const season = await getCurrentSeason();

        if (isSeasonEnded(season)) {
            // 1. Buscar top 10 do ranking
            const topPlayers = await getTopPlayersOfSeason(season.id);

            // 2. Dar prêmios
            for (let i = 0; i < topPlayers.length; i++) {
                const reward = getSeasonReward(i);  // 1º: 1000 XP, etc
                await awardSeasonReward(topPlayers[i].userId, reward);
            }

            // 3. Criar nova season
            await createNewSeason();

            // 4. Reset participações
            await resetSeasonParticipations();
        }
    });
```

---

## Testing Localmente

### Setup

```bash
# Instalar emulator
firebase emulators:start --only functions

# Em outro terminal
cd functions
npm run dev
```

### Testar Function

```typescript
// functions/src/test/onGameComplete.test.ts
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions-test';

const testEnv = functions();
const myFunctions = require('../index');

describe('onGameComplete', () => {

    it('should calculate XP correctly', async () => {
        const game = {
            id: 'game-123',
            status: 'FINISHED',
            stats: [
                {
                    userId: 'user-uuid-1',
                    goals: 2,
                    assists: 1,
                    saves: 0,
                    isMvp: false
                }
            ]
        };

        // Trigger function
        const wrapped = testEnv.wrap(myFunctions.onGameComplete);
        const before = { status: 'LIVE', stats: [] };
        const after = game;

        await wrapped(
            { before: { data: () => before }, after: { data: () => after } },
            { params: { gameId: 'game-123' } }
        );

        // Verify XP was awarded
        // Expected: 10 (presence) + 10 (2 goals) + 3 (assist) = 23 XP
        const user = await admin
            .firestore()
            .collection('users')
            .doc('user-uuid-1')
            .get();

        expect(user.data().xp).toBeGreaterThanOrEqual(23);
    });
});
```

### Rodando Testes

```bash
npm run test

# Output esperado:
# ✓ onGameComplete
#   ✓ should calculate XP correctly (45ms)
# ✓ onBadgeUnlock
#   ✓ should send notification (120ms)
```

---

## Deployment

### Preparação

```bash
# 1. Build TypeScript
cd functions
npm run build

# 2. Verificar erros
npm run lint

# 3. Ver função que será deployada
firebase functions:list
```

### Deploy

```bash
# Deploy apenas funções (não firestore rules)
firebase deploy --only functions

# Output esperado:
# ✓ functions[onGameComplete]: Successful update operation.
# ✓ functions[onBadgeUnlock]: Successful update operation.
# ✓ functions[onSeasonEnd]: Successful update operation.
```

### Monitorar

```bash
# Ver logs em tempo real
firebase functions:log --follow

# Ver logs específicos
firebase functions:log --function onGameComplete --limit 50

# Via console
# https://console.firebase.google.com → Functions → Logs
```

### Rollback

```bash
# Se algo der errado
firebase deploy --only functions --version v1

# Ou deletar função
firebase functions:delete onGameComplete
```

---

## Configuração de Memória

```typescript
// index.ts
export const onGameComplete = functions
    .runWith({
        memory: '512MB',  // Default é 256MB
        timeoutSeconds: 300  // Default é 60s
    })
    .firestore
    .document('games/{gameId}')
    .onUpdate(async (change) => {
        // ...
    });
```

---

## Error Handling

```typescript
export const onGameComplete = functions
    .firestore
    .document('games/{gameId}')
    .onUpdate(async (change, context) => {
        try {
            const after = change.after.data();

            if (after.status === 'FINISHED') {
                await processGameStats(after);
            }
        } catch (error) {
            // Log erro
            console.error('Error processing game completion:', error);

            // Notificar admin
            await sendErrorAlert('Game processing failed', error);

            // Re-throw para Firebase saber que falhou
            throw new functions.https.HttpsError(
                'internal',
                'Failed to process game completion'
            );
        }
    });
```

---

## Veja Também

- [README.md](./README.md) - Setup e deploy
- [../ARCHITECTURE.md](../ARCHITECTURE.md) - Como Cloud Functions se integram
- [../backend/SERVICES.md](../backend/SERVICES.md) - Services que disparam functions

---

**Última atualização:** Dezembro 2025
**Runtime:** Node.js 20+
**Firebase SDK:** ^7.0.0
