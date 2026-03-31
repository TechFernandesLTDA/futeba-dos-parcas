/**
 * Popula dados da season de Janeiro 2026
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function populateJanuarySeason() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     POPULANDO SEASON DE JANEIRO 2026                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const seasonId = 'monthly_2026_01';

  try {
    // 1. Buscar jogos de Janeiro 2026
    console.log('📅 Buscando jogos de Janeiro 2026...\n');

    const jan2026Games = await db.collection('games')
      .where('name', '==', 'Pelada dos Parças')
      .get();

    const januaryGames = jan2026Games.docs.filter(doc => {
      const game = doc.data();
      return game.date && game.date.startsWith('2026-01');
    });

    console.log(`Jogos encontrados: ${januaryGames.length}\n`);

    if (januaryGames.length === 0) {
      console.log('❌ Nenhum jogo em Janeiro!\n');
      process.exit(1);
    }

    // 2. Para cada jogo, buscar os XP logs e atualizar season_participation
    const userStats = new Map();

    for (const gameDoc of januaryGames) {
      const gameId = gameDoc.id;
      const game = gameDoc.data();

      console.log(`Processando ${gameId} (${game.date})...`);

      // Buscar XP logs deste jogo
      const xpLogsSnapshot = await db.collection('xp_logs')
        .where('game_id', '==', gameId)
        .get();

      console.log(`  ${xpLogsSnapshot.size} jogadores\n`);

      xpLogsSnapshot.forEach(doc => {
        const log = doc.data();
        const userId = log.user_id;
        const result = log.game_result;
        const isMvp = log.was_mvp;

        if (!userStats.has(userId)) {
          userStats.set(userId, {
            points: 0,
            games_played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_scored: 0,
            assists: 0,
            mvp_count: 0
          });
        }

        const stats = userStats.get(userId);
        stats.games_played++;
        stats.goals_scored += log.goals || 0;
        stats.assists += log.assists || 0;

        if (result === 'WIN') {
          stats.wins++;
          stats.points += 3;
        } else if (result === 'DRAW') {
          stats.draws++;
          stats.points += 1;
        } else if (result === 'LOSS') {
          stats.losses++;
        }

        if (isMvp) {
          stats.mvp_count++;
        }
      });
    }

    // 3. Gravar season_participation
    console.log('════════════════════════════════════════════════════════');
    console.log('GRAVANDO SEASON_PARTICIPATION');
    console.log('════════════════════════════════════════════════════════\n');

    const batch = db.batch();
    let count = 0;

    for (const [userId, stats] of userStats) {
      const partId = `${seasonId}_${userId}`;
      const partRef = db.collection('season_participation').doc(partId);

      // Buscar nome do usuário
      const userDoc = await db.collection('users').doc(userId).get();
      const userName = userDoc.exists ? userDoc.data().name : userId;

      console.log(`${userName}:`);
      console.log(`  Jogos: ${stats.games_played}`);
      console.log(`  Pontos: ${stats.points}`);
      console.log(`  Vitórias: ${stats.wins}`);
      console.log(`  Gols: ${stats.goals_scored}\n`);

      batch.set(partRef, {
        user_id: userId,
        season_id: seasonId,
        points: stats.points,
        games_played: stats.games_played,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        goals_scored: stats.goals_scored,
        assists: stats.assists,
        mvp_count: stats.mvp_count,
        last_calculated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      count++;
    }

    await batch.commit();

    console.log('════════════════════════════════════════════════════════');
    console.log(`✅ ${count} participações criadas para ${seasonId}`);
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  }

  process.exit(0);
}

populateJanuarySeason();
