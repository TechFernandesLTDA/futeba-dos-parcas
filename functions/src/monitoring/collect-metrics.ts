import {logger} from "firebase-functions";
import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

import "../types/firestore-count";
import {db} from "../_db";

// Timeout seguro: 8 min (margem de 1 min para limite de 9)
const SAFE_TIMEOUT_MS = 8 * 60 * 1000;

/**
 * Verifica se ainda ha tempo restante antes do timeout da Cloud Function.
 * @param {number} startTime - Timestamp de inicio (Date.now())
 * @return {boolean} true se ainda ha tempo
 */
function hasTimeRemaining(startTime: number): boolean {
  const elapsed = Date.now() - startTime;
  if (elapsed >= SAFE_TIMEOUT_MS) {
    logger.warn(
      "[METRICS_CLEANUP] Tempo esgotado: " +
      `${elapsed}ms decorridos. Parando.`
    );
    return false;
  }
  return true;
}


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
    logger.info(
      "[METRICS] Starting hourly metrics"
    );

    const timestamp =
      FieldValue
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

      // SECFIX #494: paraleliza count() das coleções e queries time-window
      // pra reduzir latência de ~17 round-trips sequenciais (~1200ms)
      // pra ~3 grupos paralelos (~80ms). -85% latência.
      const counts: Record<string, number> = {};

      // Helper pra count com fallback em -1 em erro
      const countCollection = async (
        colName: string
      ): Promise<[string, number]> => {
        try {
          const snap = await db().collection(colName).count().get();
          return [colName, snap.data().count];
        } catch (error) {
          logger.error(
            "[METRICS] Error counting " +
              `${colName}:`,
            error
          );
          return [colName, -1];
        }
      };

      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Helper pra time-window count
      const countWindow = async (
        label: string,
        query: FirebaseFirestore.Query
      ): Promise<[string, number]> => {
        try {
          const snap = await query.count().get();
          return [label, snap.data().count];
        } catch (error) {
          logger.error(
            "[METRICS] Error counting " +
              `${label}:`,
            error
          );
          return [label, -1];
        }
      };

      // Group 1: collection counts (paralelo)
      const collectionResults = await Promise.all(
        collections.map((c) => countCollection(c))
      );
      for (const [name, count] of collectionResults) {
        counts[name] = count;
      }

      // Group 2: time-window queries (paralelo)
      const [
        [, gamesLast24h],
        [, finishedGamesLast24h],
        [, activeUsersLast7d],
        [, xpLogsLast24h],
      ] = await Promise.all([
        countWindow(
          "gamesLast24h",
          db()
            .collection("games")
            .where(
              "created_at",
              ">=",
              admin.firestore.Timestamp.fromDate(oneDayAgo)
            )
        ),
        countWindow(
          "finishedGamesLast24h",
          db()
            .collection("games")
            .where("status", "==", "FINISHED")
            .where(
              "xp_processed_at",
              ">=",
              admin.firestore.Timestamp.fromDate(oneDayAgo)
            )
        ),
        countWindow(
          "activeUsersLast7d",
          db()
            .collection("users")
            .where(
              "updated_at",
              ">=",
              admin.firestore.Timestamp.fromDate(sevenDaysAgo)
            )
        ),
        countWindow(
          "xpLogsLast24h",
          db()
            .collection("xp_logs")
            .where(
              "created_at",
              ">=",
              admin.firestore.Timestamp.fromDate(oneDayAgo)
            )
        ),
      ]);

      // FIX #654-B3: DAU real — usuários únicos que criaram jogos
      // nas últimas 24h. O campo "active_users_last_7d" conta docs
      // de users atualizados, não usuários ativos reais.
      // DAU agora usa Set<string> com owner_id dos jogos.
      let dauLast24h = 0;
      try {
        const dauGamesSnap = await db()
          .collection("games")
          .where(
            "created_at",
            ">=",
            admin.firestore.Timestamp.fromDate(oneDayAgo)
          )
          .limit(1000)
          .get();
        const dauUserIds = new Set<string>();
        for (const doc of dauGamesSnap.docs) {
          const ownerId = doc.data().owner_id;
          if (ownerId) dauUserIds.add(ownerId);
        }
        dauLast24h = dauUserIds.size;
      } catch (dauErr) {
        logger.warn("[METRICS] DAU query failed:", dauErr);
      }

      // Buscar métrica anterior para deltas
      const previousMetricsSnap = await db()
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
          gamesLast24h,
        finished_games_last_24h:
          finishedGamesLast24h,
        active_users_last_7d:
          activeUsersLast7d,
        dau_last_24h: dauLast24h,
        xp_logs_last_24h:
          xpLogsLast24h,
      };

      await db().collection("metrics")
        .add(metricsDoc);

      logger.info(
        "[METRICS] Hourly metrics collected"
      );
      logger.info(
        "[METRICS] Total users: " +
        counts.users
      );
      logger.info(
        "[METRICS] Total games: " +
        counts.games
      );
      logger.info(
        "[METRICS] Games last 24h: " +
        gamesLast24h
      );
      logger.info(
        "[METRICS] Active users last 7d: " +
        activeUsersLast7d
      );
      logger.info(
        "[METRICS] DAU (unique owners): " +
        dauLast24h
      );
    } catch (error) {
      logger.error(
        "[METRICS] Error collecting metrics:",
        error
      );

      await db().collection("metrics").add({
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
    schedule: "58 23 * * *", // 23:58 (offset 1min para evitar colisao com season-cycle e weekly-ranking)
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 300,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    logger.info(
      "[METRICS] Starting daily metrics"
    );

    const timestamp =
      FieldValue
        .serverTimestamp();

    // FIX #2528: meia-noite BRT (UTC-3) em vez de UTC.
    // new Date().setHours(0,0,0,0) no ambiente Cloud
    // Functions (UTC) setava meia-noite UTC = 21:00 BRT
    // do dia anterior, deslocando os snapshots diários em 3h.
    // Agora computa 00:00 BRT = 03:00 UTC explicitamente.
    const now = new Date();
    const todayBrt = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      3, 0, 0, 0
    ));
    const tomorrowBrt = new Date(todayBrt);
    tomorrowBrt.setUTCDate(tomorrowBrt.getUTCDate() + 1);

    const todayTs =
      admin.firestore.Timestamp
        .fromDate(todayBrt);
    const tomorrowTs =
      admin.firestore.Timestamp
        .fromDate(tomorrowBrt);

    try {
      // Jogos criados hoje
      const gamesCreatedToday = await db()
        .collection("games")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // Jogos finalizados hoje
      const gamesFinishedToday = await db()
        .collection("games")
        .where("status", "==", "FINISHED")
        .where("xp_processed_at", ">=", todayTs)
        .where("xp_processed_at", "<", tomorrowTs)
        .count()
        .get();

      // Usuários criados hoje
      const usersCreatedToday = await db()
        .collection("users")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // XP processado hoje
      const xpLogsToday = await db()
        .collection("xp_logs")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // Grupos criados hoje
      const groupsCreatedToday = await db()
        .collection("groups")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      // Notificações enviadas hoje
      const notificationsToday = await db()
        .collection("notifications")
        .where("created_at", ">=", todayTs)
        .where("created_at", "<", tomorrowTs)
        .count()
        .get();

      const dailyMetrics = {
        type: "daily_snapshot",
        timestamp: timestamp,
        date: todayBrt.toISOString()
          .split("T")[0], // YYYY-MM-DD
        day_of_week: todayBrt.getDay(),
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

      await db().collection("metrics")
        .add(dailyMetrics);

      logger.info(
        "[METRICS] Daily metrics collected"
      );
      logger.info(
        "[METRICS] Games created today: " +
        gamesCreatedToday.data().count
      );
      logger.info(
        "[METRICS] Games finished today: " +
        gamesFinishedToday.data().count
      );
      logger.info(
        "[METRICS] Users created today: " +
        usersCreatedToday.data().count
      );
    } catch (error) {
      logger.error(
        "[METRICS] Error collecting daily " +
        "metrics:", error
      );

      await db().collection("metrics").add({
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
    const startTime = Date.now();
    logger.info(
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
      // FIX #2646: cursor+loop+timeout-guard pattern — evita reprocessar os
      // mesmos docs e para graciosamente antes do timeout (padrao cleanup-old-logs.ts).
      const baseQuery = db().collection("metrics")
        .where("timestamp", "<", cutoffDate)
        .orderBy("timestamp")
        .limit(500);

      let hasMore = true;
      let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

      while (hasMore) {
        if (!hasTimeRemaining(startTime)) {
          logger.warn(
            "[METRICS] Parando metrics cleanup " +
            "por timeout. Deletados: " +
            `${totalDeleted}. Continuara na proxima execucao.`
          );
          hasMore = false;
          break;
        }

        const pageQuery = lastDoc ?
          baseQuery.startAfter(lastDoc) :
          baseQuery;
        const snapshot = await pageQuery.get();

        if (snapshot.empty) {
          hasMore = false;
          break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];

        const batch = db().batch();
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
          logger.warn(
            "[METRICS] Reached batch limit, " +
            "stopping."
          );
          hasMore = false;
        }
      }

      logger.info(
        "[METRICS] Cleanup completed. " +
        `Deleted ${totalDeleted} old metrics ` +
        `in ${batchCount} batches`
      );
    } catch (error) {
      logger.error(
        "[METRICS] Error during metrics " +
        "cleanup:", error
      );
      throw error;
    }
  });
