/**
 * Script para verificar se um usuário é admin no Firestore
 *
 * Uso: node scripts/check_admin_user.js
 *
 * Verifica se renankakinho69@gmail.com tem role=ADMIN
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase with service account
if (admin.apps.length === 0) {
    const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const EMAIL_TO_CHECK = 'renankakinho69@gmail.com';

async function checkAdminUser() {
    console.log('='.repeat(60));
    console.log('VERIFICACAO DE ADMIN - Futeba dos Parcas');
    console.log('='.repeat(60));
    console.log(`\nEmail procurado: ${EMAIL_TO_CHECK}\n`);

    try {
        // Buscar usuario pelo email
        const usersSnapshot = await db.collection('users')
            .where('email', '==', EMAIL_TO_CHECK)
            .get();

        if (usersSnapshot.empty) {
            console.log('❌ Usuario NAO encontrado com este email!');
            console.log('\nVerifique se:');
            console.log('1. O email esta correto');
            console.log('2. O usuario ja fez login no app');
            console.log('3. O campo "email" esta salvo no Firestore');
            return;
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();

        console.log('✅ Usuario encontrado!\n');
        console.log('-'.repeat(40));
        console.log('DADOS DO USUARIO:');
        console.log('-'.repeat(40));
        console.log(`ID:      ${userDoc.id}`);
        console.log(`Nome:    ${userData.name || 'N/A'}`);
        console.log(`Email:   ${userData.email || 'N/A'}`);
        console.log(`Role:    ${userData.role || 'PLAYER (default)'}`);
        console.log(`Criado:  ${userData.created_at?.toDate?.() || 'N/A'}`);
        console.log('-'.repeat(40));

        // Verificar se e admin
        const isAdmin = userData.role === 'ADMIN';

        console.log('\nRESULTADO:');
        if (isAdmin) {
            console.log('🛡️  CONFIRMADO: Usuario e ADMIN do sistema!');
            console.log('\nPermissoes de ADMIN:');
            console.log('- Gerenciar todos os usuarios');
            console.log('- Editar qualquer jogo');
            console.log('- Deletar qualquer local');
            console.log('- Ajustar XP e rankings');
            console.log('- Acesso total ao sistema');
        } else {
            console.log(`⚠️  Usuario NAO e admin. Role atual: ${userData.role || 'PLAYER'}`);
            console.log('\nPara promover a ADMIN, execute:');
            console.log('node scripts/promote_to_admin.js');
        }

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('Erro ao verificar usuario:', error.message);
    }
}

// Executar
checkAdminUser()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
