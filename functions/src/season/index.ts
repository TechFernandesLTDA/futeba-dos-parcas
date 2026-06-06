import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {
  FIRESTORE_BATCH_SAFE_LIMIT,
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
    const BATCH_LIMIT = FIRESTORE_BATCH_SAFE_LIMIT;

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

      // FIX #1290: preservar frozen_at original em re-runs idempotentes.
      // Como o ID é determinístico (#1281) e o set() faz overwrite total,
      // um re-run (timeout no meio dos chunks ou erro transitório antes de
      // is_active=false) reescrevia frozen_at com o timestamp da re-execução,
      // perdendo a data real de congelamento da temporada. Lemos os standings
      // já gravados (uma query season-scoped) e reaproveitamos o frozen_at.
      const existingStandingsSnap = await db()
        .collection("season_final_standings")
        .where("season_id", "==", seasonId)
        .get();
      const existingFrozenAt =
        new Map<string, admin.firestore.Timestamp>();
      for (const d of existingStandingsSnap.docs || []) {
        const fa = d.data().frozen_at;
        if (fa) existingFrozenAt.set(d.id, fa);
      }

      // FIX #2500: rastreia se TODAS as standings foram gravadas. Se houver
      // timeout no meio, não fechamos a season (passo 3b) — ela será
      // reprocessada na próxima run (idempotente por doc-id). Antes, o 3b
      // marcava is_active=false incondicionalmente mesmo com standings
      // incompletas → histórico permanentemente parcial (#991 incompleto).
      let standingsComplete = true;

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
            standingsComplete = false;
            break;
          }

          const chunk = participationsSnap.docs.slice(
            i,
            i + CHUNK_SIZE
          );

          for (const partDoc of chunk) {
            const p = partDoc.data();

            // FIX #1291: validar user_id antes de compor o doc ID.
            // user_id inválido (undefined/null/vazio) geraria IDs colidentes
            // (`${seasonId}_undefined`) → standings sobrescritas e perda de
            // dados; com "/" o ID seria inválido e abortaria o batch.
            const rawUserId = p.user_id;
            if (
              typeof rawUserId !== "string" ||
              rawUserId.trim() === ""
            ) {
              logger.error(
                `[SEASON] Participação ${partDoc.id} com ` +
                `user_id inválido (${JSON.stringify(rawUserId)}) ` +
                `na season ${seasonId} — standing ignorada`
              );
              continue;
            }
            const safeUserId = rawUserId.replace(/\//g, "_");

            // Create Final Standing Record
            // FIX #1281: ID determinístico `${seasonId}_${user_id}` torna a
            // escrita idempotente (batch.set = upsert pelo mesmo doc ID).
            // Com auto-ID (.doc()), re-runs por timeout ou erro transitório
            // gravavam um segundo conjunto completo de standings com novos IDs
            // → duplicatas permanentes no histórico de temporadas.
            const standingId = `${seasonId}_${safeUserId}`;
            const standingRef = db()
              .collection("season_final_standings")
              .doc(standingId);
            batch.set(standingRef, {
              season_id: seasonId,
              user_id: rawUserId,
              final_division: p.division,
              final_rating: p.league_rating || 0,
              points: p.points,
              wins: p.wins,
              draws: p.draws,
              losses: p.losses,
              // FIX #1290: mantém o frozen_at original se já existe;
              // só usa serverTimestamp() na primeira gravação.
              frozen_at:
                existingFrozenAt.get(standingId) ??
                FieldValue.serverTimestamp(),
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
                standingsComplete = false;
                break;
              }
            }
          }

          if (!hasTimeRemaining()) {
            standingsComplete = false;
            break;
          }
        }
      }

      // 3. Create Next Season (Auto-Renewal Monthly)
      // FIX #2500: nextSeasonReady garante que só fechamos a season atual se a
      // próxima já existe (seasons não-mensais não precisam). Evita gap (#1040).
      let nextSeasonReady = !seasonId.startsWith("monthly");
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
          const nextSeasonData = {
            name: nextName,
            start_date: nextStartDateStr,
            end_date: nextEndDateStr,
            is_active: true,
            created_at:
              FieldValue
                .serverTimestamp(),
            type: "MONTHLY",
          };

          // FIX #1470: atomic read-then-write via transaction
          // to prevent concurrent runs from creating duplicate seasons
          await db().runTransaction(
            async (transaction) => {
              const nextSeasonSnap =
                await transaction.get(nextSeasonRef);
              if (!nextSeasonSnap.exists) {
                transaction.set(
                  nextSeasonRef,
                  nextSeasonData
                );
                logger.info(
                  "[SEASON] Created next " +
                  `season: ${nextId}`
                );
              }
            }
          );
          // Próxima season criada (ou já existente) com sucesso.
          nextSeasonReady = true;
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

      // 3b. FIX #991 + #2500: Marcar season como inativa SOMENTE se as
      // standings completaram (sem timeout) E a próxima season está pronta.
      // Antes este passo era INCONDICIONAL: após um break por timeout no loop
      // de standings, a season era fechada mesmo com standings incompletas →
      // histórico permanentemente parcial e irrecuperável (season nunca mais
      // reprocessada). Agora, se incompleto, NÃO fecha — a próxima run do cron
      // reprocessa (idempotente por doc-id) e fecha quando completar.
      if (standingsComplete && nextSeasonReady) {
        batch.update(doc.ref, {
          is_active: false,
          closed_at:
            FieldValue.serverTimestamp(),
        });
        operationCount++;
        if (operationCount >= BATCH_LIMIT) {
          await commitBatch();
        }
        processedCount++;
      } else {
        logger.warn(
          `[SEASON] Season ${seasonId} NÃO fechada ` +
          `(standingsComplete=${standingsComplete}, ` +
          `nextSeasonReady=${nextSeasonReady}) — será ` +
          "reprocessada na próxima run."
        );
      }
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
