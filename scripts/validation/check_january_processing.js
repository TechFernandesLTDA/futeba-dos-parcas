/**
 * Verifica se os jogos de Janeiro foram processados
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkJanuaryProcessing() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('VERIFICANDO PROCESSAMENTO - JANEIRO 2026');
  console.log('════════════════════════════════════════════════════════\n');

  // Buscar todos os jogos de seed
  const allSeedGames = await db.collection('games')
    .where('name', '==', 'Pelada dos Parças')
    .get();

  // Filtrar por Janeiro
  const januaryGames = [];
  let processed = 0;
  let pending = 0;

  allSeedGames.forEach(doc => {
    const game = doc.data();
    if (game.date && game.date.startsWith('2026-01')) {
      januaryGames.push({ id: doc.id, ...game });
      if (game.xp_processed) {
        processed++;
      } else {
        pending++;
        console.log(`  ⏳ ${doc.id} (${game.date}) - PENDENTE`);
      }
    }
  });

  console.log(`\nTotal de jogos em Janeiro: ${januaryGames.length}`);
  console.log(`  ✅ Processados: ${processed}`);
  console.log(`  ⏳ Pendentes: ${pending}\n`);

  if (pending > 0) {
    console.log('⚠️  Alguns jogos ainda não foram processados.');
    console.log('   Aguarde mais alguns segundos e execute novamente.\n');
  } else {
    console.log('✅ Todos os jogos de Janeiro foram processados!\n');

    // Verificar season participation
    console.log('════════════════════════════════════════════════════════');
    console.log('SEASON DE JANEIRO');
    console.log('════════════════════════════════════════════════════════\n');

    const seasonParts = await db.collection('season_participation')
      .where('season_id', '==', 'monthly_2026_01')
      .get();

    console.log(`Participantes: ${seasonParts.size}\n`);

    if (seasonParts.size > 0) {
      const participants = [];

      for (const partDoc of seasonParts.docs) {
        const part = partDoc.data();
        const userDoc = await db.collection('users').doc(part.user_id).get();
        const userName = userDoc.exists ? userDoc.data().name : 'Desconhecido';

        participants.push({
          name: userName,
          points: part.points || 0,
          games: part.games_played || 0,
          wins: part.wins || 0,
          goals: part.goals_scored || 0
        });
      }

      participants.sort((a, b) => b.points - a.points);

      participants.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        console.log(`${medal} ${i + 1}º ${p.name}`);
        console.log(`   ${p.points} pts | ${p.games} jogos | ${p.wins} vitórias | ${p.goals} gols\n`);
      });
    } else {
      console.log('⚠️  Season sem participantes. Execute populate_january_season.js\n');
    }
  }

  process.exit(0);
}

checkJanuaryProcessing();
