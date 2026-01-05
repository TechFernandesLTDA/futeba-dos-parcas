/**
 * Script para debugar badges e XP orphãos
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugBadgesXP() {
  console.log('\n════════════ DEBUG: BADGES ════════════\n');

  const badgesSnapshot = await db.collection('badges').limit(10).get();
  badgesSnapshot.forEach(doc => {
    const badge = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Type: ${badge.type}`);
    console.log(`  UserId: ${badge.userId}`);
    console.log(`  AwardedAt: ${badge.awardedAt?.toDate?.() || badge.awardedAt}`);
    console.log('');
  });

  console.log('════════════ DEBUG: XP LOGS ════════════\n');

  const xpSnapshot = await db.collection('xp_logs').limit(10).get();
  xpSnapshot.forEach(doc => {
    const xp = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  UserId: ${xp.userId}`);
    console.log(`  Amount: ${xp.amount}`);
    console.log(`  Reason: ${xp.reason}`);
    console.log(`  GameId: ${xp.gameId}`);
    console.log('');
  });

  console.log('════════════ USUÁRIOS ════════════\n');

  const usersSnapshot = await db.collection('users').get();
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Name: ${user.name}`);
    console.log('');
  });

  process.exit(0);
}

debugBadgesXP();
