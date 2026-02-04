import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * TTL Cleanup - Deleta xp_logs com mais de 1 ano
 *
 * Executa semanalmente (todo domingo às 03:00 UTC)
 *
 * Motivação:
 * - Reduz custos de armazenamento Firestore
 * - Mantém apenas logs recentes para análise
 * - Logs são mantidos por 1 ano para conformidade
 */
export const cleanupOldXpLogs = functions.scheduler.onSchedule({
  schedule: "0 3 * * 0", // Todo domingo às 03:00 UTC
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "512MiB",
  timeoutSeconds: 540, // 9 minutos
}, async (event) => {
  console.log("[CLEANUP] Starting xp_logs cleanup (TTL: 1 year)");

  const now = admin.firestore.Timestamp.now();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoffDate = admin.firestore.Timestamp.fromDate(oneYearAgo);

  console.log(`[CLEANUP] Cutoff date: ${cutoffDate.toDate().toISOString()}`);

  let totalDeleted = 0;
  let batchCount = 0;

  try {
    // Query logs older than 1 year
    // Limit to 500 per batch (Firestore batch limit)
    const query = db.collection("xp_logs")
      .where("created_at", "<", cutoffDate)
      .orderBy("created_at")
      .limit(500);

    let hasMore = true;

    while (hasMore) {
      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      // Delete in batch
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;
      batchCount++;

      console.log(`[CLEANUP] Deleted batch ${batchCount} (${snapshot.size} docs)`);

      // If we got less than 500, we're done
      if (snapshot.size < 500) {
        hasMore = false;
      }

      // Safety: stop after 100 batches (50k docs) in one run
      if (batchCount >= 100) {
        console.warn("[CLEANUP] Reached 100 batches limit, stopping. Schedule will retry next week.");
        hasMore = false;
      }
    }

    // Log metrics for monitoring
    await db.collection("metrics").add({
      type: "xp_logs_cleanup",
      timestamp: now,
      deleted_count: totalDeleted,
      batches: batchCount,
      cutoff_date: cutoffDate,
    });

    console.log(`[CLEANUP] Completed. Total deleted: ${totalDeleted} xp_logs in ${batchCount} batches`);

    // Log resultado (scheduled functions não devem retornar valores)
    console.log(`[CLEANUP] Result: { success: true, deleted: ${totalDeleted}, batches: ${batchCount} }`);
  } catch (error) {
    console.error("[CLEANUP] Error during xp_logs cleanup:", error);

    // Log error for monitoring
    await db.collection("metrics").add({
      type: "xp_logs_cleanup_error",
      timestamp: now,
      error: String(error),
      deleted_before_error: totalDeleted,
    });

    throw error; // Re-throw to trigger retry
  }
});

/**
 * Cleanup de atividades antigas (90 dias)
 *
 * Feed de atividades não precisa manter histórico infinito
 */
export const cleanupOldActivities = functions.scheduler.onSchedule({
  schedule: "0 4 * * 0", // Todo domingo às 04:00 UTC
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (event) => {
  console.log("[CLEANUP] Starting activities cleanup (TTL: 90 days)");

  const now = admin.firestore.Timestamp.now();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);

  let totalDeleted = 0;
  let batchCount = 0;

  try {
    const query = db.collection("activities")
      .where("created_at", "<", cutoffDate)
      .orderBy("created_at")
      .limit(500);

    let hasMore = true;

    while (hasMore) {
      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;
      batchCount++;

      console.log(`[CLEANUP] Deleted batch ${batchCount} (${snapshot.size} activities)`);

      if (snapshot.size < 500) {
        hasMore = false;
      }

      if (batchCount >= 100) {
        console.warn("[CLEANUP] Reached batch limit, stopping.");
        hasMore = false;
      }
    }

    await db.collection("metrics").add({
      type: "activities_cleanup",
      timestamp: now,
      deleted_count: totalDeleted,
      batches: batchCount,
      cutoff_date: cutoffDate,
    });

    console.log(`[CLEANUP] Completed. Total deleted: ${totalDeleted} activities in ${batchCount} batches`);
  } catch (error) {
    console.error("[CLEANUP] Error during activities cleanup:", error);

    await db.collection("metrics").add({
      type: "activities_cleanup_error",
      timestamp: now,
      error: String(error),
      deleted_before_error: totalDeleted,
    });

    throw error;
  }
});

/**
 * Cleanup de notificações antigas (30 dias)
 *
 * Notificações lidas e antigas podem ser removidas
 */
export const cleanupOldNotifications = functions.scheduler.onSchedule({
  schedule: "0 5 * * 0", // Todo domingo às 05:00 UTC
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (event) => {
  console.log("[CLEANUP] Starting notifications cleanup (TTL: 30 days, read only)");

  const now = admin.firestore.Timestamp.now();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = admin.firestore.Timestamp.fromDate(thirtyDaysAgo);

  let totalDeleted = 0;
  let batchCount = 0;

  try {
    // Only delete READ notifications older than 30 days
    const query = db.collection("notifications")
      .where("read", "==", true)
      .where("created_at", "<", cutoffDate)
      .orderBy("created_at")
      .limit(500);

    let hasMore = true;

    while (hasMore) {
      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      totalDeleted += snapshot.size;
      batchCount++;

      console.log(`[CLEANUP] Deleted batch ${batchCount} (${snapshot.size} notifications)`);

      if (snapshot.size < 500) {
        hasMore = false;
      }

      if (batchCount >= 100) {
        console.warn("[CLEANUP] Reached batch limit, stopping.");
        hasMore = false;
      }
    }

    await db.collection("metrics").add({
      type: "notifications_cleanup",
      timestamp: now,
      deleted_count: totalDeleted,
      batches: batchCount,
      cutoff_date: cutoffDate,
    });

    console.log(`[CLEANUP] Completed. Total deleted: ${totalDeleted} notifications in ${batchCount} batches`);
  } catch (error) {
    console.error("[CLEANUP] Error during notifications cleanup:", error);

    await db.collection("metrics").add({
      type: "notifications_cleanup_error",
      timestamp: now,
      error: String(error),
      deleted_before_error: totalDeleted,
    });

    throw error;
  }
});
