import {
  GameValidationMode,
  GameValidationScoreResult,
  calculateGameValidationScore,
} from "./score";

type FirestoreData = Record<string, unknown>;

export interface BuildGameValidationFromFirestoreInput {
  confirmations: FirestoreData[];
  eventCount?: number;
  scoreEventConsistent?: boolean;
  mode?: GameValidationMode;
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
    },
    input.mode ?? "AUDIT_ONLY",
  );
}
