const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const testUserId = 'test_user_' + Date.now();

async function testXpUpdateBlocked() {
  console.log('\n🧪 TESTE 1: Tentar atualizar XP diretamente (deve FALHAR)');
  
  try {
    await db.collection('users').doc(testUserId).set({
      display_name: 'Test User',
      experience_points: 100,
      level: 1,
      role: 'PLAYER'
    });
    
    await db.collection('users').doc(testUserId).update({
      experience_points: 999999,
      level: 10
    });
    
    console.log('❌ FALHOU: XP foi atualizado (REGRAS NÃO ESTÃO FUNCIONANDO!)');
    return false;
  } catch (error) {
    if (error.code === 7 || error.message.includes('PERMISSION_DENIED')) {
      console.log('✅ PASSOU: XP bloqueado corretamente');
      return true;
    }
    console.log('⚠️  ERRO INESPERADO:', error.code, error.message);
    return false;
  }
}

async function testProfileUpdateAllowed() {
  console.log('\n🧪 TESTE 2: Atualizar nome de usuário (deve FUNCIONAR)');
  
  try {
    await db.collection('users').doc(testUserId).update({
      display_name: 'Test User Updated',
      bio: 'Updated bio'
    });
    console.log('✅ PASSOU: Perfil atualizado corretamente');
    return true;
  } catch (error) {
    console.log('❌ FALHOU:', error.message);
    return false;
  }
}

async function cleanup() {
  try {
    await db.collection('users').doc(testUserId).delete();
    console.log('\n🧹 Cleanup: usuário de teste deletado');
  } catch (e) {
    console.log('⚠️  Erro no cleanup:', e.message);
  }
}

async function runAllTests() {
  console.log('===========================================');
  console.log('🔒 TESTE DE FIRESTORE SECURITY RULES');
  console.log('===========================================');
  
  const results = [];
  
  results.push(await testXpUpdateBlocked());
  results.push(await testProfileUpdateAllowed());
  
  await cleanup();
  
  console.log('\n===========================================');
  const passed = results.filter(r => r === true).length;
  const failed = results.filter(r => r === false).length;
  console.log(`📊 RESULTADO: ${passed} passaram, ${failed} falharam`);
  console.log('===========================================\n');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(console.error);
