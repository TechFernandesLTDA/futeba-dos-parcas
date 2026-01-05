/**
 * Validação Final - População de Dados dos Jogadores
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function validateFinal() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║        VALIDAÇÃO FINAL - POPULAÇÃO DE DADOS              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Usuários
    console.log('📋 USUÁRIOS\n');
    const usersSnapshot = await db.collection('users').get();

    const users = [];
    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      users.push({
        id: doc.id,
        name: user.name,
        xp: user.experience_points || 0,
        level: user.level || 0
      });
    }

    users.sort((a, b) => b.xp - a.xp);

    for (const user of users) {
      console.log(`   ${user.name}`);
      console.log(`     Level: ${user.level} | XP: ${user.xp.toLocaleString()}`);
    }
    console.log('');

    // 2. Jogos
    console.log('⚽ JOGOS PROCESSADOS\n');
    const allGames = await db.collection('games').get();
    const seedGames = await db.collection('games')
      .where('name', '==', 'Pelada dos Parças')
      .get();

    let processed = 0, unprocessed = 0;
    allGames.forEach(doc => {
      const game = doc.data();
      if (game.xp_processed) processed++;
      else unprocessed++;
    });

    console.log(`   Total de jogos: ${allGames.size}`);
    console.log(`   Jogos de seed: ${seedGames.size}`);
    console.log(`   Processados (XP): ${processed}`);
    console.log(`   Não processados: ${unprocessed}\n`);

    // 3. Badges
    console.log('🏆 BADGES CONQUISTADOS\n');
    const badgesSnapshot = await db.collection('user_badges').get();
    console.log(`   Total: ${badgesSnapshot.size}\n`);

    const badgesByUser = new Map();
    badgesSnapshot.forEach(doc => {
      const badge = doc.data();
      const userId = badge.user_id; // CORREÇÃO: usar user_id

      if (!badgesByUser.has(userId)) {
        badgesByUser.set(userId, []);
      }
      badgesByUser.get(userId).push(badge);
    });

    for (const user of users) {
      const badges = badgesByUser.get(user.id) || [];

      if (badges.length > 0) {
        console.log(`   ${user.name}: ${badges.length} badge(s)`);

        const badgeTypes = {};
        badges.forEach(b => {
          badgeTypes[b.badge_id] = (badgeTypes[b.badge_id] || 0) + b.count;
        });

        Object.entries(badgeTypes).forEach(([type, count]) => {
          console.log(`     - ${type}: ${count}x`);
        });
      } else {
        console.log(`   ${user.name}: Nenhum badge`);
      }
    }
    console.log('');

    // 4. XP Detalhado
    console.log('⭐ DETALHAMENTO DE XP\n');
    const xpSnapshot = await db.collection('xp_logs').get();

    const xpByUser = new Map();
    xpSnapshot.forEach(doc => {
      const log = doc.data();
      const userId = log.user_id; // CORREÇÃO: usar user_id

      if (!xpByUser.has(userId)) {
        xpByUser.set(userId, { total: 0, logs: 0 });
      }

      const data = xpByUser.get(userId);
      data.total += log.xp_earned || 0;
      data.logs++;
    });

    for (const user of users) {
      const xpData = xpByUser.get(user.id);
      if (xpData) {
        console.log(`   ${user.name}:`);
        console.log(`     XP Total: ${xpData.total.toLocaleString()}`);
        console.log(`     Eventos de XP: ${xpData.logs}`);
      } else {
        console.log(`   ${user.name}: Sem dados de XP`);
      }
    }
    console.log('');

    // 5. Estatísticas
    console.log('📊 ESTATÍSTICAS\n');
    const statsSnapshot = await db.collection('statistics').get();

    const statsMap = new Map();
    statsSnapshot.forEach(doc => {
      statsMap.set(doc.id, doc.data());
    });

    for (const user of users) {
      const stats = statsMap.get(user.id);
      if (stats) {
        console.log(`   ${user.name}:`);
        console.log(`     Jogos: ${stats.totalGames || 0} | Vitórias: ${stats.gamesWon || 0}`);
        console.log(`     Gols: ${stats.totalGoals || 0} | Assistências: ${stats.totalAssists || 0}`);
        console.log(`     Defesas: ${stats.totalSaves || 0} | MVPs: ${stats.bestPlayerCount || 0}`);
      }
    }
    console.log('');

    // 6. Resumo
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMO FINAL                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`   ✅ Jogadores: ${users.length}`);
    console.log(`   ✅ Jogos processados: ${processed}/${allGames.size}`);
    console.log(`   ✅ Badges atribuídos: ${badgesSnapshot.size}`);
    console.log(`   ✅ Logs de XP: ${xpSnapshot.size}`);
    console.log(`   ✅ Estatísticas: ${statsSnapshot.size}\n`);

    if (unprocessed === 0 && badgesSnapshot.size > 0 && xpSnapshot.size > 0) {
      console.log('   🎉 POPULAÇÃO DE DADOS CONCLUÍDA COM SUCESSO!\n');
    } else {
      console.log('   ⚠️  Atenção: Alguns dados podem estar incompletos\n');
    }

  } catch (error) {
    console.error('\n❌ Erro:', error);
  }

  process.exit(0);
}

validateFinal();
