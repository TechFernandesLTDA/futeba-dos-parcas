const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkSeasonFields() {
  const snap = await db.collection('season_participation')
    .where('season_id', '==', 'monthly_2026_01')
    .limit(1)
    .get();

  if (!snap.empty) {
    const data = snap.docs[0].data();
    console.log('Campos da season_participation:');
    console.log(JSON.stringify(data, null, 2));
  }

  process.exit(0);
}

checkSeasonFields();
