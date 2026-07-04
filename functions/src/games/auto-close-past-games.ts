/**
 * AUTO-CLOSE DE JOGOS ANTIGOS
 *
 * Garante que jogos ativos vencidos deixem de aparecer como próximos jogos
 * para todos os clientes. Depois do período de tolerância:
 * - jogos SCHEDULED/CONFIRMED/LIVE vencidos expiram como CANCELLED.
 *
 * Importante: não inferimos FINISHED automaticamente. Finalizar jogo dispara
 * XP, liga, badges e estatísticas, então só deve acontecer por fluxo explícito.
 */

import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {
  FUNCTION_REGION,
} from "../constants";
import {db} from "../_db";
import {buildGameValidationFromFirestore} from "../game-validation/aggregate";
import {isScoreConsistentFromEventStream} from "./live-events";

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
type ClosedGameStatus = "CANCELLED";

interface PastGameDecision {
  status: ClosedGameStatus;
  reason: "auto_expired";
}

interface ClosePastGamesResult {
  inspected: number;
  finished: number;
  cancelled: number;
}

export interface AutoCloseEvidenceSummary {
  confirmed_count: number;
  checked_in_count: number;
  event_count: number;
  has_score_evidence: boolean;
  score_event_consistent?: boolean;
}

interface AutoCloseEvidenceDecision {
  reviewRequired: boolean;
  reason:
    | "EVIDENCE_PRESENT_REQUIRES_REVIEW"
    | "NO_EVIDENCE_AUTO_CANCELLED";
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
  void status;
  void confirmedCount;
  void minPlayers;
  return {
    status: "CANCELLED",
    reason: "auto_expired",
  };
}

/**
 * Resume se um auto-close encontrou evidência material que merece revisão.
 *
 * @param {AutoCloseEvidenceSummary} evidence Evidências agregadas do jogo.
 * @return {AutoCloseEvidenceDecision} Decisão de revisão/auditoria.
 */
export function summarizeAutoCloseEvidence(
  evidence: AutoCloseEvidenceSummary,
): AutoCloseEvidenceDecision {
  if (
    evidence.confirmed_count > 0 &&
    (
      evidence.checked_in_count > 0 ||
      evidence.event_count > 0 ||
      evidence.has_score_evidence
    )
  ) {
    return {
      reviewRequired: true,
      reason: "EVIDENCE_PRESENT_REQUIRES_REVIEW",
    };
  }

  return {
    reviewRequired: false,
    reason: "NO_EVIDENCE_AUTO_CANCELLED",
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
 * Carrega sinais mínimos para auto-close orientado por evidência.
 *
 * @param {string} gameId - ID do jogo.
 * @param {FirebaseFirestore.DocumentData} gameData - Dados do jogo.
 * @return {Promise<object>} Evidência agregada e score calculado.
 */
async function getGameEvidence(
  gameId: string,
  gameData: FirebaseFirestore.DocumentData,
): Promise<{
  evidence: AutoCloseEvidenceSummary;
  validationResult: ReturnType<
    typeof buildGameValidationFromFirestore
  >;
}> {
  const [confirmationsSnap, gameEventsSnap, liveScoreSnap] =
    await Promise.all([
      db()
        .collection("confirmations")
        .where("game_id", "==", gameId)
        .where("status", "==", "CONFIRMED")
        .get(),
      db()
        .collection("game_events")
        .where("game_id", "==", gameId)
        .get(),
      db()
        .collection("live_scores")
        .doc(gameId)
        .get(),
    ]);

  const confirmations = confirmationsSnap.docs.map((doc) => doc.data());
  const checkedInCount = confirmations.filter(
    (confirmation) => confirmation.checked_in === true,
  ).length;
  const liveScoreData =
    liveScoreSnap.exists ? liveScoreSnap.data() : undefined;
  const scoreEventConsistent =
    liveScoreData &&
    typeof liveScoreData.team1_id === "string" &&
    typeof liveScoreData.team2_id === "string" ?
      isScoreConsistentFromEventStream(
        gameEventsSnap.docs,
        liveScoreData.team1_id,
        liveScoreData.team2_id,
        typeof liveScoreData.team1_score === "number" ?
          liveScoreData.team1_score :
          0,
        typeof liveScoreData.team2_score === "number" ?
          liveScoreData.team2_score :
          0,
      ) :
      undefined;

  return {
    evidence: {
      confirmed_count: confirmations.length,
      checked_in_count: checkedInCount,
      event_count: gameEventsSnap.size,
      has_score_evidence: liveScoreSnap.exists,
      score_event_consistent: scoreEventConsistent,
    },
    validationResult: buildGameValidationFromFirestore({
      game: gameData,
      confirmations,
      eventCount: gameEventsSnap.size,
      scoreEventConsistent,
      mode: "SOFT_GATE",
    }),
  };
}

/**
 * Cancela um jogo antigo somente se ele ainda estiver ativo no momento do commit.
 *
 * @param {FirebaseFirestore.DocumentReference} gameRef Referencia do jogo.
 * @param {FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>} update Dados.
 * @return {Promise<boolean>} true quando o jogo foi cancelado.
 */
export async function cancelPastGameIfStillActive(
  gameRef: FirebaseFirestore.DocumentReference,
  update: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
): Promise<boolean> {
  return db().runTransaction(async (tx) => {
    const freshGame = await tx.get(gameRef);
    if (!freshGame.exists) {
      return false;
    }
    const freshStatus = freshGame.data()?.status;
    if (!ACTIVE_GAME_STATUSES.includes(freshStatus as ActiveGameStatus)) {
      return false;
    }

    tx.update(gameRef, update);
    return true;
  });
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

  const finished = 0;
  let cancelled = 0;

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
    const {evidence, validationResult} = await getGameEvidence(
      gameDoc.id,
      gameData,
    );
    const evidenceDecision =
      summarizeAutoCloseEvidence(evidence);

    const serverTs = FieldValue.serverTimestamp();
    const commonUpdate = {
      auto_closed: true,
      auto_closed_by: "system",
      auto_closed_at: serverTs,
      auto_close_review_required:
        evidenceDecision.reviewRequired,
      auto_close_validation_reason:
        evidenceDecision.reason,
      auto_close_validation_status:
        validationResult.validation_status,
      auto_close_validation_score:
        validationResult.validation_score,
      auto_close_validation_signals_summary:
        validationResult.validation_signals_summary,
      validation_status:
        validationResult.validation_status,
      validation_score:
        validationResult.validation_score,
      validation_version:
        validationResult.validation_version,
      validation_mode:
        validationResult.validation_mode,
      validation_reasons:
        validationResult.validation_reasons,
      validation_signals_summary:
        validationResult.validation_signals_summary,
      validation_updated_at: serverTs,
      updated_at: serverTs,
    };

    const didCancel = await cancelPastGameIfStillActive(gameDoc.ref, {
      ...commonUpdate,
      status: decision.status,
      auto_cancelled: true,
      status_change_reason: decision.reason,
      cancel_reason: "Jogo expirado automaticamente",
      cancelled_by: "system",
      cancelled_at: serverTs,
    });
    if (didCancel) {
      cancelled++;
    }
  }

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
