import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";

const db = admin.firestore();

/**
 * Coleta métricas de uso da aplicação.
 *
 * Executa a cada hora.
 *
 * Métricas coletadas:
 * - Contadores de documentos por coleção
 * - Jogos criados (últimas 24h)
 * - Usuários ativos (últimos 7 dias)
 * - XP processado (últimas 24h)
 * - Taxa de crescimento de dados
 */
export const collectHourlyMetrics =
  functions.scheduler.onSchedule({
    schedule: "0 * * * *", // A cada hora
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 300,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    console.log(
      "[METRICS] Starting hourly metrics"
    );

    const timestamp =
      admin.firestore.FieldValue
        .serverTimestamp();
    const now = new Date();

    try {
      // Coletar contadores por coleção
      const collections = [
        "users",
        "games",
        "confirmations",
        "teams",
        "statistics",
        "xp_logs",
        "notifications",
        "activities",
        "groups",
        "locations",
        "season_participation",
        "user_badges",
      ];

      const counts: Record<string, number> = {};

      for (const colName of collections) {
        try {
          const snapshot = await db
            .collection(colName)
            .count()
            .get();
          counts[colName] =
            snapshot.data().count;
        } catch (error) {
          console.error(
            "[METRICS] Error counting " +
            `${colName}:`, error
          );
          counts[colName] = -1; // Erro
        }
      }

      // Métricas de jogos (últimas 24h)
      const oneDayAgo = new Date();
      oneDayAgo.setHours(
        oneDayAgo.getHours() - 24
      );

      const gamesLast24h = await db
        .collection("games")
        .where(
          "created_at",
          ">=",
          admin.firestore.Timestamp
            .fromDate(oneDayAgo)
        )
        .count()
        .get();

      const finishedGamesLast24h = await db
        .collection("games")
        .where("status", "==", "FINISHED")
        .where(
          "xp_processed_at",
          ">=",
          admin.firestore.Timestamp
            .fromDate(oneDayAgo)
        )
        .count()
        .get();

      // Usuários ativos (últimos 7 dias)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(
        sevenDaysAgo.getDate() - 7
      );

      const activeUsersLast7d = await db
        .collection("users")
        .where(
          "updated_at",
          ">=",
          admin.firestore.Timestamp
            .fromDate(sevenDaysAgo)
        )
        .count()
        .get();

      // XP processado (últimas 24h)
      const xpLogsLast24h = await db
        .collection("xp_logs")
        .where(
          "created_at",
          ">=",
          admin.firestore.Timestamp
            .fromDate(oneDayAgo)
        )
        .count()
        .get();

      // Buscar métrica anterior para deltas
      const previousMetricsSnap = await db
        .collection("metrics")
        .where("type", "==", "hourly_snapshot")
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      const deltas: Record<string, number> = {};

      if (!previousMetricsSnap.empty) {
        const previousMetrics =
          previousMetricsSnap.docs[0].data();
        const previousCounts =
          previousMetrics.document_counts || {};

        // Calcular deltas (crescimento na hora)
        for (const [col, count] of
          Object.entries(counts)) {
          const prev =
            previousCounts[col] || 0;
          deltas[col] = count - prev;
        }
      }

      // Salvar snapshot de métricas
      const metricsDoc = {
        type: "hourly_snapshot",
        timestamp: timestamp,
        hour: now.getHours(),
        day_of_week: now.getDay(),
        document_counts: counts,
        deltas: deltas,
        games_last_24h:
          gamesLast24h.data().count,
        finished_games_last_24h:
          finishedGamesLast24h.data().count,
        active_users_last_7d:
          activeUsersLast7d.data().count,
        xp_logs_last_24h:
          xpLogsLast24h.data().count,
      };

      await db.collection("metrics")
        .add(metricsDoc);

      console.log(
        "[METRICS] Hourly metrics collected"
      );
      console.log(
        "[METRICS] Total users: " +
        counts.users
      );
      console.log(
        "[METRICS] Total games: " +
        counts.games
      );
      console.log(
        "[METRICS] Games last 24h: " +
        gamesLast24h.data().count
      );
      console.log(
        "[METRICS] Active users last 7d: " +
        activeUsersLast7d.data().count
      );
    } catch (error) {
      console.error(
        "[METRICS] Error collecting metrics:",
        error
      );

      await db.collection("metrics").add({
        type: "metrics_error",
        timestamp: timestamp,
        error: String(error),
      });

      throw error;
    }
  });

/**
 * Coleta métricas diárias (resumo do dia).
 *
 * Executa às 23:59 de cada dia.
 */
export const collectDailyMetrics =
  functions.scheduler.onSchedule({
    schedule: "59 23 * * *", // 23:59
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 300,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    console.log(
      "[METRICS] Starting daily metrics"
    );

    const timestamp =
      admin.firestore.FieldValue
        .serverTimestamp();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTs =
      admin.firestore.Timestamp
        .fromDate(today);
    const tomorrowTs =
      admin.firestore.Timestamp
        .fromDate(tomorrow);

    try {
      // Jogos criados hoje
      const gamesCreatedToday = await db
        .collection("games")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // Jogos finalizados hoje
      const gamesFinishedToday = await db
        .collection("games")
        .where("status", "==", "FINISHED")
        .where(
          "xp_processed_at", ">=", todayTs
        )
        .where(
          "xp_processed_at", "<", tomorrowTs
        )
        .count()
        .get();

      // Usuários criados hoje
      const usersCreatedToday = await db
        .collection("users")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // XP processado hoje
      const xpLogsToday = await db
        .collection("xp_logs")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // Grupos criados hoje
      const groupsCreatedToday = await db
        .collection("groups")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // Notificações enviadas hoje
      const notificationsToday = await db
        .collection("notifications")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      const dailyMetrics = {
        type: "daily_snapshot",
        timestamp: timestamp,
        date: today.toISOString()
          .split("T")[0], // YYYY-MM-DD
        day_of_week: today.getDay(),
        games_created:
          gamesCreatedToday.data().count,
        games_finished:
          gamesFinishedToday.data().count,
        users_created:
          usersCreatedToday.data().count,
        xp_logs_created:
          xpLogsToday.data().count,
        groups_created:
          groupsCreatedToday.data().count,
        notifications_sent:
          notificationsToday.data().count,
      };

      await db.collection("metrics")
        .add(dailyMetrics);

      console.log(
        "[METRICS] Daily metrics collected"
      );
      console.log(
        "[METRICS] Games created today: " +
        gamesCreatedToday.data().count
      );
      console.log(
        "[METRICS] Games finished today: " +
        gamesFinishedToday.data().count
      );
      console.log(
        "[METRICS] Users created today: " +
        usersCreatedToday.data().count
      );
    } catch (error) {
      console.error(
        "[METRICS] Error collecting daily " +
        "metrics:", error
      );

      await db.collection("metrics").add({
        type: "daily_metrics_error",
        timestamp: timestamp,
        error: String(error),
      });

      throw error;
    }
  });

/**
 * Cleanup de métricas antigas (mantém 90 dias).
 *
 * Executa semanalmente.
 */
export const cleanupOldMetrics =
  functions.scheduler.onSchedule({
    schedule: "0 2 * * 1", // Segunda às 02:00
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    console.log(
      "[METRICS] Starting metrics cleanup " +
      "(TTL: 90 days)"
    );

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(
      ninetyDaysAgo.getDate() - 90
    );
    const cutoffDate =
      admin.firestore.Timestamp
        .fromDate(ninetyDaysAgo);

    let totalDeleted = 0;
    let batchCount = 0;

    try {
      const query = db.collection("metrics")
        .where("timestamp", "<", cutoffDate)
        .orderBy("timestamp")
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

        if (snapshot.size < 500) {
          hasMore = false;
        }

        if (batchCount >= 50) {
          console.warn(
            "[METRICS] Reached batch limit, " +
            "stopping."
          );
          hasMore = false;
        }
      }

      console.log(
        "[METRICS] Cleanup completed. " +
        `Deleted ${totalDeleted} old metrics ` +
        `in ${batchCount} batches`
      );
    } catch (error) {
      console.error(
        "[METRICS] Error during metrics " +
        "cleanup:", error
      );
      throw error;
    }
  });
