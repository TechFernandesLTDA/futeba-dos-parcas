export type GameValidationMode =
  | "AUDIT_ONLY"
  | "SOFT_GATE"
  | "HARD_GATE";

export type GameValidationStatus =
  | "VALIDATED"
  | "LOW_CONFIDENCE"
  | "REVIEW_REQUIRED";

export interface GameValidationSignalsInput {
  confirmedCount: number;
  checkedInCount: number;
  qrCheckinCount?: number;
  gpsCheckinCount?: number;
  eventCount?: number;
  scoreEventConsistent?: boolean;
  suspiciousOverlapCount?: number;
  impossibleTravelCount?: number;
  manualPresenceCount?: number;
  lowConfidencePresenceCount?: number;
  finishedTooEarly?: boolean;
}

export interface GameValidationSignalsSummary {
  confirmed_count: number;
  checked_in_count: number;
  checked_in_ratio: number;
  qr_checkin_count: number;
  gps_checkin_count: number;
  event_count: number;
  score_event_consistent?: boolean;
  suspicious_overlap_count: number;
  impossible_travel_count: number;
  manual_presence_count: number;
  low_confidence_presence_count: number;
}

export interface GameValidationScoreResult {
  validation_status: GameValidationStatus;
  validation_score: number;
  validation_version: number;
  validation_mode: GameValidationMode;
  validation_reasons: string[];
  validation_signals_summary: GameValidationSignalsSummary;
}

export const GAME_VALIDATION_VERSION = 1;
export const VALIDATED_SCORE_THRESHOLD = 75;
export const REVIEW_REQUIRED_SCORE_THRESHOLD = 50;

const BASE_SCORE = 60;

/**
 * Normaliza contadores de entrada para inteiros nao-negativos.
 *
 * @param {number | undefined} value Valor bruto de entrada.
 * @return {number} Inteiro seguro para uso no score.
 */
function asNonNegativeInt(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

/**
 * Limita o score ao intervalo publico 0..100.
 *
 * @param {number} score Score bruto.
 * @return {number} Score arredondado e limitado.
 */
function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Converte score numerico para status de validacao.
 *
 * @param {number} score Score ja normalizado.
 * @return {GameValidationStatus} Status de validacao correspondente.
 */
function getValidationStatus(score: number): GameValidationStatus {
  if (score >= VALIDATED_SCORE_THRESHOLD) {
    return "VALIDATED";
  }
  if (score >= REVIEW_REQUIRED_SCORE_THRESHOLD) {
    return "LOW_CONFIDENCE";
  }
  return "REVIEW_REQUIRED";
}

/**
 * Deterministic v1 score for game-level validation.
 *
 * This function is intentionally pure: it receives already-aggregated signals
 * and returns an explainable score/status. Firestore reads, writes, rollout
 * flags and reward gating live outside this module.
 *
 * @param {GameValidationSignalsInput} input Aggregated validation signals.
 * @param {GameValidationMode} mode Rollout mode that produced the score.
 * @return {GameValidationScoreResult} Score, status and audit summary.
 */
export function calculateGameValidationScore(
  input: GameValidationSignalsInput,
  mode: GameValidationMode = "AUDIT_ONLY",
): GameValidationScoreResult {
  const confirmedCount = asNonNegativeInt(input.confirmedCount);
  const checkedInCount = asNonNegativeInt(input.checkedInCount);
  const qrCheckinCount = asNonNegativeInt(input.qrCheckinCount);
  const gpsCheckinCount = asNonNegativeInt(input.gpsCheckinCount);
  const eventCount = asNonNegativeInt(input.eventCount);
  const suspiciousOverlapCount = asNonNegativeInt(
    input.suspiciousOverlapCount,
  );
  const impossibleTravelCount = asNonNegativeInt(
    input.impossibleTravelCount,
  );
  const manualPresenceCount = asNonNegativeInt(input.manualPresenceCount);
  const lowConfidencePresenceCount = asNonNegativeInt(
    input.lowConfidencePresenceCount,
  );

  const checkedInRatio = confirmedCount > 0 ?
    checkedInCount / confirmedCount :
    0;

  const reasons: string[] = [];
  let score = BASE_SCORE;

  if (confirmedCount === 0) {
    score -= 30;
    reasons.push("NO_CONFIRMED_PLAYERS");
  }

  if (checkedInCount === 0) {
    score -= 25;
    reasons.push("NO_CHECKINS");
  } else if (checkedInRatio >= 0.5) {
    score += 15;
  } else {
    score -= 10;
    reasons.push("LOW_CHECKIN_RATIO");
  }

  if (qrCheckinCount >= 2 && gpsCheckinCount >= 2) {
    score += 5;
  }

  if (eventCount > 0) {
    score += 5;
  }

  if (input.scoreEventConsistent === true) {
    score += 5;
  } else if (input.scoreEventConsistent === false) {
    score -= 20;
    reasons.push("EVENT_SCORE_MISMATCH");
  }

  if (suspiciousOverlapCount === 0) {
    score += 5;
  } else {
    score -= Math.min(suspiciousOverlapCount * 15, 45);
    reasons.push("TEMPORAL_OVERLAP");
  }

  if (impossibleTravelCount === 0) {
    score += 5;
  } else {
    score -= Math.min(impossibleTravelCount * 25, 50);
    reasons.push("IMPOSSIBLE_TRAVEL");
  }

  if (
    confirmedCount > 0 &&
    manualPresenceCount / confirmedCount > 0.5
  ) {
    score -= 20;
    reasons.push("HIGH_MANUAL_PRESENCE_RATIO");
  }

  if (lowConfidencePresenceCount > 0) {
    score -= Math.min(lowConfidencePresenceCount * 5, 25);
    reasons.push("LOW_CONFIDENCE_PRESENCE");
  }

  if (input.finishedTooEarly === true) {
    score -= 20;
    reasons.push("FINISH_TOO_EARLY");
  }

  const validationScore = clampScore(score);

  return {
    validation_status: getValidationStatus(validationScore),
    validation_score: validationScore,
    validation_version: GAME_VALIDATION_VERSION,
    validation_mode: mode,
    validation_reasons: reasons,
    validation_signals_summary: {
      confirmed_count: confirmedCount,
      checked_in_count: checkedInCount,
      checked_in_ratio: Number(checkedInRatio.toFixed(4)),
      qr_checkin_count: qrCheckinCount,
      gps_checkin_count: gpsCheckinCount,
      event_count: eventCount,
      score_event_consistent: input.scoreEventConsistent,
      suspicious_overlap_count: suspiciousOverlapCount,
      impossible_travel_count: impossibleTravelCount,
      manual_presence_count: manualPresenceCount,
      low_confidence_presence_count: lowConfidencePresenceCount,
    },
  };
}
