/**
 * Script para verificar detalhes completos da Arena/Area Fernandes
 */

const admin = require('firebase-admin');

// Usar a mesma instância do Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkArenaFernandes() {
  console.log('\n========================================');
  console.log('VERIFICAÇÃO DETALHADA - ARENA FERNANDES');
  console.log('========================================\n');

  try {
    // Buscar todas as variações do nome
    const names = ['Arena Fernandes', 'Area Fernandes', 'ARENA FERNANDES', 'AREA FERNANDES'];

    for (const name of names) {
      const snapshot = await db.collection('locations')
        .where('name', '==', name)
        .get();

      if (!snapshot.empty) {
        snapshot.forEach(async doc => {
          const location = doc.data();
          console.log(`\n=== ENCONTRADO: ${name} ===`);
          console.log(`ID: ${doc.id}`);
          console.log('\nDADOS COMPLETOS:');
          console.log(JSON.stringify(location, null, 2));

          // Buscar campos desta location
          console.log('\n=== CAMPOS (FIELDS) ===');
          const fieldsSnapshot = await db.collection('fields')
            .where('locationId', '==', doc.id)
            .get();

          console.log(`Total de campos: ${fieldsSnapshot.size}\n`);

          if (fieldsSnapshot.size > 0) {
            fieldsSnapshot.forEach(fieldDoc => {
              const field = fieldDoc.data();
              console.log(`Campo ID: ${fieldDoc.id}`);
              console.log(`Nome: ${field.name}`);
              console.log(`Tipo: ${field.type}`);
              console.log(`Ativo: ${field.isActive}`);
              console.log(`Preço/hora: R$ ${field.hourlyPrice || 0}`);
              console.log('---\n');
            });
          } else {
            console.log('⚠️  NENHUM CAMPO CADASTRADO para esta location!\n');
          }

          // Buscar jogos desta location
          console.log('=== JOGOS (GAMES) ===');
          const gamesSnapshot = await db.collection('games')
            .where('locationId', '==', doc.id)
            .get();

          console.log(`Total de jogos: ${gamesSnapshot.size}\n`);

          if (gamesSnapshot.size > 0) {
            gamesSnapshot.forEach(gameDoc => {
              const game = gameDoc.data();
              console.log(`Jogo ID: ${gameDoc.id}`);
              console.log(`Data: ${game.date} ${game.time || ''}`);
              console.log(`Visibilidade: ${game.visibility}`);
              console.log(`Grupo ID: ${game.groupId || 'N/A'}`);
              console.log(`Status: ${game.status || 'N/A'}`);
              console.log('---\n');
            });
          } else {
            console.log('⚠️  NENHUM JOGO CADASTRADO para esta location!\n');
          }
        });
      }
    }

    // Verificar se há jogos sem locationId ou com locationId inválido
    console.log('\n=== VERIFICANDO JOGOS SEM LOCATION ===');
    const allGamesSnapshot = await db.collection('games').get();
    console.log(`Total geral de jogos no sistema: ${allGamesSnapshot.size}\n`);

  } catch (error) {
    console.error('Erro:', error);
  }

  console.log('\n========================================\n');
  process.exit(0);
}

checkArenaFernandes().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
