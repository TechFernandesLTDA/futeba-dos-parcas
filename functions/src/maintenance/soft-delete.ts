import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Cleanup permanente de documentos soft-deleted (90 dias)
 *
 * Documentos com `deleted_at` são mantidos por 90 dias para recuperação
 * Após 90 dias, são permanentemente deletados
 *
 * Coleções afetadas:
 * - games
 * - groups
 * - locations
 *
 * Executa semanalmente (sábado às 02:00)
 */
export const cleanupSoftDeletedGames = functions.scheduler.onSchedule({
    schedule: "0 2 * * 6", // Sábado às 02:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
}, async (event) => {
    console.log("[SOFT_DELETE] Starting cleanup of soft-deleted games (TTL: 90 days)");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);

    let totalDeleted = 0;
    let batchCount = 0;

    try {
        const query = db.collection("games")
            .where("deleted_at", "<", cutoffDate)
            .orderBy("deleted_at")
            .limit(100); // Limite menor para games (tem cascade delete)

        let hasMore = true;

        while (hasMore) {
            const snapshot = await query.get();

            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            // Delete games (cascade delete will handle related docs)
            for (const doc of snapshot.docs) {
                await doc.ref.delete();
                totalDeleted++;
                console.log(`[SOFT_DELETE] Permanently deleted game ${doc.id}`);
            }

            batchCount++;

            if (snapshot.size < 100) {
                hasMore = false;
            }

            if (batchCount >= 10) {
                console.warn("[SOFT_DELETE] Reached batch limit, stopping.");
                hasMore = false;
            }
        }

        await db.collection("metrics").add({
            type: "soft_delete_cleanup_games",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            deleted_count: totalDeleted,
            batches: batchCount,
            cutoff_date: cutoffDate
        });

        console.log(`[SOFT_DELETE] Completed. Permanently deleted ${totalDeleted} games in ${batchCount} batches`);
    } catch (error) {
        console.error("[SOFT_DELETE] Error during games cleanup:", error);

        await db.collection("metrics").add({
            type: "soft_delete_error_games",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            error: String(error),
            deleted_before_error: totalDeleted
        });

        throw error;
    }
});

/**
 * Cleanup de grupos soft-deleted
 */
export const cleanupSoftDeletedGroups = functions.scheduler.onSchedule({
    schedule: "30 2 * * 6", // Sábado às 02:30
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
}, async (event) => {
    console.log("[SOFT_DELETE] Starting cleanup of soft-deleted groups (TTL: 90 days)");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);

    let totalDeleted = 0;
    let batchCount = 0;

    try {
        const query = db.collection("groups")
            .where("deleted_at", "<", cutoffDate)
            .orderBy("deleted_at")
            .limit(100);

        let hasMore = true;

        while (hasMore) {
            const snapshot = await query.get();

            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            for (const doc of snapshot.docs) {
                await doc.ref.delete();
                totalDeleted++;
                console.log(`[SOFT_DELETE] Permanently deleted group ${doc.id}`);
            }

            batchCount++;

            if (snapshot.size < 100) {
                hasMore = false;
            }

            if (batchCount >= 10) {
                console.warn("[SOFT_DELETE] Reached batch limit, stopping.");
                hasMore = false;
            }
        }

        await db.collection("metrics").add({
            type: "soft_delete_cleanup_groups",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            deleted_count: totalDeleted,
            batches: batchCount,
            cutoff_date: cutoffDate
        });

        console.log(`[SOFT_DELETE] Completed. Permanently deleted ${totalDeleted} groups in ${batchCount} batches`);
    } catch (error) {
        console.error("[SOFT_DELETE] Error during groups cleanup:", error);

        await db.collection("metrics").add({
            type: "soft_delete_error_groups",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            error: String(error),
            deleted_before_error: totalDeleted
        });

        throw error;
    }
});

/**
 * Cleanup de locations soft-deleted
 */
export const cleanupSoftDeletedLocations = functions.scheduler.onSchedule({
    schedule: "0 3 * * 6", // Sábado às 03:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
}, async (event) => {
    console.log("[SOFT_DELETE] Starting cleanup of soft-deleted locations (TTL: 90 days)");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = admin.firestore.Timestamp.fromDate(ninetyDaysAgo);

    let totalDeleted = 0;
    let batchCount = 0;

    try {
        const query = db.collection("locations")
            .where("deleted_at", "<", cutoffDate)
            .orderBy("deleted_at")
            .limit(500);

        let hasMore = true;

        while (hasMore) {
            const snapshot = await query.get();

            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            totalDeleted += snapshot.size;
            batchCount++;

            if (snapshot.size < 500) {
                hasMore = false;
            }

            if (batchCount >= 20) {
                console.warn("[SOFT_DELETE] Reached batch limit, stopping.");
                hasMore = false;
            }
        }

        await db.collection("metrics").add({
            type: "soft_delete_cleanup_locations",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            deleted_count: totalDeleted,
            batches: batchCount,
            cutoff_date: cutoffDate
        });

        console.log(`[SOFT_DELETE] Completed. Permanently deleted ${totalDeleted} locations in ${batchCount} batches`);
    } catch (error) {
        console.error("[SOFT_DELETE] Error during locations cleanup:", error);

        await db.collection("metrics").add({
            type: "soft_delete_error_locations",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            error: String(error),
            deleted_before_error: totalDeleted
        });

        throw error;
    }
});

/**
 * Helper: Soft delete de um game (usado via callable function)
 *
 * Marca o game como deleted_at ao invés de deletar permanentemente
 */
export const softDeleteGame = functions.https.onCall({
    region: "southamerica-east1",
}, async (request) => {
    const userId = request.auth?.uid;
    const gameId = request.data.gameId;

    if (!userId) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }

    if (!gameId) {
        throw new functions.https.HttpsError("invalid-argument", "gameId is required");
    }

    try {
        const gameDoc = await db.collection("games").doc(gameId).get();

        if (!gameDoc.exists) {
            throw new functions.https.HttpsError("not-found", "Game not found");
        }

        const gameData = gameDoc.data();

        // Check ownership
        if (gameData?.owner_id !== userId) {
            throw new functions.https.HttpsError("permission-denied", "Only game owner can delete");
        }

        // Check if already deleted
        if (gameData.deleted_at) {
            throw new functions.https.HttpsError("failed-precondition", "Game already deleted");
        }

        // Soft delete
        await gameDoc.ref.update({
            deleted_at: admin.firestore.FieldValue.serverTimestamp(),
            deleted_by: userId,
            status: "DELETED"
        });

        console.log(`[SOFT_DELETE] Game ${gameId} soft-deleted by user ${userId}`);

        return { success: true, gameId: gameId, deletedAt: new Date().toISOString() };
    } catch (error) {
        console.error(`[SOFT_DELETE] Error soft-deleting game ${gameId}:`, error);
        throw error;
    }
});
