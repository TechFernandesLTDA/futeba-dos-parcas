/**
 * Teste de atualização de perfil de usuário
 * Testa se os campos de perfil expandidos estão funcionando corretamente
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Inicializar Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'futebadosparcas'
});

const db = admin.firestore();

// ID do usuário para teste
const testUserId = '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2';

async function testProfileUpdate() {
  console.log('='.repeat(60));
  console.log('TESTE DE ATUALIZAÇÃO DE PERFIL');
  console.log('='.repeat(60));
  console.log(`\n📋 Testando usuário ID: ${testUserId}\n`);

  try {
    // STEP 1: Buscar documento atual
    console.log('STEP 1: Buscando documento do usuário...');
    const userDoc = await db.collection('users').doc(testUserId).get();

    if (!userDoc.exists) {
      console.error('❌ Usuário não encontrado!');
      return;
    }

    const currentData = userDoc.data();
    console.log('✅ Usuário encontrado\n');
    console.log('📄 DADOS ATUAIS:');
    console.log('-'.repeat(60));
    console.log(`Nome: ${currentData.name || 'N/A'}`);
    console.log(`Email: ${currentData.email || 'N/A'}`);
    console.log(`Data de Nascimento: ${currentData.birth_date || 'N/A'}`);
    console.log(`Gênero: ${currentData.gender || 'N/A'}`);
    console.log(`Altura (cm): ${currentData.height_cm || 'N/A'}`);
    console.log(`Peso (kg): ${currentData.weight_kg || 'N/A'}`);
    console.log(`Pé Dominante: ${currentData.dominant_foot || 'N/A'}`);
    console.log(`Posição Primária: ${currentData.primary_position || 'N/A'}`);
    console.log(`Posição Secundária: ${currentData.secondary_position || 'N/A'}`);
    console.log(`Estilo de Jogo: ${currentData.play_style || 'N/A'}`);
    console.log(`Anos de Experiência: ${currentData.experience_years || 'N/A'}`);
    console.log('-'.repeat(60));

    // STEP 2: Verificar campos obrigatórios
    console.log('\nSTEP 2: Verificando campos de perfil...');
    const profileFields = [
      'birth_date',
      'gender',
      'height_cm',
      'weight_kg',
      'dominant_foot',
      'primary_position',
      'secondary_position',
      'play_style',
      'experience_years'
    ];

    let missingFields = [];
    profileFields.forEach(field => {
      if (currentData[field] === undefined || currentData[field] === null) {
        missingFields.push(field);
      }
    });

    if (missingFields.length > 0) {
      console.log(`⚠️  Campos faltando: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ Todos os campos de perfil estão presentes!');
    }

    // STEP 3: Testar atualização
    console.log('\nSTEP 3: Testando atualização de perfil...');
    console.log('-'.repeat(60));

    // Dados de teste para atualização
    const testUpdate = {
      birth_date: currentData.birth_date || '1990-05-15',
      gender: currentData.gender || 'masculino',
      height_cm: currentData.height_cm || 175,
      weight_kg: currentData.weight_kg || 70,
      dominant_foot: currentData.dominant_foot || 'direito',
      primary_position: currentData.primary_position || 'meia',
      secondary_position: currentData.secondary_position || 'atacante',
      play_style: currentData.play_style || 'posicional',
      experience_years: currentData.experience_years || 5,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // Se já tem dados, modificamos ligeiramente para testar
    if (missingFields.length === 0) {
      testUpdate.height_cm = currentData.height_cm === 175 ? 176 : 175;
      testUpdate.weight_kg = currentData.weight_kg === 70 ? 71 : 70;
      console.log('📝 Modificando campos existentes...');
    } else {
      console.log('📝 Preenchendo campos faltantes...');
    }

    console.log('Dados para atualização:');
    console.log(JSON.stringify(testUpdate, null, 2));
    console.log('-'.repeat(60));

    // Realizar update
    await db.collection('users').doc(testUserId).update(testUpdate);
    console.log('✅ Atualização enviada com sucesso!\n');

    // STEP 4: Verificar atualização
    console.log('STEP 4: Verificando se atualização foi persistida...');
    console.log('-'.repeat(60));

    // Pequena pausa para garantir consistência
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedDoc = await db.collection('users').doc(testUserId).get();
    const updatedData = updatedDoc.data();

    let updateSuccess = true;
    let failedFields = [];

    Object.keys(testUpdate).forEach(key => {
      if (key === 'updated_at') return; // Skip timestamp

      const expected = testUpdate[key];
      const actual = updatedData[key];

      if (expected !== actual) {
        updateSuccess = false;
        failedFields.push({
          field: key,
          expected,
          actual
        });
      }
    });

    if (updateSuccess) {
      console.log('✅ Todos os campos foram atualizados corretamente!\n');
      console.log('📄 DADOS ATUALIZADOS:');
      console.log('-'.repeat(60));
      console.log(`Data de Nascimento: ${updatedData.birth_date}`);
      console.log(`Gênero: ${updatedData.gender}`);
      console.log(`Altura (cm): ${updatedData.height_cm}`);
      console.log(`Peso (kg): ${updatedData.weight_kg}`);
      console.log(`Pé Dominante: ${updatedData.dominant_foot}`);
      console.log(`Posição Primária: ${updatedData.primary_position}`);
      console.log(`Posição Secundária: ${updatedData.secondary_position}`);
      console.log(`Estilo de Jogo: ${updatedData.play_style}`);
      console.log(`Anos de Experiência: ${updatedData.experience_years}`);
      console.log('-'.repeat(60));
      console.log(`\n✅ Timestamp de atualização: ${updatedData.updated_at?.toDate()}`);
    } else {
      console.log('❌ Alguns campos não foram atualizados corretamente:\n');
      failedFields.forEach(({ field, expected, actual }) => {
        console.log(`  ${field}:`);
        console.log(`    Esperado: ${expected}`);
        console.log(`    Atual: ${actual}`);
      });
    }

    // STEP 5: Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('RESUMO DO TESTE');
    console.log('='.repeat(60));
    console.log(`✅ Usuário encontrado: SIM`);
    console.log(`✅ Campos de perfil presentes: ${missingFields.length === 0 ? 'SIM' : 'NÃO (' + missingFields.length + ' faltando)'}`);
    console.log(`✅ Atualização bem-sucedida: ${updateSuccess ? 'SIM' : 'NÃO'}`);
    console.log('='.repeat(60));

    if (updateSuccess && missingFields.length === 0) {
      console.log('\n🎉 RESULTADO: SUCESSO! A funcionalidade de edição de perfil está funcionando corretamente.');
      console.log('📱 O app Android deve conseguir atualizar todos os campos do perfil.\n');
    } else if (!updateSuccess) {
      console.log('\n⚠️  RESULTADO: PARCIAL. A atualização teve problemas. Verifique os logs acima.\n');
    } else {
      console.log('\n⚠️  RESULTADO: PARCIAL. Alguns campos estavam faltando, mas foram preenchidos.\n');
    }

  } catch (error) {
    console.error('\n❌ ERRO durante o teste:');
    console.error(error);
    console.error('\nDetalhes do erro:');
    console.error('- Código:', error.code);
    console.error('- Mensagem:', error.message);
    console.error('- Stack:', error.stack);
  }
}

// Executar teste
testProfileUpdate()
  .then(() => {
    console.log('\n✨ Teste concluído.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha fatal no teste:', error);
    process.exit(1);
  });
