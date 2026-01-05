/**
 * Examina os campos RAW dos documentos
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkRawData() {
  console.log('\n════════ XP LOGS (TODOS OS CAMPOS) ════════\n');

  const xpSnapshot = await db.collection('xp_logs').limit(3).get();
  xpSnapshot.forEach(doc => {
    console.log(`ID: ${doc.id}`);
    const data = doc.data();
    console.log('  Campos:', Object.keys(data));
    console.log('  Dados completos:', JSON.stringify(data, null, 2));
    console.log('');
  });

  console.log('\n════════ BADGES (TODOS OS CAMPOS) ════════\n');

  const badgesSnapshot = await db.collection('user_badges').limit(5).get();
  console.log(`Total user_badges: ${badgesSnapshot.size}\n`);

  badgesSnapshot.forEach(doc => {
    console.log(`ID: ${doc.id}`);
    const data = doc.data();
    console.log('  Campos:', Object.keys(data));
    console.log('  Dados:', JSON.stringify(data, null, 2));
    console.log('');
  });

  console.log('\n════════ VERIFICANDO COLLECTIONS ════════\n');

  const collections = ['xp_logs', 'user_badges', 'badges', 'statistics'];
  for (const coll of collections) {
    const snapshot = await db.collection(coll).limit(1).get();
    console.log(`${coll}: ${snapshot.size > 0 ? 'tem dados' : 'VAZIA'}`);
  }

  process.exit(0);
}

checkRawData();
