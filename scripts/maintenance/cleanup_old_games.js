/**
 * Script para deletar jogos antigos que não possuem o campo 'visibility'
 * Mantém apenas jogos modernos com o sistema de visibilidade implementado
 *
 * Uso: node cleanup_old_games.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://futebadosparcas.firebaseio.com'
});

const db = admin.firestore();

async function cleanupOldGames() {
  console.log('🔍 Iniciando limpeza de jogos antigos...\n');

  try {
    // Buscar TODOS os jogos
    const gamesSnapshot = await db.collection('games').get();
    console.log(`📊 Total de jogos encontrados: ${gamesSnapshot.size}\n`);

    let oldGamesCount = 0;
    let modernGamesCount = 0;
    const gamesToDelete = [];

    // Identificar jogos antigos (sem campo visibility)
    gamesSnapshot.forEach(doc => {
      const game = doc.data();

      if (!game.visibility) {
        oldGamesCount++;
        gamesToDelete.push({
          id: doc.id,
          date: game.date || 'N/A',
          time: game.time || 'N/A',
          locationName: game.location_name || 'N/A',
          status: game.status || 'N/A',
          isPublic: game.is_public || false
        });
      } else {
        modernGamesCount++;
      }
    });

    console.log(`✅ Jogos modernos (com visibility): ${modernGamesCount}`);
    console.log(`❌ Jogos antigos (sem visibility): ${oldGamesCount}\n`);

    if (oldGamesCount === 0) {
      console.log('✨ Nenhum jogo antigo encontrado! Todos os jogos já estão no formato moderno.\n');
      process.exit(0);
    }

    // Mostrar jogos que serão deletados
    console.log('📋 Jogos que serão deletados:\n');
    gamesToDelete.slice(0, 10).forEach((game, index) => {
      console.log(`${index + 1}. ID: ${game.id}`);
      console.log(`   Data: ${game.date} ${game.time}`);
      console.log(`   Local: ${game.locationName}`);
      console.log(`   Status: ${game.status}`);
      console.log(`   isPublic: ${game.isPublic}\n`);
    });

    if (oldGamesCount > 10) {
      console.log(`   ... e mais ${oldGamesCount - 10} jogos\n`);
    }

    // Deletar em lotes (batch)
    console.log('🗑️  Iniciando deleção em lotes...\n');

    const batchSize = 500;
    let deletedCount = 0;
    let batchCount = 0;

    for (let i = 0; i < gamesToDelete.length; i += batchSize) {
      const batch = db.batch();
      const currentBatch = gamesToDelete.slice(i, i + batchSize);

      currentBatch.forEach(game => {
        const gameRef = db.collection('games').doc(game.id);
        batch.delete(gameRef);
      });

      await batch.commit();
      deletedCount += currentBatch.length;
      batchCount++;

      console.log(`✓ Lote ${batchCount} concluído: ${deletedCount}/${oldGamesCount} jogos deletados`);
    }

    console.log('\n✅ Limpeza concluída com sucesso!\n');
    console.log('📊 Resumo:');
    console.log(`   - Jogos deletados: ${deletedCount}`);
    console.log(`   - Jogos mantidos: ${modernGamesCount}`);
    console.log(`   - Lotes processados: ${batchCount}\n`);

    // Também deletar confirmações órfãs (de jogos deletados)
    console.log('🔍 Verificando confirmações órfãs...\n');

    const gameIds = gamesToDelete.map(g => g.id);
    const confirmationsToDelete = [];

    // Buscar confirmações em lotes (whereIn tem limite de 10)
    for (let i = 0; i < gameIds.length; i += 10) {
      const chunk = gameIds.slice(i, i + 10);
      const confirmationsSnapshot = await db.collection('confirmations')
        .where('game_id', 'in', chunk)
        .get();

      confirmationsSnapshot.forEach(doc => {
        confirmationsToDelete.push(doc.id);
      });
    }

    if (confirmationsToDelete.length > 0) {
      console.log(`📋 Encontradas ${confirmationsToDelete.length} confirmações órfãs`);
      console.log('🗑️  Deletando confirmações órfãs...\n');

      let confirmDeletedCount = 0;
      for (let i = 0; i < confirmationsToDelete.length; i += batchSize) {
        const batch = db.batch();
        const currentBatch = confirmationsToDelete.slice(i, i + batchSize);

        currentBatch.forEach(confirmId => {
          const confirmRef = db.collection('confirmations').doc(confirmId);
          batch.delete(confirmRef);
        });

        await batch.commit();
        confirmDeletedCount += currentBatch.length;
        console.log(`✓ ${confirmDeletedCount}/${confirmationsToDelete.length} confirmações deletadas`);
      }

      console.log(`\n✅ ${confirmDeletedCount} confirmações órfãs removidas\n`);
    } else {
      console.log('✨ Nenhuma confirmação órfã encontrada\n');
    }

    console.log('🎉 Processo de limpeza finalizado!\n');

  } catch (error) {
    console.error('❌ Erro durante a limpeza:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Executar
cleanupOldGames();
