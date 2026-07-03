export type PresenceStatus =
  | "VALIDATED"
  | "LOW_CONFIDENCE"
  | "REVIEW_REQUIRED";

export type PresenceMethod = "gps" | "qr";

export interface PresenceEvidenceInput {
  distanceMeters: number;
  radiusMeters: number;
  accuracyMeters?: number | null;
  method: PresenceMethod;
}

export interface PresenceEvidenceResult {
  presence_confidence: number;
  presence_status: PresenceStatus;
  presence_reasons: string[];
  check_in_evidence_version: number;
}

export const PRESENCE_EVIDENCE_VERSION = 1;

/**
 * Calcula confianca de presenca a partir de evidencias do check-in.
 *
 * O check-in ja bloqueia fora de raio e baixa precisao extrema. Este score e
 * audit-only: ajuda a validar o jogo sem introduzir novos bloqueios no campo.
 *
 * @param {PresenceEvidenceInput} input Evidencias server-side do check-in.
 * @return {PresenceEvidenceResult} Score e razoes auditaveis.
 */
export function calculatePresenceEvidence(
  input: PresenceEvidenceInput,
): PresenceEvidenceResult {
  const reasons: string[] = [];
  let score = 70;

  const radius = Math.max(1, input.radiusMeters);
  const distanceRatio = Math.max(0, input.distanceMeters) / radius;

  if (distanceRatio <= 0.25) {
    score += 10;
  } else if (distanceRatio <= 0.5) {
    score += 5;
  } else if (distanceRatio >= 0.85) {
    score -= 10;
    reasons.push("DISTANCE_NEAR_LIMIT");
  }

  if (typeof input.accuracyMeters === "number") {
    if (input.accuracyMeters <= 25) {
      score += 10;
    } else if (input.accuracyMeters <= 50) {
      score += 5;
    } else {
      score -= 10;
      reasons.push("LOW_GPS_ACCURACY");
    }
  } else {
    score -= 5;
    reasons.push("GPS_ACCURACY_MISSING");
  }

  if (input.method === "qr") {
    score += 10;
  }

  const presenceConfidence = Math.max(
    0,
    Math.min(100, Math.round(score)),
  );

  let presenceStatus: PresenceStatus = "REVIEW_REQUIRED";
  if (presenceConfidence >= 75) {
    presenceStatus = "VALIDATED";
  } else if (presenceConfidence >= 50) {
    presenceStatus = "LOW_CONFIDENCE";
  }

  return {
    presence_confidence: presenceConfidence,
    presence_status: presenceStatus,
    presence_reasons: reasons,
    check_in_evidence_version: PRESENCE_EVIDENCE_VERSION,
  };
}
