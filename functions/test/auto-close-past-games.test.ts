jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
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
});
