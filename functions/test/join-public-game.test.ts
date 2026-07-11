let mockRunTransaction = jest.fn();
let mockDoc = jest.fn();
let mockCheckRateLimit = jest.fn();

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    collection: jest.fn(),
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

class MockHttpsError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
    this.details = details;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

import {
  getPublicCapacityStatuses,
  JOIN_PUBLIC_GAME_RATE_LIMIT,
  joinPublicGame,
} from "../src/games/join-public-game";
import {checkRateLimit} from "../src/middleware/rate-limiter";

describe("join public game capacity", () => {
  test("conta somente CONFIRMED em jogo publico recorrente", () => {
    expect(getPublicCapacityStatuses({
      visibility: "PUBLIC_OPEN",
      recurrence: "weekly",
    })).toEqual(["CONFIRMED"]);
  });

  test("mantem PENDING reservado em jogo publico nao recorrente", () => {
    expect(getPublicCapacityStatuses({
      visibility: "PUBLIC_OPEN",
      recurrence: "none",
    })).toEqual(["CONFIRMED", "PENDING"]);
  });

  test("mantem PENDING reservado em jogo legado publico sem recorrencia", () => {
    expect(getPublicCapacityStatuses({
      is_public: true,
      recurrence: "none",
    })).toEqual(["CONFIRMED", "PENDING"]);
  });
});

describe("joinPublicGame rate limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("bloqueia antes de abrir transacao quando rate limit excede", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30000),
    });

    await expect(joinPublicGame({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "FIELD"},
    }))
      .rejects.toMatchObject({code: "resource-exhausted"});

    expect(checkRateLimit).toHaveBeenCalledWith(
      "user1",
      JOIN_PUBLIC_GAME_RATE_LIMIT
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("rejeita anonimo antes de consumir rate limit", async () => {
    await expect(joinPublicGame({
      auth: null,
      data: {gameId: "game1", position: "FIELD"},
    }))
      .rejects.toMatchObject({code: "unauthenticated"});

    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("rejeita gameId com path injection e posição desconhecida", async () => {
    await expect(joinPublicGame({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1/nested/doc", position: "FIELD"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(joinPublicGame({
      auth: {uid: "user1", token: {verified: true}},
      data: {gameId: "game1", position: "RESERVE"},
    })).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("aplica a mesma verificação ao ingresso público após o grace period", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-04T00:00:00.000Z"));
    try {
      await expect(joinPublicGame({
        auth: {uid: "user1", token: {}},
        data: {gameId: "game1", position: "FIELD"},
      })).rejects.toMatchObject({code: "permission-denied"});
      expect(mockRunTransaction).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
