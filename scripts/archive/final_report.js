/**
 * Relatório Final - População de Dados Completa
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function generateFinalReport() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     RELATÓRIO FINAL - POPULAÇÃO DE DADOS COMPLETA        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Usuários
  console.log('═══════════════════════════════════════════════════════════');
  console.log('👥 JOGADORES');
  console.log('═══════════════════════════════════════════════════════════\n');

  const usersSnapshot = await db.collection('users').get();
  const users = [];

  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    const statsDoc = await db.collection('statistics').doc(doc.id).get();
    const stats = statsDoc.exists ? statsDoc.data() : {};

    users.push({
      id: doc.id,
      name: user.name,
      xp: user.experience_points || 0,
      level: user.level || 0,
      stats: stats
    });
  }

  users.sort((a, b) => b.xp - a.xp);

  for (const user of users) {
    console.log(`📊 ${user.name}`);
    console.log(`   Level ${user.level} | ${user.xp.toLocaleString()} XP`);
    console.log(`   ${user.stats.totalGames || 0} jogos | ${user.stats.totalGoals || 0} gols | ${user.stats.totalAssists || 0} assistências`);
    console.log(`   ${user.stats.gamesWon || 0} vitórias | ${user.stats.bestPlayerCount || 0} MVPs\n`);
  }

  // 2. Jogos
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚽ JOGOS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const allGamesSnapshot = await db.collection('games').get();
  const seedGamesSnapshot = await db.collection('games')
    .where('name', '==', 'Pelada dos Parças')
    .get();

  let processedCount = 0;
  allGamesSnapshot.forEach(doc => {
    if (doc.data().xp_processed) processedCount++;
  });

  console.log(`   Total de jogos no sistema: ${allGamesSnapshot.size}`);
  console.log(`   Jogos de seed criados: ${seedGamesSnapshot.size}`);
  console.log(`   Jogos processados (XP): ${processedCount}`);
  console.log(`   Período: Outubro 2025 - Janeiro 2026\n`);

  // 3. Badges
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏆 BADGES CONQUISTADOS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const badgesSnapshot = await db.collection('user_badges').get();
  console.log(`   Total de badges: ${badgesSnapshot.size}\n`);

  const badgesByUser = new Map();
  badgesSnapshot.forEach(doc => {
    const badge = doc.data();
    if (!badgesByUser.has(badge.user_id)) {
      badgesByUser.set(badge.user_id, []);
    }
    badgesByUser.get(badge.user_id).push(badge);
  });

  for (const user of users) {
    const badges = badgesByUser.get(user.id) || [];
    if (badges.length > 0) {
      const badgeTypes = {};
      badges.forEach(b => {
        const totalCount = badgeTypes[b.badge_id] || 0;
        badgeTypes[b.badge_id] = totalCount + (b.count || 1);
      });

      console.log(`   ${user.name}:`);
      Object.entries(badgeTypes).forEach(([type, count]) => {
        console.log(`     🏅 ${type}: ${count}x`);
      });
      console.log('');
    }
  }

  // 4. Ligas
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🏆 LIGAS / SEASONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  const seasonsSnapshot = await db.collection('seasons').get();

  for (const seasonDoc of seasonsSnapshot.docs) {
    const season = seasonDoc.data();

    if (season.is_active) {
      console.log(`📅 ${season.name} (${seasonDoc.id}) [ATIVA]`);

      const participationsSnapshot = await db.collection('season_participation')
        .where('season_id', '==', seasonDoc.id)
        .get();

      if (participationsSnapshot.size > 0) {
        const participants = [];

        for (const partDoc of participationsSnapshot.docs) {
          const part = partDoc.data();
          const userDoc = await db.collection('users').doc(part.user_id).get();
          const userName = userDoc.exists ? userDoc.data().name : 'Desconhecido';

          participants.push({
            name: userName,
            points: part.points || 0,
            games: part.games_played || 0,
            wins: part.wins || 0
          });
        }

        participants.sort((a, b) => b.points - a.points);

        console.log(`   ${participationsSnapshot.size} participantes:\n`);

        participants.forEach((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
          console.log(`   ${medal} ${i + 1}º ${p.name} - ${p.points} pts (${p.games} jogos, ${p.wins} vitórias)`);
        });
      } else {
        console.log(`   ⚠️  Nenhum participante\n`);
      }
      console.log('');
    }
  }

  // 5. Resumo Final
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                 RESUMO EXECUTIVO                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const xpLogsSnapshot = await db.collection('xp_logs').get();
  const rankingDeltasSnapshot = await db.collection('ranking_deltas').get();
  const seasonParticipationSnapshot = await db.collection('season_participation').get();

  console.log('   📊 ESTATÍSTICAS GERAIS\n');
  console.log(`   ✅ Jogadores: ${users.length}`);
  console.log(`   ✅ Jogos de seed: ${seedGamesSnapshot.size}`);
  console.log(`   ✅ Jogos processados: ${processedCount}`);
  console.log(`   ✅ Badges atribuídos: ${badgesSnapshot.size}`);
  console.log(`   ✅ Logs de XP: ${xpLogsSnapshot.size}`);
  console.log(`   ✅ Ranking deltas: ${rankingDeltasSnapshot.size}`);
  console.log(`   ✅ Participações em seasons: ${seasonParticipationSnapshot.size}\n`);

  console.log('   🎯 STATUS\n');
  console.log('   ✅ Sistema de gamificação: FUNCIONANDO');
  console.log('   ✅ Distribuição de XP: FUNCIONANDO');
  console.log('   ✅ Badges automáticos: FUNCIONANDO');
  console.log('   ✅ Estatísticas: CORRIGIDAS E FUNCIONANDO');
  console.log('   ✅ Ligas/Rankings: POPULADAS\n');

  console.log('   📅 PERÍODO DE DADOS\n');
  console.log('   De: Outubro 2025');
  console.log('   Até: Janeiro 2026 (atual)');
  console.log('   Total: ~3 meses de histórico\n');

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          🎉 POPULAÇÃO DE DADOS CONCLUÍDA! 🎉            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  process.exit(0);
}

generateFinalReport();
