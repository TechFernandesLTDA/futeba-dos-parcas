jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(),
}));

import {
  PAST_GAME_GRACE_DAYS,
  decidePastGameClosure,
  getPastGameCutoff,
  summarizeAutoCloseEvidence,
} from "../src/games/auto-close-past-games";

describe("auto-close past games helpers", () => {
  it("calcula cutoff usando a tolerância configurada", () => {
    const now = new Date("2026-06-21T12:00:00.000Z");
    const cutoff = getPastGameCutoff(now);

    expect(PAST_GAME_GRACE_DAYS).toBe(2);
    expect(cutoff.toISOString()).toBe("2026-06-19T12:00:00.000Z");
  });

  it("expira jogo LIVE sem marcar como realizado", () => {
    expect(decidePastGameClosure("LIVE", 0)).toEqual({
      status: "CANCELLED",
      reason: "auto_expired",
    });
  });

  it("expira jogo com quórum sem contaminar estatísticas", () => {
    expect(decidePastGameClosure("CONFIRMED", 6)).toEqual({
      status: "CANCELLED",
      reason: "auto_expired",
    });
  });

  it("cancela jogo antigo sem quórum", () => {
    expect(decidePastGameClosure("SCHEDULED", 3)).toEqual({
      status: "CANCELLED",
      reason: "auto_expired",
    });
  });

  it("marca revisão quando há evidência suficiente para auditoria", () => {
    expect(summarizeAutoCloseEvidence({
      confirmed_count: 10,
      checked_in_count: 6,
      event_count: 3,
      has_score_evidence: true,
      score_event_consistent: true,
    })).toEqual({
      reviewRequired: true,
      reason: "EVIDENCE_PRESENT_REQUIRES_REVIEW",
    });
  });

  it("auto-cancela sem revisão quando não há evidência material", () => {
    expect(summarizeAutoCloseEvidence({
      confirmed_count: 0,
      checked_in_count: 0,
      event_count: 0,
      has_score_evidence: false,
    })).toEqual({
      reviewRequired: false,
      reason: "NO_EVIDENCE_AUTO_CANCELLED",
    });
  });
});
