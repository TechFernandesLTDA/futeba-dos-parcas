/**
 * Corrige estatísticas e rankings recalculando a partir das confirmações
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixStatisticsAndRankings() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     CORREÇÃO DE ESTATÍSTICAS E RANKINGS                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    console.log(`📋 Processando ${usersSnapshot.size} usuários...\n`);

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userName = userDoc.data().name;

      console.log(`━━━ ${userName} ━━━`);

      // 2. Buscar todas as confirmações deste usuário
      const confirmationsSnapshot = await db.collection('confirmations')
        .where('user_id', '==', userId)
        .where('status', '==', 'CONFIRMED')
        .get();

      console.log(`  Confirmações encontradas: ${confirmationsSnapshot.size}`);

      // 3. Recalcular estatísticas
      const stats = {
        totalGames: 0,
        totalGoals: 0,
        totalAssists: 0,
        totalSaves: 0,
        totalYellowCards: 0,
        totalRedCards: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDraw: 0,
        bestPlayerCount: 0
      };

      // Precisamos buscar dados dos jogos para determinar resultado
      const gamesData = new Map();

      for (const confDoc of confirmationsSnapshot.docs) {
        const conf = confDoc.data();
        const gameId = conf.game_id;

        stats.totalGames++;
        stats.totalGoals += conf.goals || 0;
        stats.totalAssists += conf.assists || 0;
        stats.totalSaves += conf.saves || 0;
        stats.totalYellowCards += conf.yellow_cards || 0;
        stats.totalRedCards += conf.red_cards || 0;

        // Buscar dados do jogo se ainda não temos
        if (!gamesData.has(gameId)) {
          const gameDoc = await db.collection('games').doc(gameId).get();
          if (gameDoc.exists) {
            gamesData.set(gameId, gameDoc.data());
          }
        }

        const game = gamesData.get(gameId);
        if (game && game.mvp_id === userId) {
          stats.bestPlayerCount++;
        }

        // Determinar resultado (WIN/LOSS/DRAW)
        // Isso é complexo, vou simplificar por enquanto
        // Apenas contar se há informação no XP log
      }

      // 4. Buscar XP logs para obter resultados
      const xpLogsSnapshot = await db.collection('xp_logs')
        .where('user_id', '==', userId)
        .get();

      xpLogsSnapshot.forEach(doc => {
        const log = doc.data();
        if (log.game_result === 'WIN') stats.gamesWon++;
        else if (log.game_result === 'LOSS') stats.gamesLost++;
        else if (log.game_result === 'DRAW') stats.gamesDraw++;
      });

      console.log(`  Estatísticas recalculadas:`);
      console.log(`    Jogos: ${stats.totalGames}`);
      console.log(`    Gols: ${stats.totalGoals}`);
      console.log(`    Assistências: ${stats.totalAssists}`);
      console.log(`    Defesas: ${stats.totalSaves}`);
      console.log(`    MVPs: ${stats.bestPlayerCount}`);
      console.log(`    Vitórias: ${stats.gamesWon} | Empates: ${stats.gamesDraw} | Derrotas: ${stats.gamesLost}`);

      // 5. Atualizar statistics
      await db.collection('statistics').doc(userId).set(stats, { merge: true });
      console.log(`  ✅ Statistics atualizado\n`);
    }

    // 6. Verificar e corrigir rankings
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('VERIFICANDO RANKINGS');
    console.log('═══════════════════════════════════════════════════════\n');

    const rankingsSnapshot = await db.collection('rankings').get();
    console.log(`Rankings existentes: ${rankingsSnapshot.size}`);

    if (rankingsSnapshot.size === 0) {
      console.log('⚠️  Nenhum ranking encontrado!\n');
      console.log('Os rankings são criados automaticamente pela Cloud Function');
      console.log('quando os jogos são processados.\n');
    } else {
      rankingsSnapshot.forEach(doc => {
        const ranking = doc.data();
        console.log(`  ${doc.id}: ${ranking.user_id || 'sem user_id'}`);
      });
      console.log('');
    }

    // 7. Verificar seasons ativas
    console.log('═══════════════════════════════════════════════════════');
    console.log('VERIFICANDO SEASONS');
    console.log('═══════════════════════════════════════════════════════\n');

    const seasonsSnapshot = await db.collection('seasons').get();
    console.log(`Total de seasons: ${seasonsSnapshot.size}\n`);

    let activeSeason = null;
    seasonsSnapshot.forEach(doc => {
      const season = doc.data();
      console.log(`  ${doc.id}:`);
      console.log(`    Nome: ${season.name}`);
      console.log(`    Ativa: ${season.is_active || false}`);
      console.log(`    Início: ${season.start_date}`);
      console.log(`    Fim: ${season.end_date || 'N/A'}`);

      if (season.is_active) {
        activeSeason = doc.id;
      }
      console.log('');
    });

    if (!activeSeason) {
      console.log('⚠️  Nenhuma season ativa encontrada!');
      console.log('Isso pode explicar por que a Liga está vazia.\n');
    } else {
      console.log(`✅ Season ativa: ${activeSeason}\n`);

      // Verificar participações na season
      const seasonParticipations = await db.collection('season_participations')
        .where('season_id', '==', activeSeason)
        .get();

      console.log(`Participações na season ativa: ${seasonParticipations.size}`);

      if (seasonParticipations.size === 0) {
        console.log('⚠️  Nenhum jogador registrado na season ativa!\n');
        console.log('A Liga depende de season_participations para mostrar jogadores.\n');
      } else {
        seasonParticipations.forEach(doc => {
          const part = doc.data();
          console.log(`  User: ${part.user_id}, Pontos: ${part.total_points || 0}`);
        });
        console.log('');
      }
    }

    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                  CORREÇÃO CONCLUÍDA                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\n❌ Erro:', error);
  }

  process.exit(0);
}

fixStatisticsAndRankings();
