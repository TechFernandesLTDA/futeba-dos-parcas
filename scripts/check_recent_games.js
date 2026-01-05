/**
 * Script para verificar jogos recentes no Firestore
 *
 * Para executar:
 * node check_recent_games.js
 */

const admin = require('firebase-admin');

// Inicializar com service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRecentGames() {
  console.log('\n========================================');
  console.log('VERIFICAÇÃO DE JOGOS RECENTES');
  console.log('========================================\n');

  try {
    // Buscar jogos recentes (últimos 10)
    const gamesSnapshot = await db.collection('games')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    if (gamesSnapshot.empty) {
      console.log('Nenhum jogo encontrado no banco de dados.\n');
      return;
    }

    console.log(`Total de jogos encontrados: ${gamesSnapshot.size}\n`);
    console.log('----------------------------------------\n');

    for (const doc of gamesSnapshot.docs) {
      const game = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Data criação: ${game.createdAt?.toDate?.() || game.createdAt}`);
      console.log(`Data/Hora: ${game.date} ${game.time || ''}`);
      console.log(`Location ID: ${game.locationId}`);
      console.log(`Visibilidade: ${game.visibility || 'N/A'}`);
      console.log(`Grupo ID: ${game.groupId || 'N/A'}`);
      console.log(`Criador: ${game.creatorId}`);
      console.log(`Status: ${game.status || 'N/A'}`);

      // Se tiver locationId, buscar nome do local
      if (game.locationId) {
        try {
          const locationDoc = await db.collection('locations').doc(game.locationId).get();
          if (locationDoc.exists) {
            const location = locationDoc.data();
            console.log(`Nome do Local: ${location.name}`);
          }
        } catch (err) {
          console.log(`Erro ao buscar location: ${err.message}`);
        }
      }

      console.log('----------------------------------------\n');
    }

    // Buscar especificamente jogos com "Arena Fernandes"
    console.log('\n=== BUSCANDO JOGOS NA "ARENA FERNANDES" ===\n');

    const locationsSnapshot = await db.collection('locations')
      .where('name', '==', 'Arena Fernandes')
      .get();

    if (!locationsSnapshot.empty) {
      const arenaDoc = locationsSnapshot.docs[0];
      console.log(`Arena Fernandes encontrada! ID: ${arenaDoc.id}\n`);

      const arenaGamesSnapshot = await db.collection('games')
        .where('locationId', '==', arenaDoc.id)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      console.log(`Jogos na Arena Fernandes: ${arenaGamesSnapshot.size}\n`);

      arenaGamesSnapshot.forEach(doc => {
        const game = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`Visibilidade: ${game.visibility}`);
        console.log(`Grupo ID: ${game.groupId || 'N/A'}`);
        console.log(`Data: ${game.date} ${game.time || ''}`);
        console.log(`Status: ${game.status || 'N/A'}`);
        console.log('---');
      });
    } else {
      console.log('Arena Fernandes não encontrada no banco de dados.\n');
    }

  } catch (error) {
    console.error('Erro ao consultar jogos:', error);
  }

  console.log('\n========================================\n');
  process.exit(0);
}

checkRecentGames().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
