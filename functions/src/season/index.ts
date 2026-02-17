import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {
  FIRESTORE_BATCH_LIMIT,
} from "../constants";

const db = admin.firestore();

/**
 * Scheduled job para verificar fim de season.
 * Runs every day at 03:00 AM.
 *
 * PERF_001 #21: Implementa timeout de 9 minutos
 * para evitar timeout das Cloud Functions
 * (limite total é 9min 59s para Cloud Functions
 * escaladas)
 *
 * @return {void}
 */
export const checkSeasonEnd = onSchedule(
  "every day 03:00",
  async () => {
    logger.info(
      "[SEASON] Checking for seasons to close..."
    );

    const now = new Date();
    // Encontrar seasons ativas que passaram do end_date
    // Note: Datas armazenadas como strings YYYY-MM-DD
    const todayStr = now.toISOString().split("T")[0];

    const seasonsRef = db.collection("seasons");
    const snapshot = await seasonsRef
      .where("is_active", "==", true)
      .where("end_date", "<", todayStr)
      .get();

    if (snapshot.empty) {
      logger.info("[SEASON] No seasons to close.");
      return;
    }

    // PERF_001 #21: Timeout management (9 min = 540s)
    const TIMEOUT_MS = 9 * 60 * 1000; // 9 minutos
    const startTime = Date.now();

    const hasTimeRemaining = () => {
      const elapsedMs = Date.now() - startTime;
      const remainingMs = TIMEOUT_MS - elapsedMs;
      const remainingSeconds = Math.floor(
        remainingMs / 1000
      );

      // Reservar 30 segundos para cleanup final
      const minReservedMs = 30 * 1000;
      const isTimeLeft = remainingMs > minReservedMs;

      if (!isTimeLeft) {
        logger.warn(
          "[SEASON][TIMEOUT] Processamento de " +
          "season parado: apenas " +
          `${remainingSeconds}s restantes. ` +
          "Continuando na próxima execução."
        );
      }

      return isTimeLeft;
    };

    let batch = db.batch();
    let operationCount = 0;
    const BATCH_LIMIT = FIRESTORE_BATCH_LIMIT;

    const commitBatch = async () => {
      if (operationCount > 0) {
        await batch.commit();
        logger.info(
          "[SEASON] Committed batch of " +
          `${operationCount} operations.`
        );
        batch = db.batch();
        operationCount = 0;
      }
    };

    let processedCount = 0;
    let skippedCount = 0;

    for (const doc of snapshot.docs) {
      // PERF_001 #21: Verificar timeout a cada iteração
      if (!hasTimeRemaining()) {
        skippedCount =
          snapshot.docs.length - processedCount;
        logger.warn(
          "[SEASON][TIMEOUT] Parando " +
          "processamento. Processados: " +
          `${processedCount}, Pulados: ` +
          `${skippedCount}. Continuarão na ` +
          "próxima execução."
        );
        break;
      }

      const seasonId = doc.id;
      const seasonData = doc.data();
      logger.info(
        "[SEASON] Closing season: " +
        `${seasonId} (${seasonData.name})`
      );

      // 1. Mark Season as Inactive
      batch.update(doc.ref, {
        is_active: false,
        closed_at:
          admin.firestore.FieldValue.serverTimestamp(),
      });
      operationCount++;
      if (operationCount >= BATCH_LIMIT) {
        await commitBatch();
      }

      // 2. Snapshot Final Standings
      // PERF: Chunked para evitar timeout
      const participationsSnap = await db
        .collection("season_participation")
        .where("season_id", "==", seasonId)
        .get();

      if (!participationsSnap.empty) {
        // Processar em chunks se necessário
        // 100 participações por vez
        const CHUNK_SIZE = 100;

        for (
          let i = 0;
          i < participationsSnap.docs.length;
          i += CHUNK_SIZE
        ) {
          if (!hasTimeRemaining()) {
            logger.warn(
              "[SEASON][TIMEOUT] Parando " +
              "processamento de participações " +
              `para season ${seasonId}`
            );
            break;
          }

          const chunk = participationsSnap.docs.slice(
            i,
            i + CHUNK_SIZE
          );

          for (const partDoc of chunk) {
            const p = partDoc.data();

            // Create Final Standing Record
            const standingRef = db
              .collection("season_final_standings")
              .doc();
            batch.set(standingRef, {
              season_id: seasonId,
              user_id: p.user_id,
              final_division: p.division,
              final_rating: p.league_rating || 0,
              points: p.points,
              wins: p.wins,
              draws: p.draws,
              losses: p.losses,
              frozen_at:
                admin.firestore.FieldValue
                  .serverTimestamp(),
            });
            operationCount++;
            if (operationCount >= BATCH_LIMIT) {
              await commitBatch();
              // Verificar tempo após commit
              if (!hasTimeRemaining()) {
                logger.warn(
                  "[SEASON][TIMEOUT] " +
                  "Timeout após batch commit."
                );
                break;
              }
            }
          }

          if (!hasTimeRemaining()) break;
        }
      }

      // 3. Create Next Season (Auto-Renewal Monthly)
      if (
        seasonId.startsWith("monthly") &&
        hasTimeRemaining()
      ) {
        try {
          const endDate = new Date(
            seasonData.end_date
          );
          const nextStartDate = new Date(endDate);
          nextStartDate.setDate(
            nextStartDate.getDate() + 1
          );

          const nextEndDate = new Date(
            nextStartDate.getFullYear(),
            nextStartDate.getMonth() + 1,
            0
          );

          const nextMonthStr =
            (nextStartDate.getMonth() + 1)
              .toString()
              .padStart(2, "0");
          const nextYearStr =
            nextStartDate.getFullYear().toString();
          const nextId =
            `monthly_${nextYearStr}_${nextMonthStr}`;

          const nextName =
            "Temporada " +
            getMonthName(
              nextStartDate.getMonth()
            ) +
            ` ${nextYearStr}`;

          const nextSeasonRef =
            seasonsRef.doc(nextId);
          const nextSeasonSnap =
            await nextSeasonRef.get();

          if (!nextSeasonSnap.exists) {
            batch.set(nextSeasonRef, {
              name: nextName,
              start_date: nextStartDate
                .toISOString()
                .split("T")[0],
              end_date: nextEndDate
                .toISOString()
                .split("T")[0],
              is_active: true,
              created_at:
                admin.firestore.FieldValue
                  .serverTimestamp(),
              type: "MONTHLY",
            });
            logger.info(
              "[SEASON] Scheduled creation of " +
              `next season: ${nextId}`
            );
            operationCount++;
            if (operationCount >= BATCH_LIMIT) {
              await commitBatch();
            }
          }
        } catch (e) {
          logger.error(
            "[SEASON] Error calculating " +
            "next season",
            e
          );
          // Não fazer throw aqui, continuar
          // A próxima execução tentará novamente
        }
      }

      processedCount++;
    }

    // Commit final batch
    await commitBatch();

    const totalProcessed = processedCount;
    const totalSkipped =
      snapshot.docs.length - totalProcessed;

    logger.info(
      "[SEASON] Season closing complete: " +
      `Processed ${totalProcessed}/` +
      `${snapshot.docs.length}, ` +
      `Skipped: ${totalSkipped}`
    );

    if (totalSkipped > 0) {
      logger.info(
        `[SEASON] ${totalSkipped} seasons will ` +
        "be processed in the next scheduled run."
      );
    }
  }
);

/**
 * Retorna o nome do mês em português.
 *
 * @param {number} monthIndex - Índice do mês (0-11)
 * @return {string} Nome do mês em português
 */
function getMonthName(monthIndex: number): string {
  const months = [
    "Janeiro", "Fevereiro", "Março",
    "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro",
    "Outubro", "Novembro", "Dezembro",
  ];
  return months[monthIndex] || "";
}
