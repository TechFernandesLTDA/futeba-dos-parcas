/**
 * Investigação: Por que ricardo gonçalves tem apenas 2 jogos?
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function investigate() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('INVESTIGAÇÃO: ricardo gonçalves');
  console.log('════════════════════════════════════════════════════════\n');

  // 1. Buscar o ID do ricardo
  const usersSnapshot = await db.collection('users').get();
  let ricardoId = null;
  let allUsers = [];

  usersSnapshot.forEach(doc => {
    const user = doc.data();
    allUsers.push({ id: doc.id, name: user.name });
    if (user.name.toLowerCase().includes('ricardo')) {
      ricardoId = doc.id;
      console.log(`✓ Ricardo encontrado: ${doc.id}\n`);
    }
  });

  console.log('Todos os usuários:');
  allUsers.forEach(u => console.log(`  - ${u.name} (${u.id})`));
  console.log('');

  if (!ricardoId) {
    console.log('❌ ricardo gonçalves não encontrado!\n');
    process.exit(1);
  }

  // 2. Buscar confirmações do ricardo em TODOS os jogos
  console.log('════════════════════════════════════════════════════════');
  console.log('CONFIRMAÇÕES DO RICARDO (todos os jogos)');
  console.log('════════════════════════════════════════════════════════\n');

  const allConfirmations = await db.collection('confirmations')
    .where('user_id', '==', ricardoId)
    .get();

  console.log(`Total de confirmações: ${allConfirmations.size}\n`);

  allConfirmations.forEach(doc => {
    const conf = doc.data();
    console.log(`Game ID: ${conf.game_id}`);
    console.log(`  Status: ${conf.status}`);
    console.log(`  Goals: ${conf.goals}`);
    console.log('');
  });

  // 3. Buscar confirmações dos jogos de seed
  console.log('════════════════════════════════════════════════════════');
  console.log('CONFIRMAÇÕES NOS JOGOS DE SEED');
  console.log('════════════════════════════════════════════════════════\n');

  const seedGames = await db.collection('games')
    .where('name', '==', 'Pelada dos Parças')
    .get();

  console.log(`Total de jogos de seed: ${seedGames.size}\n`);

  let ricardoInSeeds = 0;
  let otherPlayersInSeeds = new Map();

  for (const gameDoc of seedGames.docs) {
    const gameId = gameDoc.id;
    const confirmations = await db.collection('confirmations')
      .where('game_id', '==', gameId)
      .get();

    let ricardoInThisGame = false;
    confirmations.forEach(confDoc => {
      const conf = confDoc.data();
      if (conf.user_id === ricardoId) {
        ricardoInThisGame = true;
      }

      // Contar outros jogadores
      if (!otherPlayersInSeeds.has(conf.user_id)) {
        otherPlayersInSeeds.set(conf.user_id, 0);
      }
      otherPlayersInSeeds.set(conf.user_id, otherPlayersInSeeds.get(conf.user_id) + 1);
    });

    if (ricardoInThisGame) {
      ricardoInSeeds++;
    }
  }

  console.log(`Ricardo participou de ${ricardoInSeeds} jogos de seed\n`);

  console.log('Participação de outros jogadores nos jogos de seed:');
  for (const [userId, count] of otherPlayersInSeeds) {
    const user = allUsers.find(u => u.id === userId);
    console.log(`  ${user ? user.name : userId}: ${count} jogos`);
  }
  console.log('');

  // 4. Verificar script de seed
  console.log('════════════════════════════════════════════════════════');
  console.log('ANÁLISE DO SCRIPT DE SEED');
  console.log('════════════════════════════════════════════════════════\n');

  console.log('Verificando se o ricardo está sendo usado no script...\n');

  // Pegar um jogo de seed e ver quem está
  const firstSeedGame = seedGames.docs[0];
  const firstGameConfs = await db.collection('confirmations')
    .where('game_id', '==', firstSeedGame.id)
    .get();

  console.log(`Jogadores no primeiro jogo de seed (${firstSeedGame.id}):`);
  firstGameConfs.forEach(doc => {
    const conf = doc.data();
    const user = allUsers.find(u => u.id === conf.user_id);
    console.log(`  - ${user ? user.name : conf.user_id}`);
  });
  console.log('');

  // 5. Verificar se ricardo está nos primeiros 4 usuários
  console.log('════════════════════════════════════════════════════════');
  console.log('ORDEM DOS USUÁRIOS NO FIRESTORE');
  console.log('════════════════════════════════════════════════════════\n');

  console.log('O script de seed pega os primeiros 4 usuários com limit(4).\n');
  console.log('Ordem atual:');

  const first4Users = await db.collection('users').limit(4).get();
  let position = 1;
  first4Users.forEach(doc => {
    const user = doc.data();
    const isRicardo = doc.id === ricardoId ? ' ← RICARDO' : '';
    console.log(`  ${position}. ${user.name} (${doc.id})${isRicardo}`);
    position++;
  });
  console.log('');

  console.log('════════════════════════════════════════════════════════');
  console.log('CONCLUSÃO');
  console.log('════════════════════════════════════════════════════════\n');

  if (ricardoInSeeds === 0) {
    console.log('❌ PROBLEMA IDENTIFICADO:');
    console.log('   Ricardo NÃO está participando dos jogos de seed!\n');
    console.log('💡 SOLUÇÃO:');
    console.log('   O script de seed precisa ser ajustado para incluir');
    console.log('   todos os 4 jogadores ou ricardo precisa estar nos');
    console.log('   primeiros 4 usuários retornados pela query.\n');
  } else if (ricardoInSeeds < 20) {
    console.log('⚠️  PROBLEMA PARCIAL:');
    console.log(`   Ricardo só participou de ${ricardoInSeeds}/${seedGames.size} jogos.\n`);
  } else {
    console.log('✅ Ricardo está participando normalmente dos jogos de seed.\n');
  }

  process.exit(0);
}

investigate();
