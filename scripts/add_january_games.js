/**
 * Adiciona mais jogos em Janeiro 2026
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addJanuaryGames() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     ADICIONANDO JOGOS EM JANEIRO 2026                    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // 1. Buscar usuários
  const usersSnapshot = await db.collection('users').limit(4).get();
  if (usersSnapshot.size < 4) {
    console.log('❌ Menos de 4 usuários encontrados!\n');
    process.exit(1);
  }

  const users = usersSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
  console.log(`✓ Usuários: ${users.map(u => u.name).join(', ')}\n`);

  // 2. Definir datas em Janeiro 2026
  const januaryDates = [
    '2026-01-05', // domingo
    '2026-01-08', // quinta
    '2026-01-11', // domingo
    '2026-01-15', // quinta
    '2026-01-18', // domingo
    '2026-01-22', // quinta
    '2026-01-25', // domingo
    '2026-01-29'  // quinta
  ];

  console.log(`Criando ${januaryDates.length} jogos...\n`);

  const GAME_LOCATION = "Arena Fernandes";
  const GAME_NAME = "Pelada dos Parças";

  let gameIndex = 28; // Continue da numeração anterior
  const createdGameIds = [];

  for (const dateStr of januaryDates) {
    const gameId = `seed_game_${gameIndex}`;
    const gameDate = new Date(dateStr + 'T21:00:00-03:00');

    const team1Users = [users[0], users[1]];
    const team2Users = [users[2], users[3]];
    const team1Id = `team_${gameId}_1`;
    const team2Id = `team_${gameId}_2`;

    // Placar aleatório
    let score1 = Math.floor(Math.random() * 6);
    let score2 = Math.floor(Math.random() * 6);

    // Clean sheets ocasionais
    if (gameIndex % 5 === 0) score2 = 0;
    if (gameIndex % 7 === 0) score1 = 0;

    const allUsers = [...team1Users, ...team2Users];
    const mvp = allUsers[Math.floor(Math.random() * allUsers.length)];

    console.log(`${gameId} (${dateStr}): ${score1} x ${score2}`);

    // Criar jogo
    await db.collection('games').doc(gameId).set({
      id: gameId,
      name: GAME_NAME,
      location: GAME_LOCATION,
      date: dateStr,
      dateTime: admin.firestore.Timestamp.fromDate(gameDate),
      status: "SCHEDULED",
      owner_id: users[0].id,
      team1Name: "A",
      team2Name: "B",
      team1Score: 0,
      team2Score: 0,
      team1Id,
      team2Id,
      xp_processed: false,
      created_at: admin.firestore.Timestamp.now()
    });

    // Criar times
    await db.collection('teams').doc(team1Id).set({
      id: team1Id,
      game_id: gameId,
      name: "A",
      score: score1,
      playerIds: team1Users.map(u => u.id)
    });

    await db.collection('teams').doc(team2Id).set({
      id: team2Id,
      game_id: gameId,
      name: "B",
      score: score2,
      playerIds: team2Users.map(u => u.id)
    });

    // Criar confirmações
    for (let i = 0; i < allUsers.length; i++) {
      const u = allUsers[i];
      const isGoalkeeper = (i === 1 || i === 3);

      let goals = 0;
      if (gameIndex % 10 === 0 && i === 0) {
        goals = 4; // Hat-trick
      } else if (Math.random() > 0.6) {
        goals = Math.floor(Math.random() * 3);
      }

      await db.collection('confirmations').doc(`${gameId}_${u.id}`).set({
        game_id: gameId,
        user_id: u.id,
        status: "CONFIRMED",
        goals: goals,
        assists: Math.floor(Math.random() * 2),
        saves: isGoalkeeper ? Math.floor(Math.random() * 8) : 0,
        position: isGoalkeeper ? "GOALKEEPER" : "AHEAD",
        yellow_cards: 0,
        red_cards: 0,
        created_at: admin.firestore.Timestamp.fromDate(gameDate)
      });
    }

    // Live score
    await db.collection('live_scores').doc(gameId).set({
      gameId: gameId,
      team1Id,
      team2Id,
      team1Score: score1,
      team2Score: score2,
      events: []
    });

    createdGameIds.push({ id: gameId, score1, score2, mvpId: mvp.id });
    gameIndex++;
  }

  console.log(`\n✓ ${createdGameIds.length} jogos criados como SCHEDULED\n`);

  // 3. Aguardar e marcar como FINISHED para processar
  console.log('Aguardando 2s antes de marcar como FINISHED...\n');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Marcando jogos como FINISHED para processar XP...\n');

  for (const game of createdGameIds) {
    await db.collection('games').doc(game.id).update({
      status: "FINISHED",
      team1Score: game.score1,
      team2Score: game.score2,
      mvp_id: game.mvpId,
      xp_processed: false,
      updated_at: admin.firestore.Timestamp.now()
    });

    console.log(`  ✓ ${game.id} marcado como FINISHED`);
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          JOGOS DE JANEIRO CRIADOS COM SUCESSO!          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\n  Total de jogos criados: ${createdGameIds.length}`);
  console.log('  Status: FINISHED (aguardando processamento da Cloud Function)\n');
  console.log('  Aguarde ~30-60s para o processamento de XP ser concluído.\n');

  process.exit(0);
}

addJanuaryGames();
