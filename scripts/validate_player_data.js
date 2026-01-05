/**
 * Script de Validação dos Dados dos Jogadores
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function validatePlayerData() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('     VALIDAÇÃO DE DADOS DOS JOGADORES');
  console.log('════════════════════════════════════════════════════════\n');

  try {
    // 1. Usuários
    console.log('1️⃣  USUÁRIOS\n');
    const usersSnapshot = await db.collection('users').get();
    console.log(`   Total: ${usersSnapshot.size}\n`);

    const users = [];
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      users.push({ id: doc.id, name: user.name });
      console.log(`   - ${user.name} (${doc.id})`);
    });
    console.log('');

    // 2. Jogos
    console.log('2️⃣  JOGOS (Pelada dos Parças)\n');
    const gamesSnapshot = await db.collection('games')
      .where('name', '==', 'Pelada dos Parças')
      .get();

    console.log(`   Total: ${gamesSnapshot.size}`);

    let finished = 0, scheduled = 0;
    gamesSnapshot.forEach(doc => {
      const game = doc.data();
      if (game.status === 'FINISHED') finished++;
      if (game.status === 'SCHEDULED') scheduled++;
    });

    console.log(`   Finalizados: ${finished}`);
    console.log(`   Agendados: ${scheduled}\n`);

    // 3. Badges
    console.log('3️⃣  BADGES\n');
    const badgesSnapshot = await db.collection('badges').get();
    console.log(`   Total: ${badgesSnapshot.size}\n`);

    const badgesByUser = new Map();
    badgesSnapshot.forEach(doc => {
      const badge = doc.data();
      if (!badgesByUser.has(badge.userId)) {
        badgesByUser.set(badge.userId, []);
      }
      badgesByUser.get(badge.userId).push(badge);
    });

    for (const user of users) {
      const badges = badgesByUser.get(user.id) || [];
      console.log(`   ${user.name}: ${badges.length} badges`);

      const types = {};
      badges.forEach(b => {
        types[b.type] = (types[b.type] || 0) + 1;
      });

      Object.entries(types).forEach(([type, count]) => {
        console.log(`     - ${type}: ${count}x`);
      });
    }
    console.log('');

    // 4. XP
    console.log('4️⃣  XP\n');
    const xpSnapshot = await db.collection('xp_logs').get();
    console.log(`   Total de logs: ${xpSnapshot.size}\n`);

    const xpByUser = new Map();
    xpSnapshot.forEach(doc => {
      const log = doc.data();
      if (!xpByUser.has(log.userId)) {
        xpByUser.set(log.userId, 0);
      }
      xpByUser.set(log.userId, xpByUser.get(log.userId) + (log.amount || 0));
    });

    for (const user of users) {
      const xp = xpByUser.get(user.id) || 0;
      console.log(`   ${user.name}: ${xp} XP`);
    }
    console.log('');

    // 5. Estatísticas
    console.log('5️⃣  ESTATÍSTICAS (Confirmações)\n');
    const confSnapshot = await db.collection('confirmations').get();
    console.log(`   Total: ${confSnapshot.size}\n`);

    const statsByUser = new Map();
    confSnapshot.forEach(doc => {
      const conf = doc.data();
      if (!statsByUser.has(conf.user_id)) {
        statsByUser.set(conf.user_id, {
          jogos: 0,
          gols: 0,
          assistencias: 0,
          defesas: 0
        });
      }
      const stats = statsByUser.get(conf.user_id);
      stats.jogos++;
      stats.gols += conf.goals || 0;
      stats.assistencias += conf.assists || 0;
      stats.defesas += conf.saves || 0;
    });

    for (const user of users) {
      const stats = statsByUser.get(user.id);
      if (stats) {
        console.log(`   ${user.name}:`);
        console.log(`     Jogos: ${stats.jogos}`);
        console.log(`     Gols: ${stats.gols}`);
        console.log(`     Assistências: ${stats.assistencias}`);
        console.log(`     Defesas: ${stats.defesas}`);
      }
    }
    console.log('');

    // Resumo
    console.log('════════════════════════════════════════════════════════');
    console.log('RESUMO');
    console.log('════════════════════════════════════════════════════════');
    console.log(`Jogadores: ${users.length}`);
    console.log(`Jogos: ${gamesSnapshot.size}`);
    console.log(`Badges: ${badgesSnapshot.size}`);
    console.log(`XP Logs: ${xpSnapshot.size}`);
    console.log(`Confirmações: ${confSnapshot.size}`);
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('Erro:', error);
  }

  process.exit(0);
}

validatePlayerData();
