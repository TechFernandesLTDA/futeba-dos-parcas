/**
 * List all users in Firestore to get userIds for diagnostic scripts
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listUsers() {
  console.log('=== LISTING USERS ===\n');

  try {
    const snapshot = await db.collection('users')
      .orderBy('name')
      .limit(10)
      .get();

    if (snapshot.empty) {
      console.log('No users found in collection.');
      return;
    }

    console.log(`Found ${snapshot.docs.length} users (showing first 10):\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ID'.padEnd(30) + 'Name'.padEnd(30) + 'Email');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    snapshot.forEach(doc => {
      const user = doc.data();
      const id = doc.id;
      const name = user.name || '(no name)';
      const email = user.email || '(no email)';
      console.log(`${id.padEnd(30)}${name.padEnd(30)}${email}`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nTo diagnose a specific user, run:');
    console.log('  node diagnose_user_update.js <userId>');

  } catch (error) {
    console.error('Error listing users:', error);
  } finally {
    process.exit(0);
  }
}

listUsers();
