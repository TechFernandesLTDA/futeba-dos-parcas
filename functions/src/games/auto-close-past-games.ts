/**
 * AUTO-CLOSE DE JOGOS ANTIGOS
 *
 * Garante que jogos ativos vencidos deixem de aparecer como próximos jogos
 * para todos os clientes. Depois do período de tolerância:
 * - jogos LIVE, ou com quórum confirmado, viram FINISHED;
 * - jogos sem quórum viram CANCELLED.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {
  FIRESTORE_BATCH_SAFE_LIMIT,
  FUNCTION_REGION,
} from "../constants";
import {db} from "../_db";

export const PAST_GAME_GRACE_DAYS = 2;
export const PAST_GAME_MIN_PLAYERS = 6;
export const PAST_GAME_PAGE_LIMIT = 250;

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_GAME_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "LIVE",
] as const;

type ActiveGameStatus = typeof ACTIVE_GAME_STATUSES[number];
type ClosedGameStatus = "FINISHED" | "CANCELLED";

interface PastGameDecision {
  status: ClosedGameStatus;
  reason: "played_or_live" | "low_quorum";
}

interface ClosePastGamesResult {
  inspected: number;
  finished: number;
  cancelled: number;
}

/**
 * Calcula o limite de expiração de jogos ativos.
 *
 * @param {Date} now - Data de referência.
 * @param {number} graceDays - Dias de tolerância.
 * @return {Date} Cutoff; jogos ativos antes dele serão fechados.
 */
export function getPastGameCutoff(
  now = new Date(),
  graceDays = PAST_GAME_GRACE_DAYS
): Date {
  return new Date(now.getTime() - graceDays * DAY_MS);
}

/**
 * Decide se um jogo antigo deve ser finalizado ou cancelado.
 *
 * @param {ActiveGameStatus} status - Status atual do jogo.
 * @param {number} confirmedCount - Jogadores confirmados.
 * @param {number} minPlayers - Quórum mínimo.
 * @return {PastGameDecision} Decisão de fechamento.
 */
export function decidePastGameClosure(
  status: ActiveGameStatus,
  confirmedCount: number,
  minPlayers = PAST_GAME_MIN_PLAYERS
): PastGameDecision {
  if (status === "LIVE" || confirmedCount >= minPlayers) {
    return {
      status: "FINISHED",
      reason: "played_or_live",
    };
  }

  return {
    status: "CANCELLED",
    reason: "low_quorum",
  };
}

/**
 * Conta jogadores confirmados de um jogo.
 *
 * @param {string} gameId - ID do jogo.
 * @return {Promise<number>} Quantidade de confirmações válidas.
 */
async function getConfirmedCount(
  gameId: string
): Promise<number> {
  const snap = await db()
    .collection("confirmations")
    .where("game_id", "==", gameId)
    .where("status", "==", "CONFIRMED")
    .get();

  return snap.size;
}

/**
 * Fecha jogos ativos antigos. Exportado para testes e backfills manuais.
 *
 * @param {Date} now - Data de referência.
 * @return {Promise<ClosePastGamesResult>} Resultado agregado.
 */
export async function closePastGames(
  now = new Date()
): Promise<ClosePastGamesResult> {
  const cutoff = getPastGameCutoff(now);
  const cutoffTs = Timestamp.fromDate(cutoff);
  const gamesSnap = await db()
    .collection("games")
    .where("status", "in", [...ACTIVE_GAME_STATUSES])
    .where("dateTime", "<=", cutoffTs)
    .orderBy("dateTime", "asc")
    .limit(PAST_GAME_PAGE_LIMIT)
    .get();

  logger.info(
    "[AUTO_CLOSE_PAST_GAMES] " +
    `${gamesSnap.size} jogo(s) ativo(s) até ${cutoff.toISOString()}`
  );

  let finished = 0;
  let cancelled = 0;
  let ops = 0;
  let batch = db().batch();

  const commitIfNeeded = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db().batch();
    ops = 0;
  };

  for (const gameDoc of gamesSnap.docs) {
    const gameData = gameDoc.data();
    const status =
      (gameData.status || "SCHEDULED") as ActiveGameStatus;
    const minPlayers =
      typeof gameData.min_players === "number" ?
        gameData.min_players :
        PAST_GAME_MIN_PLAYERS;

    const confirmedCount = await getConfirmedCount(gameDoc.id);
    const decision = decidePastGameClosure(
      status,
      confirmedCount,
      minPlayers
    );

    const serverTs = FieldValue.serverTimestamp();
    const commonUpdate = {
      auto_closed: true,
      auto_closed_by: "system",
      auto_closed_at: serverTs,
      updated_at: serverTs,
    };

    if (decision.status === "FINISHED") {
      batch.update(gameDoc.ref, {
        ...commonUpdate,
        status: "FINISHED",
        auto_finished: true,
        finished_by: "system",
        finished_reason: "past_game_grace_period",
      });
      finished++;
    } else {
      batch.update(gameDoc.ref, {
        ...commonUpdate,
        status: "CANCELLED",
        auto_cancelled: true,
        cancel_reason: "Jogo expirado sem quórum",
        cancelled_by: "system",
        cancelled_at: serverTs,
      });
      cancelled++;
    }

    ops++;
    if (ops >= FIRESTORE_BATCH_SAFE_LIMIT) {
      await commitIfNeeded();
    }
  }

  await commitIfNeeded();

  logger.info(
    "[AUTO_CLOSE_PAST_GAMES] Concluído: " +
    `${finished} finalizado(s), ${cancelled} cancelado(s)`
  );

  return {
    inspected: gamesSnap.size,
    finished,
    cancelled,
  };
}

export const autoClosePastGames = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    retryCount: 3,
    memory: "256MiB",
  },
  async () => {
    await closePastGames();
  }
);
