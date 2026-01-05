/**
 * Script para verificar locations no Firestore
 */

const admin = require('firebase-admin');

// Usar a mesma instância do Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkLocations() {
  console.log('\n========================================');
  console.log('VERIFICAÇÃO DE LOCATIONS');
  console.log('========================================\n');

  try {
    // Buscar todas as locations
    const locationsSnapshot = await db.collection('locations').get();

    console.log(`Total de locations: ${locationsSnapshot.size}\n`);

    if (locationsSnapshot.empty) {
      console.log('Nenhuma location encontrada.\n');
      return;
    }

    locationsSnapshot.forEach(doc => {
      const location = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Nome: ${location.name}`);
      console.log(`Endereço: ${location.address || 'N/A'}`);
      console.log(`Owner ID: ${location.ownerId || 'N/A'}`);
      console.log(`Ativo: ${location.isActive}`);
      console.log(`Verificado: ${location.isVerified || false}`);
      console.log('---\n');
    });

    // Buscar campos (fields) da Arena Fernandes se existir
    const arenaSnapshot = await db.collection('locations')
      .where('name', '==', 'Arena Fernandes')
      .get();

    if (!arenaSnapshot.empty) {
      const arenaDoc = arenaSnapshot.docs[0];
      console.log('\n=== CAMPOS DA ARENA FERNANDES ===\n');

      const fieldsSnapshot = await db.collection('fields')
        .where('locationId', '==', arenaDoc.id)
        .get();

      console.log(`Total de campos: ${fieldsSnapshot.size}\n`);

      fieldsSnapshot.forEach(doc => {
        const field = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`Nome: ${field.name}`);
        console.log(`Tipo: ${field.type}`);
        console.log(`Ativo: ${field.isActive}`);
        console.log(`Preço/hora: R$ ${field.hourlyPrice || 0}`);
        console.log('---\n');
      });
    }

  } catch (error) {
    console.error('Erro ao consultar locations:', error);
  }

  console.log('========================================\n');
  process.exit(0);
}

checkLocations().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});
