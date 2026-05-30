
import * as admin from 'firebase-admin';

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!serviceAccountPath) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS não definido. Defina o caminho para o arquivo de chave de serviço.');
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath)
    });
    console.log('Firebase Admin inicializado com sucesso.');
} catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
    process.exit(1);
}

const db = admin.firestore();

async function cleanUpMockData() {
    console.log('🗑️ Iniciando limpeza de dados mock via script Admin...\n');

    try {
        // 1. Limpar player_stats
        console.log('Limpando coleção player_stats...');
        const playerStatsRef = db.collection('player_stats');
        const statsSnapshot = await playerStatsRef
            .where('user_id', '>=', 'mock_')
            .where('user_id', '<', 'mock_~')
            .get();

        if (statsSnapshot.empty) {
            console.log('=> Nenhum documento encontrado em player_stats para remover.');
        } else {
            console.log(`=> Encontrados ${statsSnapshot.size} documentos em player_stats. Deletando em lote...`);
            const batch = db.batch();
            statsSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log('=> Documentos de player_stats removidos com sucesso.');
        }

        // 2. Limpar statistics (estatísticas globais)
        console.log('\nLimpando coleção statistics...');
        const globalStatsRef = db.collection('statistics');
        // Firestore Admin permite listar coleções, mas query por ID de documento em range é diferente
        // Vamos usar a mesma lógica de filtro, assumindo que os IDs são os user_ids
        const globalStatsSnapshot = await globalStatsRef
            .where(admin.firestore.FieldPath.documentId(), '>=', 'mock_')
            .where(admin.firestore.FieldPath.documentId(), '<', 'mock_~')
            .get();

        if (globalStatsSnapshot.empty) {
            console.log('=> Nenhum documento encontrado em statistics para remover.');
        } else {
            console.log(`=> Encontrados ${globalStatsSnapshot.size} documentos em statistics. Deletando em lote...`);
            const batch2 = db.batch();
            globalStatsSnapshot.docs.forEach(doc => {
                batch2.delete(doc.ref);
            });
            await batch2.commit();
            console.log('=> Documentos de statistics removidos com sucesso.');
        }

        console.log('\n✅ Limpeza concluída via Backend Admin Script!');

    } catch (error) {
        console.error('❌ Erro durante a limpeza:', error);
    }
}

cleanUpMockData();
