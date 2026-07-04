import {
  GameValidationMode,
  GameValidationScoreResult,
  calculateGameValidationScore,
} from "./score";

type FirestoreData = Record<string, unknown>;

export interface BuildGameValidationFromFirestoreInput {
  game?: object;
  confirmations: FirestoreData[];
  eventCount?: number;
  scoreEventConsistent?: boolean;
  mode?: GameValidationMode;
}

const DEFAULT_GAME_DURATION_MINUTES = 90;
const FINISH_TOO_EARLY_RATIO = 0.5;

/**
 * Converte datas Firestore/JS/ISO para milissegundos.
 *
 * @param {unknown} value Valor de data bruto.
 * @return {number | null} Timestamp em ms, se valido.
 */
function toMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as {toMillis?: unknown}).toMillis === "function"
  ) {
    return (value as {toMillis: () => number}).toMillis();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as {toDate?: unknown}).toDate === "function"
  ) {
    return (value as {toDate: () => Date}).toDate().getTime();
  }
  return null;
}

/**
 * Resolve duracao agendada do jogo em minutos.
 *
 * @param {FirestoreData} game Dados do jogo.
 * @return {number} Duracao em minutos.
 */
function getScheduledDurationMinutes(game: object): number {
  const gameData = game as FirestoreData;
  const explicitDuration = gameData.duration_minutes;
  if (
    typeof explicitDuration === "number" &&
    Number.isFinite(explicitDuration) &&
    explicitDuration > 0
  ) {
    return explicitDuration;
  }

  const start = toMillis(gameData.dateTime ?? gameData.date_time);
  const endTime = gameData.end_time ?? gameData.endTime;
  if (start && typeof endTime === "string") {
    const [hoursRaw, minutesRaw] = endTime.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours >= 0 &&
      hours <= 23 &&
      minutes >= 0 &&
      minutes <= 59
    ) {
      const startDate = new Date(start);
      const endDate = new Date(start);
      endDate.setHours(hours, minutes, 0, 0);
      if (endDate.getTime() <= startDate.getTime()) {
        endDate.setDate(endDate.getDate() + 1);
      }
      return Math.max(
        1,
        Math.round((endDate.getTime() - startDate.getTime()) / 60000),
      );
    }
  }

  return DEFAULT_GAME_DURATION_MINUTES;
}

/**
 * Detecta encerramento muito antes da duracao agendada.
 *
 * @param {FirestoreData | undefined} game Dados do jogo.
 * @return {boolean} true quando o jogo terminou antes de metade da duracao.
 */
export function didFinishTooEarly(
  game: object | undefined,
): boolean {
  if (!game) return false;

  const gameData = game as FirestoreData;
  const start = toMillis(gameData.dateTime ?? gameData.date_time);
  const finishedAt = toMillis(gameData.finished_at ?? gameData.finishedAt);
  if (!start || !finishedAt || finishedAt <= start) return false;

  const scheduledDurationMs =
    getScheduledDurationMinutes(game) * 60 * 1000;
  const elapsedMs = finishedAt - start;

  return elapsedMs < scheduledDurationMs * FINISH_TOO_EARLY_RATIO;
}

/**
 * Monta o score de validacao a partir de dados ja carregados do Firestore.
 *
 * A funcao nao faz leitura nem escrita. Isso mantem o agregador testavel e
 * permite reuso em triggers, callables e scripts de backfill.
 *
 * @param {BuildGameValidationFromFirestoreInput} input Dados agregados.
 * @return {GameValidationScoreResult} Score e resumo auditavel.
 */
export function buildGameValidationFromFirestore(
  input: BuildGameValidationFromFirestoreInput,
): GameValidationScoreResult {
  const confirmations = input.confirmations;
  const checkedIn = confirmations.filter(
    (confirmation) => confirmation.checked_in === true,
  );
  const manualPresence = confirmations.filter(
    (confirmation) =>
      confirmation.was_present === true &&
      confirmation.checked_in !== true,
  );
  const suspiciousOverlap = confirmations.filter(
    (confirmation) =>
      confirmation.suspicious_overlap === true ||
      confirmation.suspiciousOverlap === true,
  );
  const impossibleTravel = confirmations.filter(
    (confirmation) =>
      confirmation.suspicious_impossible_travel === true ||
      confirmation.suspiciousImpossibleTravel === true,
  );
  const lateCheckin = confirmations.filter(
    (confirmation) =>
      confirmation.suspicious_late_checkin === true ||
      confirmation.suspiciousLateCheckin === true,
  );
  const lowConfidencePresence = confirmations.filter(
    (confirmation) =>
      confirmation.presence_status === "LOW_CONFIDENCE" ||
      confirmation.presence_status === "REVIEW_REQUIRED",
  );

  return calculateGameValidationScore(
    {
      confirmedCount: confirmations.length,
      checkedInCount: checkedIn.length,
      qrCheckinCount: checkedIn.filter(
        (confirmation) => confirmation.check_in_method === "qr",
      ).length,
      gpsCheckinCount: checkedIn.filter(
        (confirmation) => confirmation.check_in_method === "gps",
      ).length,
      eventCount: input.eventCount ?? 0,
      scoreEventConsistent: input.scoreEventConsistent,
      suspiciousOverlapCount: suspiciousOverlap.length,
      impossibleTravelCount: impossibleTravel.length,
      lateCheckinCount: lateCheckin.length,
      manualPresenceCount: manualPresence.length,
      lowConfidencePresenceCount: lowConfidencePresence.length,
      finishedTooEarly: didFinishTooEarly(input.game),
    },
    input.mode ?? "AUDIT_ONLY",
  );
}
