/**
 * Lista rápida de IDs de usuários para copiar/colar em scripts
 * Execute: node scripts/users_id_list.js
 */

const admin = require('firebase-admin');
const path = require('path');

if (admin.apps.length === 0) {
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function getQuickList() {
    const snapshot = await db.collection('users').get();

    console.log('// COPIE E COLE NO SEU SCRIPT:\n');
    console.log('const users = {');

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  '${doc.id}': '${data.name}',`);
    });

    console.log('};\n');

    console.log('// Array de IDs:');
    console.log('const userIds = [');
    snapshot.forEach(doc => {
        console.log(`  '${doc.id}',`);
    });
    console.log('];');

    console.log('\n// Mapeamento ID -> Email:');
    console.log('const usersByEmail = {');
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  '${data.email}': '${doc.id}',`);
    });
    console.log('};');
}

getQuickList()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
