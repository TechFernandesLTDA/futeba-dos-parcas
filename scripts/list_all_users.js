/**
 * Script para listar todos os usuários do Firestore
 * Retorna: Document ID e Nome de todos os usuários na coleção 'users'
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

async function listAllUsers() {
    console.log('='.repeat(80));
    console.log('LISTA DE TODOS OS USUÁRIOS - Futeba dos Parças');
    console.log('='.repeat(80));
    console.log('');

    try {
        // Buscar todos os documentos da coleção 'users'
        const usersSnapshot = await db.collection('users').get();

        if (usersSnapshot.empty) {
            console.log('⚠️  Nenhum usuário encontrado na coleção.');
            return;
        }

        console.log(`📊 Total de usuários: ${usersSnapshot.size}`);
        console.log('');
        console.log('─'.repeat(80));
        console.log(sprintf('%-40s | %-30s | %-15s', 'Document ID', 'Nome', 'Apelido'));
        console.log('─'.repeat(80));

        // Formatar saída para cada usuário
        const users = [];
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const userId = doc.id;
            const name = data.name || '(sem nome)';
            const nickname = data.nickname || '(sem apelido)';
            const email = data.email || '(sem email)';

            users.push({
                id: userId,
                name: name,
                nickname: nickname,
                email: email
            });

            // Exibir em formato de tabela
            console.log(sprintf('%-40s | %-30s | %-15s',
                userId.length > 38 ? userId.substring(0, 35) + '...' : userId,
                name.length > 28 ? name.substring(0, 25) + '...' : name,
                nickname.length > 13 ? nickname.substring(0, 10) + '...' : nickname
            ));
        });

        console.log('─'.repeat(80));
        console.log('');

        // Exportar formato JSON para facilitar uso em scripts
        console.log('📋 Formato JSON para uso em scripts:');
        console.log('─'.repeat(80));
        console.log(JSON.stringify(users, null, 2));
        console.log('─'.repeat(80));
        console.log('');

        // Exportar formato simples: ID = Nome
        console.log('📝 Formato simples (ID = Nome):');
        console.log('─'.repeat(80));
        users.forEach(user => {
            console.log(`${user.id} = ${user.name}`);
        });
        console.log('─'.repeat(80));

    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error);
        throw error;
    }
}

// Helper para formatar strings (simplified sprintf)
function sprintf(format, ...args) {
    let i = 0;
    return format.replace(/%-?[0-9]*s/g, (match) => {
        const arg = String(args[i++] || '');
        const width = parseInt(match.match(/[0-9]+/)?.[0] || '0');
        const leftAlign = match.includes('-');

        if (arg.length >= width) return arg;

        const padding = ' '.repeat(width - arg.length);
        return leftAlign ? arg + padding : padding + arg;
    });
}

listAllUsers()
    .then(() => {
        console.log('');
        console.log('✅ Script concluído com sucesso!');
        process.exit(0);
    })
    .catch(err => {
        console.error('');
        console.error('❌ Erro fatal:', err);
        process.exit(1);
    });
