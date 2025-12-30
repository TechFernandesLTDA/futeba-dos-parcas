/**
 * Script para resetar o Firestore - Remove TODOS os dados
 *
 * ATENCAO: Este script apaga todos os documentos de todas as colecoes!
 * Use apenas em ambiente de desenvolvimento/teste.
 *
 * Para executar:
 * 1. npm install firebase-admin
 * 2. Baixe a service account key do Firebase Console
 * 3. Salve como serviceAccountKey.json nesta pasta
 * 4. Execute: node reset_firestore.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Inicializar com service account
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Colecoes a serem limpas
const COLLECTIONS = [
  'games',
  'confirmations',
  'teams',
  'statistics',
  'player_stats',
  'live_scores',
  'game_events',
  'live_player_stats',
  'users' // Cuidado: isso remove usuarios tambem!
];

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(500);

  let totalDeleted = 0;

  while (true) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`  ${collectionPath}: ${totalDeleted} documentos deletados...`);
  }

  return totalDeleted;
}

async function resetDatabase() {
  console.log('\n========================================');
  console.log('RESET FIRESTORE - Futeba dos Parcas');
  console.log('========================================\n');

  console.log('Colecoes que serao APAGADAS:');
  COLLECTIONS.forEach(c => console.log(`  - ${c}`));
  console.log('\n');

  // Confirmacao
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise(resolve => {
    rl.question('ATENCAO: Isso apagara TODOS os dados. Continuar? (digite "RESET" para confirmar): ', resolve);
  });
  rl.close();

  if (answer !== 'RESET') {
    console.log('\nOperacao cancelada.');
    process.exit(0);
  }

  console.log('\nIniciando reset...\n');

  let grandTotal = 0;

  for (const collection of COLLECTIONS) {
    try {
      const deleted = await deleteCollection(collection);
      grandTotal += deleted;
      console.log(`[OK] ${collection}: ${deleted} documentos removidos\n`);
    } catch (error) {
      console.error(`[ERRO] ${collection}: ${error.message}\n`);
    }
  }

  console.log('========================================');
  console.log(`RESET CONCLUIDO! Total: ${grandTotal} documentos removidos`);
  console.log('========================================\n');

  process.exit(0);
}

resetDatabase().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
