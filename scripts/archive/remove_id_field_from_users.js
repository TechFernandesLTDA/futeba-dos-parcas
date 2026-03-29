/**
 * Remove campo 'id' dos user documents (conflito com @DocumentId)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeIdField() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     REMOVENDO CAMPO ID DOS USERS                         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    const usersSnapshot = await db.collection('users').get();

    console.log(`Total de users: ${usersSnapshot.size}\n`);

    const batch = db.batch();
    let count = 0;

    usersSnapshot.forEach(doc => {
      const data = doc.data();

      // Remover campo id se existir
      if (data.id !== undefined) {
        batch.update(doc.ref, { id: admin.firestore.FieldValue.delete() });
        console.log(`✅ ${data.name || doc.id} - removendo campo id`);
        count++;
      } else {
        console.log(`⏭️  ${data.name || doc.id} - sem campo id`);
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`\n✅ ${count} users tiveram o campo id removido!`);
    } else {
      console.log('\n✅ Nenhum user tinha campo id!');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }

  process.exit(0);
}

removeIdField();
