/**
 * Adiciona campo 'id' em todos os user documents como fallback
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addIdField() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║     ADICIONANDO CAMPO ID AOS USERS (FALLBACK)            ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    const usersSnapshot = await db.collection('users').get();

    console.log(`Total de users: ${usersSnapshot.size}\n`);

    const batch = db.batch();
    let count = 0;

    usersSnapshot.forEach(doc => {
      const data = doc.data();

      // Só adicionar se não existir
      if (!data.id) {
        batch.update(doc.ref, { id: doc.id });
        console.log(`✅ ${data.name || doc.id} - adicionando campo id`);
        count++;
      } else {
        console.log(`⏭️  ${data.name || doc.id} - já tem campo id`);
      }
    });

    if (count > 0) {
      await batch.commit();
      console.log(`\n✅ ${count} users atualizados com campo id!`);
    } else {
      console.log('\n✅ Todos os users já têm campo id!');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }

  process.exit(0);
}

addIdField();
