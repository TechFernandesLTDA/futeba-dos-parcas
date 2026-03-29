/**
 * Script para inicializar campos faltantes dos usuários existentes
 *
 * Este script adiciona os 9 campos que estavam faltando nos documentos de usuário:
 * - birth_date
 * - gender
 * - height_cm
 * - weight_kg
 * - dominant_foot
 * - primary_position
 * - secondary_position
 * - play_style
 * - experience_years
 *
 * Uso: node scripts/init_user_profile_fields.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initUserFields() {
  console.log('='.repeat(60));
  console.log('INICIALIZANDO CAMPOS DE PERFIL DE USUÁRIO');
  console.log('='.repeat(60));

  try {
    // Buscar todos os usuários
    const usersSnap = await db.collection('users').get();

    if (usersSnap.empty) {
      console.log('Nenhum usuário encontrado.');
      return;
    }

    console.log(`\nEncontrados ${usersSnap.size} usuários.\n`);

    const fieldsToAdd = {
      birth_date: null,
      gender: null,
      height_cm: null,
      weight_kg: null,
      dominant_foot: null,
      primary_position: null,
      secondary_position: null,
      play_style: null,
      experience_years: null
    };

    let batch = db.batch();
    let operationCount = 0;
    const BATCH_SIZE = 450;

    for (const doc of usersSnap.docs) {
      const userId = doc.id;
      const userData = doc.data();

      // Verificar quais campos já existem
      const missingFields = [];
      for (const [field, value] of Object.entries(fieldsToAdd)) {
        if (!(field in userData)) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        console.log(`Usuário ${userData.name || userId}: adicionando ${missingFields.length} campos faltantes`);

        // Adicionar campos faltantes
        batch.update(doc.ref, fieldsToAdd);
        operationCount++;

        if (operationCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`Batch de ${operationCount} atualizações commitado.`);
          batch = db.batch();
          operationCount = 0;
        }
      } else {
        console.log(`Usuário ${userData.name || userId}: todos os campos já existem.`);
      }
    }

    // Commit final
    if (operationCount > 0) {
      await batch.commit();
      console.log(`\nBatch final de ${operationCount} atualizações commitado.`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ INICIALIZAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Erro durante inicialização:', error);
  } finally {
    process.exit(0);
  }
}

// Executar
initUserFields();
