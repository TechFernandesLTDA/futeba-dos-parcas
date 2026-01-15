const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAdminRole() {
  try {
    console.log('🔍 Buscando usuário renankakinho69@gmail.com...\n');

    // Buscar por email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'renankakinho69@gmail.com')
      .get();

    if (usersSnapshot.empty) {
      console.log('❌ Usuário não encontrado no Firestore!');
      console.log('\n💡 Possíveis causas:');
      console.log('   1. Email está diferente no Firebase Auth');
      console.log('   2. Documento não foi criado corretamente');
      return;
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    console.log('✅ Usuário encontrado!');
    console.log('\n📄 Dados completos:');
    console.log(JSON.stringify(userData, null, 2));

    console.log('\n🔑 Campos críticos:');
    console.log(`   ID: ${userDoc.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Nome: ${userData.name}`);
    console.log(`   Role: ${userData.role || 'CAMPO NÃO EXISTE ❌'}`);

    if (userData.role === 'ADMIN') {
      console.log('\n✅ Usuário tem role ADMIN');
    } else if (userData.role === 'FIELD_OWNER') {
      console.log('\n⚠️  Usuário tem role FIELD_OWNER (não é ADMIN)');
    } else if (!userData.role) {
      console.log('\n❌ Campo "role" não existe no documento!');
      console.log('\n🔧 Corrigindo... Adicionando role ADMIN');

      await db.collection('users').doc(userDoc.id).update({
        role: 'ADMIN'
      });

      console.log('✅ Role ADMIN adicionado com sucesso!');
    } else {
      console.log(`\n⚠️  Role desconhecido: ${userData.role}`);
    }

    // Verificar também no Firebase Auth
    console.log('\n🔍 Verificando Firebase Auth...');
    const authUsers = await admin.auth().listUsers();
    const authUser = authUsers.users.find(u => u.email === 'renankakinho69@gmail.com');

    if (authUser) {
      console.log('✅ Usuário encontrado no Auth');
      console.log(`   UID: ${authUser.uid}`);
      console.log(`   Email verified: ${authUser.emailVerified}`);
      console.log(`   Custom claims:`, authUser.customClaims || 'Nenhum');
    } else {
      console.log('❌ Usuário NÃO encontrado no Firebase Auth');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    process.exit(0);
  }
}

checkAdminRole();
