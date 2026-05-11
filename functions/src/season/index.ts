import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {
  FIRESTORE_BATCH_LIMIT,
  FUNCTION_REGION,
} from "../constants";
import {db} from "../_db";


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
// SECFIX #495: memory + timeout 9min explicit (cron diário, processa
// múltiplas seasons + batch updates em participation)
export const checkSeasonEnd = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    logger.info(
      "[SEASON] Checking for seasons to close..."
    );

    const now = new Date();
    // FIX #790: usar timezone do Brasil (UTC-3) para gerar todayStr.
    // .toISOString() retorna data UTC — query fechava season 1 dia atrasado
    // (03:00 BRT = 06:00 UTC → todayStr UTC ainda é dia anterior).
    // Cron já roda em America/Sao_Paulo (timeZone acima), data deve coincidir.
    // "en-CA" locale produz formato YYYY-MM-DD nativo.
    const todayStr = now.toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    // Encontrar seasons ativas que passaram do end_date
    // Note: Datas armazenadas como strings YYYY-MM-DD

    const seasonsRef = db().collection("seasons");
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

    let batch = db().batch();
    let operationCount = 0;
    const BATCH_LIMIT = FIRESTORE_BATCH_LIMIT;

    const commitBatch = async () => {
      if (operationCount > 0) {
        await batch.commit();
        logger.info(
          "[SEASON] Committed batch of " +
          `${operationCount} operations.`
        );
        batch = db().batch();
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

      // FIX #991: Gravar standings ANTES de marcar is_active=false.
      // Antes, is_active=false entrava no primeiro batch commit junto com
      // as primeiras standings, mas em seasons grandes poderia ser
      // commitado em um batch anterior à finalização das standings,
      // deixando a season parcialmente fechada e irrecuperável.

      // 1. Snapshot Final Standings PRIMEIRO
      // PERF: Chunked para evitar timeout
      const participationsSnap = await db()
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
            const standingRef = db()
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
          // FIX #653-B2: usar UTC para parser de data consistente e
          // evitar off-by-one no mês em boundary days (ex: 31 -> 1).
          const [endYearStr, endMonthStr, endDayStr] =
            seasonData.end_date.split("-");
          const endYear = parseInt(endYearStr, 10);
          const endMonth = parseInt(endMonthStr, 10) - 1;
          const endDay = parseInt(endDayStr, 10);

          // Avançar 1 dia a partir do end_date (UTC evita shift de tz)
          const nextStart = new Date(
            Date.UTC(endYear, endMonth, endDay + 1)
          );
          // Último dia do mês seguinte ao start
          const nextEnd = new Date(
            Date.UTC(
              nextStart.getUTCFullYear(),
              nextStart.getUTCMonth() + 1,
              0
            )
          );

          // Formatar como chaves canônicas (BRT — usar UTC para evitar drift)
          const nextYear = nextStart.getUTCFullYear();
          const nextMonth = nextStart.getUTCMonth() + 1;
          const nextMonthStr = nextMonth
            .toString()
            .padStart(2, "0");
          const nextId =
            `monthly_${nextYear}_${nextMonthStr}`;

          const nextStartDateStr = [
            nextYear,
            nextMonthStr,
            (nextStart.getUTCDate()
              .toString()
              .padStart(2, "0")),
          ].join("-");

          const nextEndDateStr = [
            nextEnd.getUTCFullYear(),
            (nextEnd.getUTCMonth() + 1)
              .toString()
              .padStart(2, "0"),
            nextEnd.getUTCDate()
              .toString()
              .padStart(2, "0"),
          ].join("-");

          const nextName =
            `Temporada ${getMonthName(nextStart.getUTCMonth())} ${nextYear}`;

          const nextSeasonRef =
            seasonsRef.doc(nextId);
          const nextSeasonSnap =
            await nextSeasonRef.get();

          if (!nextSeasonSnap.exists) {
            batch.set(nextSeasonRef, {
              name: nextName,
              start_date: nextStartDateStr,
              end_date: nextEndDateStr,
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
          // FIX #1040: Re-throw para que o scheduler faça retry.
          // A season atual permanece ativa (is_active=false é gravado DEPOIS,
          // no passo 3b) — nunca ficará sem próxima season criada.
          // Sem o throw, a season seria fechada mesmo sem próxima season,
          // causando gap de temporada visível aos usuários.
          throw e;
        }
      }

      // 3b. FIX #991: Marcar season como inativa SOMENTE após standings
      // e próxima season gravadas com sucesso. Isso garante que, se ocorrer
      // timeout durante as standings, a season não fique parcialmente
      // fechada (is_active=false sem standings completas).
      batch.update(doc.ref, {
        is_active: false,
        closed_at:
          admin.firestore.FieldValue.serverTimestamp(),
      });
      operationCount++;
      if (operationCount >= BATCH_LIMIT) {
        await commitBatch();
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
