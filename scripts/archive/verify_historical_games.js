/**
 * Script para verificar os jogos históricos criados no Firebase
 *
 * Verifica:
 * 1. Contagem de jogos finalizados
 * 2. Amostra de jogos com scores e datas
 * 3. Confirmações com estatísticas
 * 4. Estatísticas globais atualizadas
 * 5. Logs de XP criados
 *
 * Uso: node scripts/verify_historical_games.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Função auxiliar para formatar Timestamp
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate();
  return date.toLocaleString('pt-BR');
}

/**
 * Verifica jogos finalizados
 */
async function verifyFinishedGames() {
  console.log('\n📋 VERIFICANDO JOGOS FINALIZADOS...\n');

  const snapshot = await db.collection('games')
    .where('status', '==', 'FINISHED')
    .orderBy('dateTime', 'desc')
    .limit(10)
    .get();

  console.log(`✅ Total de jogos FINALIZADOS encontrados (primeiros 10): ${snapshot.size}\n`);

  if (snapshot.empty) {
    console.log('⚠️  Nenhum jogo finalizado encontrado!\n');
    return [];
  }

  const games = [];
  snapshot.forEach(doc => {
    const game = doc.data();
    games.push(game);
    console.log(`🏆 ${game.name || 'Sem nome'}`);
    console.log(`   ID: ${game.id}`);
    console.log(`   Data: ${game.date} às ${game.time}`);
    console.log(`   Status: ${game.status}`);
    console.log(`   Placar: Time 1 ${game.team1Score} x ${game.team2Score} Time 2`);
    console.log(`   Local: ${game.locationName || 'N/A'}`);
    console.log(`   Grupo: ${game.groupId || 'N/A'}`);
    console.log('');
  });

  return games;
}

/**
 * Verifica confirmações com estatísticas
 */
async function verifyConfirmations(gameIds) {
  console.log('\n📋 VERIFICANDO CONFIRMAÇÕES COM ESTATÍSTICAS...\n');

  let totalConfirmations = 0;
  let confirmationsWithStats = 0;

  for (const gameId of gameIds.slice(0, 5)) { // Verificar primeiros 5 jogos
    const snapshot = await db.collection('confirmations')
      .where('gameId', '==', gameId)
      .get();

    console.log(`🎮 Jogo: ${gameId}`);
    console.log(`   Confirmações: ${snapshot.size}`);

    snapshot.forEach(doc => {
      const confirmation = doc.data();
      totalConfirmations++;

      const hasStats = confirmation.goals > 0 ||
                      confirmation.assists > 0 ||
                      confirmation.mvp > 0 ||
                      confirmation.yellowCards > 0 ||
                      confirmation.redCard > 0;

      if (hasStats) {
        confirmationsWithStats++;
        console.log(`   ✅ ${confirmation.userName || confirmation.userId}`);
        console.log(`      Time: ${confirmation.team}`);
        console.log(`      Gols: ${confirmation.goals}, Assistências: ${confirmation.assists}`);
        console.log(`      MVP: ${confirmation.mvp > 0 ? 'SIM' : 'não'}`);
        console.log(`      Cartões: ${confirmation.yellowCards} amarelos, ${confirmation.redCard} vermelhos`);
      }
    });
    console.log('');
  }

  console.log(`\n📊 RESUMO DAS CONFIRMAÇÕES:`);
  console.log(`   Total de confirmações verificadas: ${totalConfirmations}`);
  console.log(`   Confirmações com estatísticas: ${confirmationsWithStats}`);
  console.log(`   Percentual com stats: ${totalConfirmations > 0 ? ((confirmationsWithStats / totalConfirmations) * 100).toFixed(1) : 0}%\n`);
}

/**
 * Verifica estatísticas globais dos jogadores
 */
async function verifyStatistics() {
  console.log('\n📋 VERIFICANDO ESTATÍSTICAS GLOBAIS...\n');

  const userIds = [
    '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2', // Ricardo
    'EN2fwT9y6ndVyKETQthCDg83DSL2', // Rafael
    'FOlvyYHcZWPNqTGHkbSytMUwIAz1', // Renan Admin
    'LmclkYXROATUAvg4Ah0ZXcgcRCF2'  // Tech Field Owner
  ];

  for (const userId of userIds) {
    const doc = await db.collection('statistics').doc(userId).get();

    if (doc.exists) {
      const stats = doc.data();
      console.log(`👤 Usuário: ${userId}`);
      console.log(`   Jogos totais: ${stats.totalGames || 0}`);
      console.log(`   Gols totais: ${stats.totalGoals || 0}`);
      console.log(`   Assistências totais: ${stats.totalAssists || 0}`);
      console.log(`   Cartões amarelos: ${stats.totalYellowCards || 0}`);
      console.log(`   Cartões vermelhos: ${stats.totalRedCards || 0}`);
      console.log(`   MVP: ${stats.bestPlayerCount || 0}`);
      console.log(`   Última atualização: ${formatTimestamp(stats.updatedAt)}`);
      console.log('');
    } else {
      console.log(`⚠️  Usuário ${userId} não possui estatísticas!\n`);
    }
  }
}

/**
 * Verifica logs de XP
 */
async function verifyXPLogs() {
  console.log('\n📋 VERIFICANDO LOGS DE XP...\n');

  const snapshot = await db.collection('xp_logs')
    .where('source', '==', 'GAME_FINISHED')
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  console.log(`✅ Total de logs de XP por jogos finalizados (primeiros 20): ${snapshot.size}\n`);

  if (snapshot.empty) {
    console.log('⚠️  Nenhum log de XP encontrado!\n');
    return;
  }

  const xpByUser = {};

  snapshot.forEach(doc => {
    const log = doc.data();
    if (!xpByUser[log.userId]) {
      xpByUser[log.userId] = { count: 0, total: 0 };
    }
    xpByUser[log.userId].count++;
    xpByUser[log.userId].total += log.amount;
  });

  console.log('📊 XP POR USUÁRIO (GAME_FINISHED):');
  for (const [userId, data] of Object.entries(xpByUser)) {
    console.log(`   ${userId}:`);
    console.log(`      Entradas: ${data.count}`);
    console.log(`      XP Total: ${data.total}`);
    console.log(`      Média por jogo: ${data.total > 0 ? (data.total / data.count).toFixed(1) : 0}`);
  }
  console.log('');

  // Mostrar alguns exemplos
  console.log('📝 EXEMPLOS DE LOGS DE XP:');
  let count = 0;
  snapshot.forEach(doc => {
    if (count < 5) {
      const log = doc.data();
      console.log(`   ${log.amount} XP - ${log.description}`);
      console.log(`      Usuário: ${log.userId}`);
      console.log(`      Data: ${formatTimestamp(log.createdAt)}`);
      console.log('');
      count++;
    }
  });
}

/**
 * Conta todos os jogos finalizados (sem limite)
 */
async function countAllFinishedGames() {
  console.log('\n📋 CONTANDO TOTAL DE JOGOS FINALIZADOS...\n');

  const snapshot = await db.collection('games')
    .where('status', '==', 'FINISHED')
    .get();

  console.log(`✅ TOTAL DE JOGOS FINALIZADOS NO BANCO: ${snapshot.size}\n`);

  return snapshot.size;
}

/**
 * Main
 */
async function main() {
  try {
    console.log('='.repeat(60));
    console.log('VERIFICAÇÃO DE DADOS HISTÓRICOS - FUTEBA DOS PARÇAS');
    console.log('='.repeat(60));

    // 1. Contar total de jogos finalizados
    const totalCount = await countAllFinishedGames();

    // 2. Listar jogos finalizados
    const games = await verifyFinishedGames();

    // 3. Verificar confirmações
    const gameIds = games.map(g => g.id);
    if (gameIds.length > 0) {
      await verifyConfirmations(gameIds);
    }

    // 4. Verificar estatísticas globais
    await verifyStatistics();

    // 5. Verificar logs de XP
    await verifyXPLogs();

    console.log('='.repeat(60));
    console.log('✅ VERIFICAÇÃO CONCLUÍDA!');
    console.log('='.repeat(60));
    console.log('\n📊 RESUMO FINAL:');
    console.log(`   Total de jogos finalizados: ${totalCount}`);
    console.log(`   Jogos verificados: ${games.length}`);
    console.log(`   IDs dos jogos verificados: ${gameIds.slice(0, 3).join(', ')}${gameIds.length > 3 ? '...' : ''}\n`);

  } catch (error) {
    console.error('❌ Erro durante verificação:', error);
  } finally {
    process.exit(0);
  }
}

// Executar
main();
