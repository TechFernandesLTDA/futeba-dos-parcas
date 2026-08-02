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
import {
  isScoreConsistentFromEventStream,
  readScoresMap,
} from "./live-events";

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
 * Converte formatos heterogêneos de data do Firestore para Date.
 *
 * @param {unknown} value Valor bruto persistido.
 * @return {Date | null} Date válida ou null.
 */
function coerceGameDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as {toDate: () => Date}).toDate === "function"
  ) {
    const date = (value as {toDate: () => Date}).toDate();
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

const BRT_TIMEZONE = "America/Sao_Paulo";
const LEGACY_DEFAULT_HOUR = 20;

/**
 * Converte um horário-parede BRT para UTC sem depender do timezone do runtime.
 *
 * @param {number} year Ano.
 * @param {number} month Mês 1-12.
 * @param {number} day Dia 1-31.
 * @param {number} hour Hora 0-23.
 * @param {number} minute Minuto 0-59.
 * @return {Date | null} Instante UTC equivalente.
 */
function buildDateFromBrtWallClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const desiredUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let instantMs = desiredUtcMs;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = formatter.formatToParts(new Date(instantMs));
    const getPart = (type: string) =>
      Number(parts.find((part) => part.type === type)?.value);
    const resolvedUtcMs = Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
      getPart("hour") % 24,
      getPart("minute"),
      getPart("second"),
      0
    );
    const driftMs = desiredUtcMs - resolvedUtcMs;
    if (driftMs === 0) {
      break;
    }
    instantMs += driftMs;
  }

  const resolved = new Date(instantMs);
  return Number.isFinite(resolved.getTime()) ? resolved : null;
}

/**
 * Resolve datas legadas baseadas em date + time em America/Sao_Paulo.
 *
 * @param {unknown} rawDate Campo date legado.
 * @param {unknown} rawTime Campo time legado.
 * @return {Date | null} Instante UTC equivalente.
 */
function resolveLegacyDateAndTime(
  rawDate: unknown,
  rawTime: unknown
): Date | null {
  if (typeof rawDate !== "string") {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(rawDate) || /[zZ]$/.test(rawDate)) {
    return coerceGameDate(rawDate);
  }

  const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return coerceGameDate(rawDate);
  }

  const [, yearStr, monthStr, dayStr] = dateMatch;
  let hour = LEGACY_DEFAULT_HOUR;
  let minute = 0;

  if (typeof rawTime === "string" && rawTime.trim().length > 0) {
    const timeMatch = rawTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) {
      return null;
    }
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
  }

  return buildDateFromBrtWallClock(
    Number(yearStr),
    Number(monthStr),
    Number(dayStr),
    hour,
    minute
  );
}

/**
 * Resolve a data efetiva do jogo suportando schemas legados.
 *
 * @param {FirebaseFirestore.DocumentData} gameData Dados do jogo.
 * @return {Date | null} Início do jogo ou null quando inválido.
 */
function resolveGameStartDate(
  gameData: FirebaseFirestore.DocumentData
): Date | null {
  return coerceGameDate(gameData.dateTime) ??
    coerceGameDate(gameData.date_time) ??
    resolveLegacyDateAndTime(gameData.date, gameData.time) ??
    coerceGameDate(gameData.date);
}

/**
 * Busca candidatos vencidos usando campos modernos e legados.
 *
 * @param {Date} cutoff Data limite.
 * @return {Promise<FirebaseFirestore.QueryDocumentSnapshot[]>} Docs candidatos.
 */
async function fetchPastGameCandidates(
  cutoff: Date
): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
  const cutoffTs = Timestamp.fromDate(cutoff);
  const cutoffDateKey = cutoff.toLocaleDateString("en-CA", {
    timeZone: BRT_TIMEZONE,
  });

  const baseQuery = db()
    .collection("games")
    .where("status", "in", [...ACTIVE_GAME_STATUSES]);

  const [datedSnap, legacyDateTimeSnap, legacyDateSnap] = await Promise.all([
    baseQuery
      .where("dateTime", "<=", cutoffTs)
      .orderBy("dateTime", "asc")
      .limit(PAST_GAME_PAGE_LIMIT)
      .get(),
    baseQuery
      .where("date_time", "<=", cutoffTs)
      .orderBy("date_time", "asc")
      .limit(PAST_GAME_PAGE_LIMIT)
      .get(),
    baseQuery
      .where("date", "<=", cutoffDateKey)
      .orderBy("date", "asc")
      .limit(PAST_GAME_PAGE_LIMIT)
      .get(),
  ]);

  const deduped = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const snap of [datedSnap, legacyDateTimeSnap, legacyDateSnap]) {
    for (const doc of snap.docs) {
      deduped.set(doc.id, doc);
    }
  }

  return [...deduped.values()]
    .filter((doc) => {
      const startsAt = resolveGameStartDate(doc.data());
      return startsAt !== null && startsAt.getTime() <= cutoff.getTime();
    })
    .sort((left, right) => {
      const leftMs =
        resolveGameStartDate(left.data())?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightMs =
        resolveGameStartDate(right.data())?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return leftMs - rightMs;
    });
}

/**
 * Remove valores undefined de payloads antes de gravar no Firestore.
 *
 * @param {T} value - Valor original.
 * @return {T} Valor sem campos undefined.
 */
function stripUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedValues(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, stripUndefinedValues(entryValue)])
  ) as T;
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
  // #3942: consistência calculada sobre o mapa canônico de placares
  // (com fallback legado), suportando jogos de 2-4 times.
  const scoresMap = readScoresMap(liveScoreData);
  const scoreEventConsistent =
    liveScoreData && scoresMap.size > 0 ?
      isScoreConsistentFromEventStream(
        gameEventsSnap.docs,
        scoresMap,
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

    tx.update(
      gameRef,
      stripUndefinedValues(update) as
      FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
    );
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
  const candidateDocs = await fetchPastGameCandidates(cutoff);

  logger.info(
    "[AUTO_CLOSE_PAST_GAMES] " +
    `${candidateDocs.length} jogo(s) ativo(s) até ${cutoff.toISOString()}`
  );

  const finished = 0;
  let cancelled = 0;

  for (const gameDoc of candidateDocs) {
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
    const commonUpdate = stripUndefinedValues({
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
    });

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
    inspected: candidateDocs.length,
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
