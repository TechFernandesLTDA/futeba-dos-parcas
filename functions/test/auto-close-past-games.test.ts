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

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "__SERVER_TIMESTAMP__"),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      __timestamp: date.toISOString(),
    })),
  },
}));

const mockDb = {
  collection: jest.fn(),
  runTransaction: jest.fn(),
};

jest.mock("../src/_db", () => ({
  db: () => mockDb,
}));

jest.mock("../src/game-validation/aggregate", () => {
  const actual = jest.requireActual("../src/game-validation/aggregate");
  return {
    ...actual,
    buildGameValidationFromFirestore: jest.fn(
      actual.buildGameValidationFromFirestore
    ),
  };
});

import {
  PAST_GAME_GRACE_DAYS,
  cancelPastGameIfStillActive,
  closePastGames,
  decidePastGameClosure,
  getPastGameCutoff,
  summarizeAutoCloseEvidence,
} from "../src/games/auto-close-past-games";
import {buildGameValidationFromFirestore} from "../src/game-validation/aggregate";

function makeQueryMock(snapshot: unknown) {
  return {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(snapshot),
  };
}

function hasUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(hasUndefined);
}

describe("auto-close past games helpers", () => {
  beforeEach(() => {
    mockDb.collection.mockReset();
    mockDb.runTransaction.mockReset();
    jest.mocked(buildGameValidationFromFirestore).mockReset();
    jest.mocked(buildGameValidationFromFirestore).mockImplementation(
      jest.requireActual("../src/game-validation/aggregate")
        .buildGameValidationFromFirestore
    );
  });

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

  it("cancela em transação quando o jogo ainda está ativo", async () => {
    const gameRef = {path: "games/game-live"} as FirebaseFirestore.DocumentReference;
    const update = {status: "CANCELLED"};
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({status: "LIVE"}),
      }),
      update: jest.fn(),
    };
    mockDb.runTransaction.mockImplementationOnce(
      async (fn: (txArg: typeof tx) => Promise<boolean>) => fn(tx)
    );

    await expect(cancelPastGameIfStillActive(gameRef, update))
      .resolves.toBe(true);
    expect(tx.get).toHaveBeenCalledWith(gameRef);
    expect(tx.update).toHaveBeenCalledWith(gameRef, update);
  });

  it("nao sobrescreve jogo que virou FINISHED antes do commit", async () => {
    const gameRef = {path: "games/game-finished"} as FirebaseFirestore.DocumentReference;
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({status: "FINISHED"}),
      }),
      update: jest.fn(),
    };
    mockDb.runTransaction.mockImplementationOnce(
      async (fn: (txArg: typeof tx) => Promise<boolean>) => fn(tx)
    );

    await expect(cancelPastGameIfStillActive(gameRef, {status: "CANCELLED"}))
      .resolves.toBe(false);
    expect(tx.get).toHaveBeenCalledWith(gameRef);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("nao grava score_event_consistent undefined no auto-close", async () => {
    const gameRef = {
      path: "games/game-without-score",
    } as FirebaseFirestore.DocumentReference;
    const oldGameDoc = {
      id: "game-without-score",
      ref: gameRef,
      data: () => ({
        status: "LIVE",
        min_players: 6,
        dateTime: new Date("2026-06-18T20:00:00.000Z"),
      }),
    };
    const gamesQuery = makeQueryMock({
      size: 1,
      docs: [oldGameDoc],
    });
    const confirmationsSnaps = [
      {size: 0, docs: []},
      {size: 0, docs: []},
    ];
    const eventsQuery = makeQueryMock({size: 0, docs: []});
    const liveScoresCollection = {
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => undefined,
        }),
      }),
    };
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({status: "LIVE"}),
      }),
      update: jest.fn(),
    };

    mockDb.collection.mockImplementation((collectionName: string) => {
      if (collectionName === "games") return gamesQuery;
      if (collectionName === "confirmations") {
        return makeQueryMock(confirmationsSnaps.shift() ?? {
          size: 0,
          docs: [],
        });
      }
      if (collectionName === "game_events") return eventsQuery;
      if (collectionName === "live_scores") return liveScoresCollection;
      throw new Error(`Unexpected collection: ${collectionName}`);
    });
    mockDb.runTransaction.mockImplementationOnce(
      async (fn: (txArg: typeof tx) => Promise<boolean>) => fn(tx)
    );

    await expect(closePastGames(new Date("2026-06-21T12:00:00.000Z")))
      .resolves.toEqual({
        inspected: 1,
        finished: 0,
        cancelled: 1,
      });

    expect(tx.update).toHaveBeenCalledTimes(1);
    const updatePayload = tx.update.mock.calls[0][1];
    expect(updatePayload.auto_close_validation_signals_summary)
      .not.toHaveProperty("score_event_consistent");
    expect(updatePayload.validation_signals_summary)
      .not.toHaveProperty("score_event_consistent");
    expect(hasUndefined(updatePayload)).toBe(false);
  });

  it("remove undefined defensivamente antes do update no Firestore", async () => {
    const gameRef = {
      path: "games/game-with-optional-validation-gap",
    } as FirebaseFirestore.DocumentReference;
    const oldGameDoc = {
      id: "game-with-optional-validation-gap",
      ref: gameRef,
      data: () => ({
        status: "LIVE",
        min_players: 6,
        dateTime: new Date("2026-06-18T20:00:00.000Z"),
      }),
    };
    const gamesQuery = makeQueryMock({
      size: 1,
      docs: [oldGameDoc],
    });
    const confirmationsSnaps = [
      {size: 0, docs: []},
      {size: 0, docs: []},
    ];
    const eventsQuery = makeQueryMock({size: 0, docs: []});
    const liveScoresCollection = {
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => undefined,
        }),
      }),
    };
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({status: "LIVE"}),
      }),
      update: jest.fn(),
    };

    jest.mocked(buildGameValidationFromFirestore).mockReturnValueOnce({
      validation_status: "LOW_CONFIDENCE",
      validation_score: 42,
      validation_version: 1,
      validation_mode: "SOFT_GATE",
      validation_reasons: ["NO_CHECKINS"],
      validation_signals_summary: {
        confirmed_count: 0,
        checked_in_count: 0,
        checked_in_ratio: 0,
        qr_checkin_count: 0,
        gps_checkin_count: 0,
        event_count: 0,
        score_event_consistent: undefined,
        suspicious_overlap_count: 0,
        impossible_travel_count: 0,
        late_checkin_count: 0,
        manual_presence_count: 0,
        low_confidence_presence_count: 0,
      },
    });

    mockDb.collection.mockImplementation((collectionName: string) => {
      if (collectionName === "games") return gamesQuery;
      if (collectionName === "confirmations") {
        return makeQueryMock(confirmationsSnaps.shift() ?? {
          size: 0,
          docs: [],
        });
      }
      if (collectionName === "game_events") return eventsQuery;
      if (collectionName === "live_scores") return liveScoresCollection;
      throw new Error(`Unexpected collection: ${collectionName}`);
    });
    mockDb.runTransaction.mockImplementationOnce(
      async (fn: (txArg: typeof tx) => Promise<boolean>) => fn(tx)
    );

    await expect(closePastGames(new Date("2026-06-21T12:00:00.000Z")))
      .resolves.toEqual({
        inspected: 1,
        finished: 0,
        cancelled: 1,
      });

    expect(tx.update).toHaveBeenCalledTimes(1);
    const updatePayload = tx.update.mock.calls[0][1];
    expect(updatePayload.auto_close_validation_signals_summary)
      .not.toHaveProperty("score_event_consistent");
    expect(updatePayload.validation_signals_summary)
      .not.toHaveProperty("score_event_consistent");
    expect(hasUndefined(updatePayload)).toBe(false);
  });
});
