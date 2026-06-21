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

  it("finaliza jogo LIVE mesmo sem quórum", () => {
    expect(decidePastGameClosure("LIVE", 0)).toEqual({
      status: "FINISHED",
      reason: "played_or_live",
    });
  });

  it("finaliza jogo com quórum confirmado", () => {
    expect(decidePastGameClosure("CONFIRMED", 6)).toEqual({
      status: "FINISHED",
      reason: "played_or_live",
    });
  });

  it("cancela jogo antigo sem quórum", () => {
    expect(decidePastGameClosure("SCHEDULED", 3)).toEqual({
      status: "CANCELLED",
      reason: "low_quorum",
    });
  });
});
