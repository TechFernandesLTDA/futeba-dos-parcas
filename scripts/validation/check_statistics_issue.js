/**
 * Verifica o problema nas estatísticas do ricardo
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkStats() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('VERIFICAÇÃO DE ESTATÍSTICAS');
  console.log('════════════════════════════════════════════════════════\n');

  const users = await db.collection('users').get();

  for (const userDoc of users.docs) {
    const user = userDoc.data();
    const userId = userDoc.id;

    console.log(`\n━━━ ${user.name} (${userId}) ━━━\n`);

    // 1. Dados do documento user
    console.log('Documento users:');
    console.log(`  XP: ${user.experience_points || 0}`);
    console.log(`  Level: ${user.level || 0}\n`);

    // 2. Statistics
    const statsDoc = await db.collection('statistics').doc(userId).get();
    if (statsDoc.exists) {
      const stats = statsDoc.data();
      console.log('Documento statistics:');
      console.log(`  Total Jogos: ${stats.totalGames || 0}`);
      console.log(`  Total Gols: ${stats.totalGoals || 0}`);
      console.log(`  Total Assistências: ${stats.totalAssists || 0}`);
      console.log(`  Total Defesas: ${stats.totalSaves || 0}`);
      console.log(`  Vitórias: ${stats.gamesWon || 0}`);
      console.log(`  MVPs: ${stats.bestPlayerCount || 0}`);
    } else {
      console.log('Documento statistics: NÃO EXISTE ❌');
    }
    console.log('');

    // 3. Confirmações
    const confirmations = await db.collection('confirmations')
      .where('user_id', '==', userId)
      .get();

    console.log(`Confirmações: ${confirmations.size}`);

    // Contar apenas nos jogos de seed
    let seedConfirmations = 0;
    for (const confDoc of confirmations.docs) {
      const conf = confDoc.data();
      if (conf.game_id.startsWith('seed_game_')) {
        seedConfirmations++;
      }
    }
    console.log(`  - Nos jogos de seed: ${seedConfirmations}`);
    console.log('');

    // 4. XP Logs
    const xpLogs = await db.collection('xp_logs')
      .where('user_id', '==', userId)
      .get();

    let totalXpFromLogs = 0;
    let seedXpLogs = 0;

    xpLogs.forEach(doc => {
      const log = doc.data();
      totalXpFromLogs += log.xp_earned || 0;
      if (log.game_id && log.game_id.startsWith('seed_game_')) {
        seedXpLogs++;
      }
    });

    console.log(`XP Logs: ${xpLogs.size}`);
    console.log(`  - Nos jogos de seed: ${seedXpLogs}`);
    console.log(`  - XP total calculado: ${totalXpFromLogs}\n`);

    // 5. Comparação
    const statsGames = statsDoc.exists ? (statsDoc.data().totalGames || 0) : 0;
    const actualConfirmations = confirmations.size;

    if (statsGames !== actualConfirmations) {
      console.log(`⚠️  DISCREPÂNCIA DETECTADA!`);
      console.log(`   Statistics diz: ${statsGames} jogos`);
      console.log(`   Confirmations tem: ${actualConfirmations} jogos`);
      console.log(`   Diferença: ${actualConfirmations - statsGames} jogos não contabilizados\n`);
    } else {
      console.log(`✅ Estatísticas consistentes\n`);
    }
  }

  process.exit(0);
}

checkStats();
