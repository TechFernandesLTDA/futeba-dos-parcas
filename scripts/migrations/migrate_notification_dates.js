/**
 * Script para migrar notificações existentes que não têm o campo created_at
 *
 * Opções:
 * 1. Deletar notificações sem data (recomendado se forem antigas)
 * 2. Adicionar data atual (se quiser preservar)
 *
 * Uso: node migrate_notification_dates.js [--delete | --add-date]
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateNotifications(deleteMode = false) {
    console.log('=== Migração de Notificações ===\n');
    console.log(`Modo: ${deleteMode ? 'DELETAR' : 'ADICIONAR DATA'}\n`);

    try {
        // Buscar todas as notificações
        const snapshot = await db.collection('notifications').get();

        console.log(`Total de notificações: ${snapshot.size}\n`);

        const notificationsWithoutDate = [];
        const notificationsWithDate = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.created_at) {
                notificationsWithoutDate.push({ id: doc.id, data });
            } else {
                notificationsWithDate.push({ id: doc.id, data });
            }
        });

        console.log(`Notificações COM data: ${notificationsWithDate.length}`);
        console.log(`Notificações SEM data: ${notificationsWithoutDate.length}\n`);

        if (notificationsWithoutDate.length === 0) {
            console.log('✅ Nenhuma notificação precisa de migração!');
            return;
        }

        // Mostrar algumas notificações sem data
        console.log('Exemplos de notificações sem data:');
        notificationsWithoutDate.slice(0, 5).forEach(n => {
            console.log(`  - ID: ${n.id}`);
            console.log(`    Título: ${n.data.title}`);
            console.log(`    Tipo: ${n.data.type}`);
            console.log(`    Usuário: ${n.data.user_id}`);
            console.log('');
        });

        if (deleteMode) {
            // Deletar notificações sem data
            console.log('Deletando notificações sem data...');

            const batches = [];
            let batch = db.batch();
            let count = 0;

            for (const n of notificationsWithoutDate) {
                batch.delete(db.collection('notifications').doc(n.id));
                count++;

                if (count % 400 === 0) {
                    batches.push(batch);
                    batch = db.batch();
                }
            }

            if (count % 400 !== 0) {
                batches.push(batch);
            }

            for (const b of batches) {
                await b.commit();
            }

            console.log(`✅ ${notificationsWithoutDate.length} notificações deletadas!`);
        } else {
            // Adicionar data atual às notificações sem data
            console.log('Adicionando created_at às notificações...');

            const batches = [];
            let batch = db.batch();
            let count = 0;
            const now = admin.firestore.Timestamp.now();

            for (const n of notificationsWithoutDate) {
                const ref = db.collection('notifications').doc(n.id);
                batch.update(ref, { created_at: now });
                count++;

                if (count % 400 === 0) {
                    batches.push(batch);
                    batch = db.batch();
                }
            }

            if (count % 400 !== 0) {
                batches.push(batch);
            }

            for (const b of batches) {
                await b.commit();
            }

            console.log(`✅ ${notificationsWithoutDate.length} notificações atualizadas com created_at!`);
        }

    } catch (error) {
        console.error('Erro:', error);
    }

    process.exit(0);
}

// Verificar argumentos
const args = process.argv.slice(2);
const deleteMode = args.includes('--delete');
const addDateMode = args.includes('--add-date');

if (!deleteMode && !addDateMode) {
    console.log('Uso: node migrate_notification_dates.js [--delete | --add-date]');
    console.log('');
    console.log('  --delete    Deleta notificações sem data (recomendado para limpeza)');
    console.log('  --add-date  Adiciona data atual às notificações sem data');
    console.log('');
    console.log('Executando em modo de VERIFICAÇÃO apenas...\n');
}

migrateNotifications(deleteMode);
