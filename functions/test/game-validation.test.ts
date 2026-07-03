import {
  GAME_VALIDATION_VERSION,
  calculateGameValidationScore,
} from "../src/game-validation/score";
import {
  buildGameValidationFromFirestore,
} from "../src/game-validation/aggregate";

describe("game validation score", () => {
  test("classifica jogo com evidencias fortes como VALIDATED", () => {
    const result = calculateGameValidationScore({
      confirmedCount: 10,
      checkedInCount: 7,
      qrCheckinCount: 3,
      gpsCheckinCount: 7,
      eventCount: 4,
      scoreEventConsistent: true,
      suspiciousOverlapCount: 0,
      impossibleTravelCount: 0,
      manualPresenceCount: 1,
    });

    expect(result.validation_status).toBe("VALIDATED");
    expect(result.validation_score).toBe(100);
    expect(result.validation_version).toBe(GAME_VALIDATION_VERSION);
    expect(result.validation_reasons).toEqual([]);
    expect(result.validation_signals_summary.checked_in_ratio).toBe(0.7);
  });

  test("reduz score quando nao ha check-ins", () => {
    const result = calculateGameValidationScore({
      confirmedCount: 8,
      checkedInCount: 0,
      eventCount: 1,
      scoreEventConsistent: true,
    });

    expect(result.validation_status).toBe("LOW_CONFIDENCE");
    expect(result.validation_reasons).toContain("NO_CHECKINS");
  });

  test("classifica sinais graves como REVIEW_REQUIRED", () => {
    const result = calculateGameValidationScore({
      confirmedCount: 8,
      checkedInCount: 2,
      eventCount: 0,
      scoreEventConsistent: false,
      suspiciousOverlapCount: 2,
      impossibleTravelCount: 1,
      manualPresenceCount: 6,
      lowConfidencePresenceCount: 3,
      finishedTooEarly: true,
    }, "SOFT_GATE");

    expect(result.validation_status).toBe("REVIEW_REQUIRED");
    expect(result.validation_score).toBe(0);
    expect(result.validation_mode).toBe("SOFT_GATE");
    expect(result.validation_reasons).toEqual(
      expect.arrayContaining([
        "LOW_CHECKIN_RATIO",
        "EVENT_SCORE_MISMATCH",
        "TEMPORAL_OVERLAP",
        "IMPOSSIBLE_TRAVEL",
        "HIGH_MANUAL_PRESENCE_RATIO",
        "LOW_CONFIDENCE_PRESENCE",
        "FINISH_TOO_EARLY",
      ]),
    );
  });

  test("normaliza entradas invalidas para contadores nao-negativos", () => {
    const result = calculateGameValidationScore({
      confirmedCount: -1,
      checkedInCount: Number.NaN,
      qrCheckinCount: -3,
      gpsCheckinCount: undefined,
      eventCount: -1,
    });

    expect(result.validation_signals_summary.confirmed_count).toBe(0);
    expect(result.validation_signals_summary.checked_in_count).toBe(0);
    expect(result.validation_signals_summary.qr_checkin_count).toBe(0);
    expect(result.validation_signals_summary.gps_checkin_count).toBe(0);
    expect(result.validation_signals_summary.event_count).toBe(0);
    expect(result.validation_reasons).toContain("NO_CONFIRMED_PLAYERS");
  });
});

describe("game validation firestore aggregation", () => {
  test("agrega check-ins, QR/GPS e presença manual", () => {
    const result = buildGameValidationFromFirestore({
      confirmations: [
        {
          checked_in: true,
          check_in_method: "qr",
          was_present: true,
        },
        {
          checked_in: true,
          check_in_method: "gps",
          was_present: true,
        },
        {
          was_present: true,
        },
        {
          status: "CONFIRMED",
        },
      ],
      eventCount: 2,
      scoreEventConsistent: true,
    });

    expect(result.validation_signals_summary.confirmed_count).toBe(4);
    expect(result.validation_signals_summary.checked_in_count).toBe(2);
    expect(result.validation_signals_summary.qr_checkin_count).toBe(1);
    expect(result.validation_signals_summary.gps_checkin_count).toBe(1);
    expect(result.validation_signals_summary.manual_presence_count).toBe(1);
  });

  test("agrega sinais suspeitos legados e novos", () => {
    const result = buildGameValidationFromFirestore({
      confirmations: [
        {checked_in: true, suspicious_overlap: true},
        {checked_in: true, suspiciousImpossibleTravel: true},
        {presence_status: "LOW_CONFIDENCE"},
      ],
      eventCount: 0,
    });

    expect(result.validation_signals_summary.suspicious_overlap_count)
      .toBe(1);
    expect(result.validation_signals_summary.impossible_travel_count)
      .toBe(1);
    expect(result.validation_signals_summary.low_confidence_presence_count)
      .toBe(1);
    expect(result.validation_reasons).toEqual(
      expect.arrayContaining([
        "TEMPORAL_OVERLAP",
        "IMPOSSIBLE_TRAVEL",
        "LOW_CONFIDENCE_PRESENCE",
      ]),
    );
  });
});
