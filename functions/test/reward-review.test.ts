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

  mockCollection.mockImplementation((collectionName: string) => ({
    doc: jest.fn((id: string) => ({
      id,
      path: `${collectionName}/${id}`,
    })),
  }));
});

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
});
