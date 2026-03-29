const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function clearUserCache() {
  const userEmail = 'renankakinho69@gmail.com';

  try {
    console.log(`🔍 Verificando usuário ${userEmail}...`);

    const usersSnapshot = await db.collection('users')
      .where('email', '==', userEmail)
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    console.log('✅ Usuário encontrado!');
    console.log(`   ID: ${userDoc.id}`);
    console.log(`   Nome: ${userData.name}`);
    console.log(`   Role atual: ${userData.role || 'CAMPO NÃO EXISTE'}`);

    // Forçar atualização do documento adicionando timestamp
    // Isso força o app a recarregar do Firebase
    console.log('\n🔄 Forçando atualização do documento...');

    await db.collection('users').doc(userDoc.id).update({
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      // Garantir que role está presente
      role: userData.role || 'ADMIN'
    });

    console.log('✅ Documento atualizado com sucesso!');
    console.log('\n📱 PRÓXIMOS PASSOS:');
    console.log('   1. Feche o app completamente (force stop)');
    console.log('   2. Limpe o cache do app nas configurações do Android');
    console.log('   3. Abra o app novamente');
    console.log('   OU simplesmente faça logout e login novamente');

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

clearUserCache();
