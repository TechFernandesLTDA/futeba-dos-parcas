/**
 * MIGRATION SCRIPT: Custom Claims
 *
 * Migra todos os usuários existentes para Custom Claims.
 * Deve ser executado UMA VEZ após deploy das novas Security Rules.
 *
 * USAGE:
 * ```bash
 * # Via Firebase CLI (local)
 * cd functions
 * npm run build
 * firebase functions:shell
 * > migrateAllUsersToCustomClaims()
 *
 * # OU via HTTP request (produção)
 * curl -X POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/migrateAllUsersToCustomClaims \
 *   -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
 *   -H "Content-Type: application/json"
 * ```
 *
 * IMPORTANTE:
 * - Apenas ADMIN pode executar
 * - Processa em batches de 500 usuários
 * - Safe to re-run (idempotente)
 * - Logs detalhados no Console
 *
 * ROLLBACK:
 * Se houver problemas, reverter Security Rules para versão anterior.
 * Custom Claims não fazem mal e podem ser mantidos.
 */

import * as admin from "firebase-admin";

const db = admin.firestore();

interface MigrationStats {
    processed: number;
    errors: number;
    skipped: number;
    totalUsers: number;
}

/**
 * Migra um batch de usuários para Custom Claims
 */
async function migrateBatch(
  docs: admin.firestore.QueryDocumentSnapshot[],
  stats: MigrationStats
): Promise<void> {
  // Processar em paralelo (max 10 concurrent para evitar rate limits)
  for (let i = 0; i < docs.length; i += 10) {
    const batch = docs.slice(i, i + 10);

    await Promise.all(
      batch.map(async (doc) => {
        const userData = doc.data();
        const role = userData.role || "PLAYER";
        const uid = doc.id;

        try {
          // Verificar se já tem Custom Claim setado
          const userRecord = await admin.auth().getUser(uid);
          const currentClaims = userRecord.customClaims || {};

          if (currentClaims.role === role) {
            console.log(`[SKIP] User ${uid} already has role=${role} in Custom Claims`);
            stats.skipped++;
            return;
          }

          // Setar Custom Claim
          await admin.auth().setCustomUserClaims(uid, {role});
          stats.processed++;

          // Log progresso a cada 100 usuários
          if (stats.processed % 100 === 0) {
            console.log(`[PROGRESS] ${stats.processed}/${stats.totalUsers} users migrated...`);
          }

          // Atualizar timestamp de migração no Firestore (opcional)
          await db.collection("users").doc(uid).update({
            claims_migrated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err: any) {
          console.error(`[ERROR] Failed to migrate user ${uid}:`, err.message);
          stats.errors++;

          // Registrar erro em collection de auditoria
          await db.collection("migration_errors").add({
            type: "CUSTOM_CLAIMS_MIGRATION",
            user_id: uid,
            error: err.message,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
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
 */
export async function runMigration(): Promise<MigrationStats> {
  console.log("[MIGRATION] Starting Custom Claims migration...");

  const stats: MigrationStats = {
    processed: 0,
    errors: 0,
    skipped: 0,
    totalUsers: 0,
  };

  try {
    // Contar total de usuários (para progresso)
    const countSnapshot = await db.collection("users").count().get();
    stats.totalUsers = countSnapshot.data().count;

    console.log(`[MIGRATION] Total users to migrate: ${stats.totalUsers}`);

    // Processar em chunks de 500 (limite do Firestore)
    let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

    while (true) {
      let query = db.collection("users").limit(500);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();

      if (snapshot.empty) break;

      console.log(`[MIGRATION] Processing batch of ${snapshot.docs.length} users...`);

      await migrateBatch(snapshot.docs, stats);

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // Sleep 1s entre batches para evitar rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("[MIGRATION] ✅ Complete!");
    console.log(`  - Processed: ${stats.processed}`);
    console.log(`  - Skipped: ${stats.skipped}`);
    console.log(`  - Errors: ${stats.errors}`);

    // Registrar conclusão da migração
    await db.collection("migration_logs").add({
      type: "CUSTOM_CLAIMS_MIGRATION",
      stats,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return stats;
  } catch (error: any) {
    console.error("[MIGRATION] ❌ Fatal error:", error);
    throw error;
  }
}

/**
 * Verifica status da migração (quantos usuários já foram migrados)
 */
export async function checkMigrationStatus(): Promise<{
    totalUsers: number;
    migratedUsers: number;
    percentComplete: number;
}> {
  const totalSnapshot = await db.collection("users").count().get();
  const totalUsers = totalSnapshot.data().count;

  const migratedSnapshot = await db
    .collection("users")
    .where("claims_migrated_at", "!=", null)
    .count()
    .get();
  const migratedUsers = migratedSnapshot.data().count;

  const percentComplete = totalUsers > 0 ? (migratedUsers / totalUsers) * 100 : 0;

  return {
    totalUsers,
    migratedUsers,
    percentComplete: Math.round(percentComplete * 100) / 100,
  };
}

// Para uso direto no Firebase Functions Shell
if (require.main === module) {
  runMigration()
    .then((stats) => {
      console.log("Migration complete:", stats);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
