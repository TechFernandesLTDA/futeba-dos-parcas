/**
 * Verificação simplificada de logs de XP (sem ordenação)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkXPLogs() {
  console.log('\n📋 VERIFICANDO LOGS DE XP...\n');

  // Buscar sem ordenação para evitar índice
  const snapshot = await db.collection('xp_logs')
    .where('source', '==', 'GAME_FINISHED')
    .limit(50)
    .get();

  console.log(`✅ Total de logs de XP por jogos finalizados: ${snapshot.size}\n`);

  if (snapshot.empty) {
    console.log('⚠️  Nenhum log de XP encontrado!\n');
    return;
  }

  const xpByUser = {};

  snapshot.forEach(doc => {
    const log = doc.data();
    if (!xpByUser[log.userId]) {
      xpByUser[log.userId] = { count: 0, total: 0 };
    }
    xpByUser[log.userId].count++;
    xpByUser[log.userId].total += log.amount;
  });

  console.log('📊 XP POR USUÁRIO (GAME_FINISHED):');
  for (const [userId, data] of Object.entries(xpByUser)) {
    console.log(`   ${userId}:`);
    console.log(`      Entradas: ${data.count}`);
    console.log(`      XP Total: ${data.total}`);
    console.log(`      Média por jogo: ${data.total > 0 ? (data.total / data.count).toFixed(1) : 0}`);
  }
  console.log('');

  // Mostrar alguns exemplos
  console.log('📝 EXEMPLOS DE LOGS DE XP:');
  let count = 0;
  snapshot.forEach(doc => {
    if (count < 10) {
      const log = doc.data();
      const date = log.createdAt ? log.createdAt.toDate().toLocaleString('pt-BR') : 'N/A';
      console.log(`   ${log.amount} XP - ${log.description}`);
      console.log(`      Usuário: ${log.userId}`);
      console.log(`      Data: ${date}`);
      console.log('');
      count++;
    }
  });
}

async function main() {
  try {
    await checkXPLogs();
    console.log('✅ Verificação concluída!\n');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

main();
