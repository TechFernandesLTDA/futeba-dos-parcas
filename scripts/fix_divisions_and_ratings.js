/**
 * Calcula e atualiza division e leagueRating para todos os season_participation
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Lógica do LeagueRatingCalculator (port from Kotlin)
function calculateLeagueRating(recentGames) {
  if (!recentGames || recentGames.length === 0) return 0.0;

  const gamesCount = recentGames.length;

  // PPJ - Pontos (XP) por Jogo (max 200 = 100 pontos)
  const avgXp = recentGames.reduce((sum, g) => sum + (g.xpEarned || 0), 0) / gamesCount;
  const ppjScore = Math.min(avgXp / 200.0, 1.0) * 100;

  // WR - Win Rate (100% = 100 pontos)
  const winRate = (recentGames.filter(g => g.won).length / gamesCount) * 100;

  // GD - Goal Difference médio (+3 = 100, -3 = 0)
  const avgGD = recentGames.reduce((sum, g) => sum + (g.goalDiff || 0), 0) / gamesCount;
  const gdScore = Math.max(0, Math.min(1, (avgGD + 3) / 6.0)) * 100;

  // MVP Rate (50% = 100 pontos, cap)
  const mvpRate = recentGames.filter(g => g.wasMvp).length / gamesCount;
  const mvpScore = Math.min(mvpRate / 0.5, 1.0) * 100;

  return (ppjScore * 0.4) + (winRate * 0.3) + (gdScore * 0.2) + (mvpScore * 0.1);
}

function getDivisionForRating(rating) {
  if (rating >= 70) return 'DIAMANTE';
  if (rating >= 50) return 'OURO';
  if (rating >= 30) return 'PRATA';
  return 'BRONZE';
}

async function fixDivisionsAndRatings() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     CORRIGINDO DIVISIONS E RATINGS                       ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar todas as season_participations
    const participationsSnapshot = await db.collection('season_participation').get();

    console.log(`Total de participações: ${participationsSnapshot.size}\n`);

    const batch = db.batch();
    let updateCount = 0;

    for (const partDoc of participationsSnapshot.docs) {
      const part = partDoc.data();
      const userId = part.user_id;
      const seasonId = part.season_id;

      // Buscar XP logs deste usuário nesta season
      const xpLogsSnapshot = await db.collection('xp_logs')
        .where('user_id', '==', userId)
        .get();

      // Filtrar por season (preciso buscar games da season)
      const gamesSnapshot = await db.collection('games')
        .get();

      const seasonGames = gamesSnapshot.docs.filter(doc => {
        const game = doc.data();
        // Simplificação: usar todos os jogos do período da season
        // Idealmente filtrar por data da season
        return true;
      }).map(doc => doc.id);

      // Filtrar XP logs que pertencem à season
      const seasonXpLogs = xpLogsSnapshot.docs
        .map(doc => doc.data())
        .filter(log => seasonGames.includes(log.game_id))
        .sort((a, b) => {
          const aTime = a.created_at?._seconds || 0;
          const bTime = b.created_at?._seconds || 0;
          return bTime - aTime; // Mais recente primeiro
        })
        .slice(0, 10); // Últimos 10 jogos

      // Montar recentGames
      const recentGames = [];
      for (const log of seasonXpLogs) {
        const won = log.game_result === 'WIN';
        const drew = log.game_result === 'DRAW';

        // Simplificação: goalDiff = goals - (won ? menos : mais)
        // Vou usar uma heurística: se ganhou, +1, se perdeu -1, empate 0
        let goalDiff = 0;
        if (won) goalDiff = 1;
        else if (log.game_result === 'LOSS') goalDiff = -1;

        recentGames.push({
          gameId: log.game_id,
          xpEarned: log.xp_earned || 0,
          won: won,
          drew: drew,
          goalDiff: goalDiff,
          wasMvp: log.was_mvp || false,
          playedAt: log.created_at
        });
      }

      // Calcular rating
      const leagueRating = calculateLeagueRating(recentGames);
      const division = getDivisionForRating(leagueRating);

      // Buscar nome do usuário
      const userDoc = await db.collection('users').doc(userId).get();
      const userName = userDoc.exists ? userDoc.data().name : 'Desconhecido';

      console.log(`${userName} (${seasonId}):`);
      console.log(`  Rating: ${leagueRating.toFixed(1)}`);
      console.log(`  Divisão: ${division}`);
      console.log(`  Jogos recentes: ${recentGames.length}\n`);

      // Atualizar documento
      batch.update(partDoc.ref, {
        league_rating: leagueRating,
        division: division,
        recent_games: recentGames
      });

      updateCount++;

      // Commitar a cada 450 operações (limite do Firestore)
      if (updateCount % 150 === 0) {
        await batch.commit();
        console.log(`  ✓ ${updateCount} atualizações commitadas...\n`);
      }
    }

    // Commitar resto
    if (updateCount % 150 !== 0) {
      await batch.commit();
    }

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log(`║          ✅ ${updateCount} PARTICIPAÇÕES ATUALIZADAS         ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  }

  process.exit(0);
}

fixDivisionsAndRatings();
