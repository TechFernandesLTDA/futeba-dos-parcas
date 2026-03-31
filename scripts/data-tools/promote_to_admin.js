/**
 * Script para promover um usuário a ADMIN no Firestore
 *
 * Uso: node scripts/promote_to_admin.js
 *
 * Promove renankakinho69@gmail.com para role=ADMIN
 *
 * ATENCAO: Apenas execute este script se voce tiver certeza!
 */

const admin = require('firebase-admin');

// Initialize Firebase
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();

const EMAIL_TO_PROMOTE = 'renankakinho69@gmail.com';

async function promoteToAdmin() {
    console.log('='.repeat(60));
    console.log('PROMOCAO PARA ADMIN - Futeba dos Parcas');
    console.log('='.repeat(60));
    console.log(`\nEmail: ${EMAIL_TO_PROMOTE}\n`);

    try {
        // Buscar usuario pelo email
        const usersSnapshot = await db.collection('users')
            .where('email', '==', EMAIL_TO_PROMOTE)
            .get();

        if (usersSnapshot.empty) {
            console.log('❌ Usuario NAO encontrado com este email!');
            return;
        }

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();
        const currentRole = userData.role || 'PLAYER';

        console.log('Usuario encontrado:');
        console.log(`  ID:    ${userDoc.id}`);
        console.log(`  Nome:  ${userData.name || 'N/A'}`);
        console.log(`  Role:  ${currentRole}`);

        if (currentRole === 'ADMIN') {
            console.log('\n✅ Usuario JA e ADMIN! Nada a fazer.');
            return;
        }

        // Promover para ADMIN
        console.log('\nPromovendo para ADMIN...');

        await db.collection('users').doc(userDoc.id).update({
            role: 'ADMIN',
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('\n🛡️  SUCESSO! Usuario promovido a ADMIN!');
        console.log('\nO usuario agora tem acesso completo ao sistema:');
        console.log('- Gerenciar usuarios (trocar roles, etc)');
        console.log('- Editar/Deletar qualquer jogo ou local');
        console.log('- Ajustar XP, rankings e configuracoes');
        console.log('- Acessar todos os menus administrativos');

        console.log('\n' + '='.repeat(60));

    } catch (error) {
        console.error('Erro ao promover usuario:', error.message);
    }
}

// Executar
promoteToAdmin()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
