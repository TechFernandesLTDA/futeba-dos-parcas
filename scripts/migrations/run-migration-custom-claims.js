#!/usr/bin/env node

/**
 * MIGRATION SCRIPT: Custom Claims Migration Runner
 *
 * Este script executa a migração de Custom Claims para todos os usuários.
 * Usa firebase-admin SDK com service account credentials.
 *
 * USAGE:
 * ```bash
 * node scripts/run-migration-custom-claims.js
 * ```
 *
 * IMPORTANTE:
 * - Requer serviceAccountKey.json no diretório scripts/
 * - Safe to re-run (idempotente)
 * - Logs detalhados no console
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ==========================================
// SETUP
// ==========================================

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ ERROR: serviceAccountKey.json not found at:', serviceAccountPath);
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
});

const db = admin.firestore();
const auth = admin.auth();

// ==========================================
// TYPES & INTERFACES
// ==========================================

/**
 * @typedef {Object} MigrationStats
 * @property {number} processed - Usuários processados com sucesso
 * @property {number} errors - Erros durante a migração
 * @property {number} skipped - Usuários pulados (já tinham claim)
 * @property {number} totalUsers - Total de usuários no Firestore
 * @property {number} startTime - Timestamp de início
 * @property {number} endTime - Timestamp de término
 * @property {number} durationMs - Duração em milissegundos
 */

// ==========================================
// UTILITIES
// ==========================================

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);

    return parts.join(' ') || '< 1s';
}

function printProgress(stats) {
    const total = stats.totalUsers;
    const processed = stats.processed + stats.skipped;
    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
    const bar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));

    console.log(`  [${bar}] ${percentage}% (${processed}/${total})`);
}

// ==========================================
// MIGRATION FUNCTIONS
// ==========================================

/**
 * Migra um batch de usuários para Custom Claims
 *
 * @param {admin.firestore.QueryDocumentSnapshot[]} docs
 * @param {MigrationStats} stats
 */
async function migrateBatch(docs, stats) {
    // Processar em paralelo (max 10 concurrent para evitar rate limits)
    for (let i = 0; i < docs.length; i += 10) {
        const batch = docs.slice(i, i + 10);

        await Promise.all(
            batch.map(async (doc) => {
                const userData = doc.data();
                const role = userData.role || 'PLAYER';
                const uid = doc.id;

                try {
                    // Verificar se já tem Custom Claim setado
                    const userRecord = await auth.getUser(uid);
                    const currentClaims = userRecord.customClaims || {};

                    if (currentClaims.role === role) {
                        console.log(`  [SKIP] User ${uid} already has role=${role} in Custom Claims`);
                        stats.skipped++;
                        return;
                    }

                    // Setar Custom Claim
                    await auth.setCustomUserClaims(uid, { role });
                    stats.processed++;

                    // Log progresso a cada 50 usuários
                    if ((stats.processed + stats.skipped) % 50 === 0) {
                        printProgress(stats);
                    }

                    // Atualizar timestamp de migração no Firestore (opcional)
                    await db.collection('users').doc(uid).update({
                        claims_migrated_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (err) {
                    console.error(`  [ERROR] Failed to migrate user ${uid}:`, err.message);
                    stats.errors++;

                    // Registrar erro em collection de auditoria
                    await db.collection('migration_errors').add({
                        type: 'CUSTOM_CLAIMS_MIGRATION',
                        user_id: uid,
                        error: err.message,
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    }).catch(() => {
                        // Ignore error logging errors
                    });
                }
            })
        );
    }
}

/**
 * Executa migração completa
 *
 * @returns {Promise<MigrationStats>}
 */
async function runMigration() {
    console.log('\n🚀 CUSTOM CLAIMS MIGRATION');
    console.log('='.repeat(60));

    const stats = {
        processed: 0,
        errors: 0,
        skipped: 0,
        totalUsers: 0,
        startTime: Date.now(),
        endTime: null,
        durationMs: null
    };

    try {
        // Contar total de usuários
        console.log('\n📊 Contando usuários...');
        const countSnapshot = await db.collection('users').count().get();
        stats.totalUsers = countSnapshot.data().count;

        console.log(`✓ Total de usuários: ${stats.totalUsers}`);

        if (stats.totalUsers === 0) {
            console.log('\n✅ Nenhum usuário para migrar. Abortando.');
            return stats;
        }

        // Processar em chunks de 500 (limite do Firestore)
        console.log(`\n⏳ Processando em lotes de 500...\n`);

        let lastDoc = null;
        let batchNumber = 0;

        while (true) {
            batchNumber++;
            let query = db.collection('users').limit(500);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty) break;

            console.log(`📦 Lote ${batchNumber}: ${snapshot.docs.length} usuários`);

            await migrateBatch(snapshot.docs, stats);

            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            // Sleep 1s entre batches para evitar rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        stats.endTime = Date.now();
        stats.durationMs = stats.endTime - stats.startTime;

        console.log(`\n${'='.repeat(60)}`);
        console.log('✅ MIGRATION COMPLETE!');
        console.log(`${'='.repeat(60)}`);
        console.log(`  Processed:  ${stats.processed}`);
        console.log(`  Skipped:    ${stats.skipped}`);
        console.log(`  Errors:     ${stats.errors}`);
        console.log(`  Total:      ${stats.processed + stats.skipped + stats.errors}`);
        console.log(`  Duration:   ${formatDuration(stats.durationMs)}`);
        console.log(`${'='.repeat(60)}\n`);

        // Registrar conclusão da migração
        await db.collection('migration_logs').add({
            type: 'CUSTOM_CLAIMS_MIGRATION',
            stats: {
                processed: stats.processed,
                skipped: stats.skipped,
                errors: stats.errors,
                totalUsers: stats.totalUsers,
                durationMs: stats.durationMs
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return stats;
    } catch (error) {
        console.error(`\n❌ FATAL ERROR:`, error);
        throw error;
    }
}

/**
 * Verifica status da migração
 *
 * @returns {Promise<Object>}
 */
async function checkMigrationStatus() {
    console.log('\n🔍 CHECKING MIGRATION STATUS');
    console.log('='.repeat(60));

    try {
        const totalSnapshot = await db.collection('users').count().get();
        const totalUsers = totalSnapshot.data().count;

        const migratedSnapshot = await db
            .collection('users')
            .where('claims_migrated_at', '!=', null)
            .count()
            .get();
        const migratedUsers = migratedSnapshot.data().count;

        const percentComplete = totalUsers > 0 ? (migratedUsers / totalUsers) * 100 : 0;

        console.log(`  Total Users:     ${totalUsers}`);
        console.log(`  Migrated Users:  ${migratedUsers}`);
        console.log(`  Percent:         ${Math.round(percentComplete * 100) / 100}%`);
        console.log(`${'='.repeat(60)}\n`);

        return {
            totalUsers,
            migratedUsers,
            percentComplete: Math.round(percentComplete * 100) / 100
        };
    } catch (error) {
        console.error(`\n❌ ERROR checking status:`, error);
        throw error;
    }
}

// ==========================================
// MAIN
// ==========================================

async function main() {
    try {
        // Verificar status antes
        const statusBefore = await checkMigrationStatus();

        // Executar migração
        await runMigration();

        // Verificar status depois
        const statusAfter = await checkMigrationStatus();

        console.log('📈 BEFORE vs AFTER:');
        console.log(`  Migrated: ${statusBefore.migratedUsers} → ${statusAfter.migratedUsers}`);
        console.log(`  New: ${statusAfter.migratedUsers - statusBefore.migratedUsers}\n`);

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

main();
