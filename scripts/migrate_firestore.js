/**
 * Script de migracao do Firestore
 *
 * Executa:
 * 1. Migra confirmacoes para ID deterministico (${gameId}_${userId})
 * 2. Migra estatisticas de snake_case para camelCase
 *
 * Para executar:
 * 1. Instalar: npm install firebase-admin
 * 2. Baixar service account key do Firebase Console
 * 3. Executar: node migrate_firestore.js
 */

const admin = require('firebase-admin');

// Inicializar com service account
// Baixe de: Firebase Console > Project Settings > Service Accounts > Generate New Private Key
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ============================================
// MIGRACAO 1: Confirmacoes com ID deterministico
// ============================================
async function migrateConfirmations() {
  console.log('\n=== MIGRACAO: Confirmacoes ===');

  const confirmations = await db.collection('confirmations').get();
  console.log(`Total de confirmacoes: ${confirmations.size}`);

  let migratedCount = 0;
  let skippedCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of confirmations.docs) {
    const data = doc.data();
    const gameId = data.game_id;
    const userId = data.user_id;

    if (!gameId || !userId) {
      console.warn(`[SKIP] Documento ${doc.id} sem game_id ou user_id`);
      skippedCount++;
      continue;
    }

    const expectedId = `${gameId}_${userId}`;

    if (doc.id === expectedId) {
      skippedCount++;
      continue;
    }

    // Criar documento com ID correto
    batch.set(db.collection('confirmations').doc(expectedId), data);
    // Deletar documento antigo
    batch.delete(doc.ref);
    migratedCount++;
    batchCount += 2;

    // Commit a cada 400 operacoes (limite e 500)
    if (batchCount >= 400) {
      await batch.commit();
      console.log(`  Committed batch: ${migratedCount} migrados`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  // Commit final
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nResultado:`);
  console.log(`  - Migrados: ${migratedCount}`);
  console.log(`  - Ja corretos: ${skippedCount}`);
}

// ============================================
// MIGRACAO 2: Estatisticas snake_case -> camelCase
// ============================================
async function migrateStatistics() {
  console.log('\n=== MIGRACAO: Estatisticas ===');

  const stats = await db.collection('statistics').get();
  console.log(`Total de estatisticas: ${stats.size}`);

  const fieldMapping = {
    'total_games': 'totalGames',
    'total_goals': 'totalGoals',
    'total_saves': 'totalSaves',
    'best_player_count': 'bestPlayerCount',
    'worst_player_count': 'worstPlayerCount',
    'best_goal_count': 'bestGoalCount',
    'games_won': 'gamesWon',
    'games_lost': 'gamesLost',
    'games_draw': 'gamesDraw'
  };

  let migratedCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const doc of stats.docs) {
    const data = doc.data();
    const newData = { ...data };
    let needsMigration = false;

    // Converter campos snake_case para camelCase
    for (const [oldKey, newKey] of Object.entries(fieldMapping)) {
      if (oldKey in data && !(newKey in data)) {
        newData[newKey] = data[oldKey];
        delete newData[oldKey];
        needsMigration = true;
      }
    }

    if (needsMigration) {
      batch.set(doc.ref, newData);
      migratedCount++;
      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        console.log(`  Committed batch: ${migratedCount} migrados`);
        batch = db.batch();
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`\nResultado: ${migratedCount} estatisticas migradas`);
}

// ============================================
// VALIDACAO: Verificar contadores de jogos
// ============================================
async function validateGameCounters() {
  console.log('\n=== VALIDACAO: Contadores de Jogos ===');

  const games = await db.collection('games').get();
  console.log(`Total de jogos: ${games.size}`);

  let issuesFound = 0;

  for (const gameDoc of games.docs) {
    const game = gameDoc.data();
    const gameId = gameDoc.id;

    // Buscar confirmacoes reais
    const confirmations = await db.collection('confirmations')
      .where('game_id', '==', gameId)
      .where('status', '==', 'CONFIRMED')
      .get();

    const actualPlayers = confirmations.size;
    const actualGoalkeepers = confirmations.docs.filter(
      d => d.data().position === 'GOALKEEPER'
    ).length;

    const storedPlayers = game.players_count || 0;
    const storedGoalkeepers = game.goalkeepers_count || 0;

    if (actualPlayers !== storedPlayers || actualGoalkeepers !== storedGoalkeepers) {
      console.log(`\n[ISSUE] Jogo ${gameId} (${game.date}):`);
      console.log(`  players_count: ${storedPlayers} -> ${actualPlayers}`);
      console.log(`  goalkeepers_count: ${storedGoalkeepers} -> ${actualGoalkeepers}`);

      // Corrigir
      await gameDoc.ref.update({
        players_count: actualPlayers,
        goalkeepers_count: actualGoalkeepers
      });
      console.log(`  [FIXED]`);
      issuesFound++;
    }
  }

  console.log(`\nResultado: ${issuesFound} jogos corrigidos`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('========================================');
  console.log('MIGRACAO FIRESTORE - Futeba dos Parcas');
  console.log('========================================');

  try {
    await migrateConfirmations();
    await migrateStatistics();
    await validateGameCounters();

    console.log('\n========================================');
    console.log('MIGRACAO CONCLUIDA COM SUCESSO!');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n[ERRO] Migracao falhou:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
