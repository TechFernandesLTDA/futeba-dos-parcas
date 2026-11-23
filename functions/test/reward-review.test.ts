const mockRunTransaction = jest.fn();
const mockCollection = jest.fn();

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      collection: mockCollection,
      runTransaction: mockRunTransaction,
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  };

  return mockAdmin;
});

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;
    details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "HttpsError";
    }
  },
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  RATE_LIMITS: {
    BATCH_OPERATION: {
      maxRequests: 5,
      windowMs: 60000,
    },
  },
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 4,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  mockCollection.mockImplementation((collectionName: string) => {
    const filters: Array<[string, string, unknown]> = [];
    const query: any = {
      collectionName,
      filters,
      where: jest.fn((field: string, op: string, value: unknown) => {
        filters.push([field, op, value]);
        return query;
      }),
      doc: jest.fn((id: string) => ({
        id,
        path: `${collectionName}/${id}`,
      })),
    };
    return query;
  });
});

const heldGameSnap = {
  exists: true,
  data: () => ({
    status: "FINISHED",
    xp_reward_status: "HELD_FOR_REVIEW",
  }),
};

/**
 * Transação falsa: devolve o jogo para leitura de documento e as
 * confirmações dadas para leitura de consulta.
 */
function mockTx(overlapConfirmations: string[]) {
  const txUpdate = jest.fn();
  const txGet = jest.fn(async (target: any) => {
    if (target?.collectionName === "confirmations") {
      const docs = overlapConfirmations.map((id) => ({
        id,
        ref: {path: `confirmations/${id}`},
      }));
      return {docs, size: docs.length};
    }
    return heldGameSnap;
  });
  mockRunTransaction.mockImplementation(async (callback: any) => callback({
    get: txGet,
    update: txUpdate,
  }));
  return {txGet, txUpdate};
}

function makeRequest(data: Record<string, unknown>) {
  return {
    auth: {
      uid: "admin1",
      token: {role: "ADMIN"},
    },
    data,
  };
}

describe("reviewHeldGameRewards", () => {
  test("aprova jogo retido e registra auditoria", async () => {
    const txUpdate = jest.fn();
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          status: "FINISHED",
          xp_reward_status: "HELD_FOR_REVIEW",
        }),
      }),
      update: txUpdate,
    }));

    const {reviewHeldGameRewards} = require("../src/games/reward-review");
    const result = await reviewHeldGameRewards(makeRequest({
      gameId: "game1",
      action: "APPROVE",
      reason: "Evidências complementares confirmadas pelo administrador.",
    }));

    expect(result).toEqual({
      success: true,
      gameId: "game1",
      action: "APPROVE",
      previousStatus: "HELD_FOR_REVIEW",
      newStatus: "ELIGIBLE",
    });
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.objectContaining({
        xp_reward_status: "ELIGIBLE",
        xp_reward_review_decision: "APPROVED",
        xp_reward_reviewed_by: "admin1",
        xp_reward_review_reason:
          "Evidências complementares confirmadas pelo administrador.",
        xp_reward_review_previous_status:
          "HELD_FOR_REVIEW",
        xp_reward_review_new_status: "ELIGIBLE",
        xp_processing: false,
        xp_processing_error: null,
      })
    );
  });

  test("rejeita jogo retido e marca status final de recusa", async () => {
    const txUpdate = jest.fn();
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          status: "FINISHED",
          xp_reward_status: "HELD_FOR_REVIEW",
        }),
      }),
      update: txUpdate,
    }));

    const {reviewHeldGameRewards} = require("../src/games/reward-review");
    const result = await reviewHeldGameRewards(makeRequest({
      gameId: "game2",
      action: "REJECT",
      reason: "Conjunto probatório insuficiente e localização inconsistente.",
    }));

    expect(result).toEqual({
      success: true,
      gameId: "game2",
      action: "REJECT",
      previousStatus: "HELD_FOR_REVIEW",
      newStatus: "REJECTED_BY_ADMIN",
    });
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game2"}),
      expect.objectContaining({
        xp_reward_status: "REJECTED_BY_ADMIN",
        xp_reward_review_decision: "REJECTED",
        xp_reward_reviewed_by: "admin1",
        xp_processing_error:
          "XP rejected by admin review",
      })
    );
  });

  test("aprovar limpa a marca de sobreposição das confirmações do jogo", async () => {
    const {txGet, txUpdate} = mockTx(["game1_userA", "game1_userB"]);

    const {reviewHeldGameRewards} = require("../src/games/reward-review");
    await reviewHeldGameRewards(makeRequest({
      gameId: "game1",
      action: "APPROVE",
      reason: "Jogadores conferidos: os dois jogos foram em horários diferentes.",
    }));

    const query = txGet.mock.calls
      .map(([target]) => target)
      .find((target: any) => target?.collectionName === "confirmations");
    expect(query?.filters).toEqual([
      ["game_id", "==", "game1"],
      ["suspicious_overlap", "==", true],
    ]);

    for (const id of ["game1_userA", "game1_userB"]) {
      expect(txUpdate).toHaveBeenCalledWith(
        {path: `confirmations/${id}`},
        expect.objectContaining({
          suspicious_overlap: false,
          suspicious_overlap_cleared_by: "admin1",
        })
      );
    }
    // As confirmações e o jogo saem na mesma transação: o reprocessamento
    // disparado pela mudança do jogo já encontra as marcas limpas.
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.objectContaining({xp_reward_status: "ELIGIBLE"})
    );
  });

  test("recusar não mexe nas confirmações", async () => {
    const {txGet, txUpdate} = mockTx(["game2_userA"]);

    const {reviewHeldGameRewards} = require("../src/games/reward-review");
    await reviewHeldGameRewards(makeRequest({
      gameId: "game2",
      action: "REJECT",
      reason: "Conjunto probatório insuficiente e localização inconsistente.",
    }));

    expect(txGet.mock.calls.some(
      ([target]) => (target as any)?.collectionName === "confirmations"
    )).toBe(false);
    expect(txUpdate).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game2"}),
      expect.anything()
    );
  });
});
