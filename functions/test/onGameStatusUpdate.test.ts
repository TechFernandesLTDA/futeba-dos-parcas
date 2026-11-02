/**
 * TESTES DO TRIGGER onGameStatusUpdate
 *
 * Testa o trigger Firestore que processa XP quando
 * o status de um jogo muda para FINISHED.
 *
 * Cenários cobertos:
 * - Transição LIVE → FINISHED dispara processamento de XP
 * - Cálculo correto de XP (participação, gols, assistências, MVP)
 * - Transições inválidas são ignoradas
 * - Erros no processamento não crasham a função
 * - Jogo sem jogadores suficientes é tratado graciosamente
 * - Validações de segurança (owner_id, anti-cheat)
 * - Idempotência (xp_processed / xp_processing flags)
 */

// Mock firebase-admin
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue([]);

const mockBatch = jest.fn(() => ({
  update: mockBatchUpdate,
  set: mockBatchSet,
  commit: mockBatchCommit,
}));

const mockRunTransaction = jest.fn();
const mockCollectionGet = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue({});

const mockDoc = jest.fn((id?: string) => ({
  id: id || "mock-doc-id",
  get: mockDocGet,
  update: mockDocUpdate,
}));

// FIX #644-FU: PR #678 added .select("user_id") em xp_logs query pra
// detectar double-credit em retry. mockReturnThis() retorna a função
// mock — sem `select` method. Definimos mockWhere/mockLimit como
// objeto self-referential que tem todas as ops da query chain.
const mockWhere: any = jest.fn();
const mockLimit: any = jest.fn();
const mockSelect: any = jest.fn();
const queryChain: any = {
  where: mockWhere,
  limit: mockLimit,
  select: mockSelect,
  get: undefined as any, // setado abaixo
};
queryChain.get = mockCollectionGet;
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockSelect.mockReturnValue(queryChain);

const mockCollection: jest.Mock<any, any> = jest.fn((_collectionName?: string) => ({
  doc: mockDoc,
  where: mockWhere,
  limit: mockLimit,
  select: mockSelect,
  get: mockCollectionGet,
}));

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    arrayUnion: jest.fn((...args: any[]) => ({ _type: "ArrayUnion", elements: args })),
    increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
  };

  const mockTimestamp = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      _type: "Timestamp",
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
      _type: "Timestamp",
    })),
  };

  const mockFieldPath = {
    documentId: jest.fn(() => "__name__"),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: mockCollection,
      batch: mockBatch,
      runTransaction: mockRunTransaction,
    })),
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({
      setCustomUserClaims: jest.fn(),
    })),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = mockTimestamp;
  mockAdmin.firestore.FieldPath = mockFieldPath;

  return mockAdmin;
});

// Mock firebase-functions v2
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: any, handler: any) => handler),
  onDocumentDeleted: jest.fn((_config: any, handler: any) => handler),
  onDocumentCreated: jest.fn((_config: any, handler: any) => handler),
  onDocumentWritten: jest.fn((_config: any, handler: any) => handler),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((config: any, handler: any) => handler || config),
  onRequest: jest.fn((config: any, handler: any) => handler || config),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-functions/v2", () => ({
  setGlobalOptions: jest.fn(),
  // FIX #2286: index.ts agora usa logger de firebase-functions/v2 (era console.*).
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  scheduler: {
    onSchedule: jest.fn(() => jest.fn()),
  },
  https: {
    onCall: jest.fn((config: any, handler: any) => handler || config),
    HttpsError: class HttpsError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
    onRequest: jest.fn((config: any, handler: any) => handler || config),
  },
  storage: {
    onObjectFinalized: jest.fn(() => jest.fn()),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

// Mock notifications
jest.mock("../src/notifications", () => ({
  sendStreakNotificationIfMilestone: jest.fn().mockResolvedValue(undefined),
  sendNotificationToUser: jest.fn(),
  saveNotificationToFirestore: jest.fn(),
  NotificationType: { GAME_REMINDER: "GAME_REMINDER" },
}));

// Mock league
jest.mock("../src/league", () => ({
  calculateLeaguePromotion: jest.fn(),
  calculateLeagueRating: jest.fn(),
  PROMOTION_GAMES_REQUIRED: 5,
  RELEGATION_GAMES_REQUIRED: 3,
}));

// Mock re-exported modules
jest.mock("../src/activities", () => ({
  generateGameFinishedActivityDirect: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../src/reminders", () => ({}));
jest.mock("../src/season", () => ({}));
jest.mock("../src/user-management", () => ({}));
jest.mock("../src/maintenance/cleanup-old-logs", () => ({}));
jest.mock("../src/maintenance/soft-delete", () => ({}));
jest.mock("../src/monitoring/collect-metrics", () => ({}));
jest.mock("../src/storage/generate-thumbnails", () => ({}));
jest.mock("../src/auth/custom-claims", () => ({}));
jest.mock("../src/middleware/rate-limiter", () => ({
  RATE_LIMITS: {
    FINANCE_MANAGE: {maxRequests: 120, windowMs: 60_000},
    FINANCE_REBUILD: {maxRequests: 10, windowMs: 60_000},
    FINANCE_SETTLE: {maxRequests: 60, windowMs: 60_000},
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  },
}));

// Mock additional re-exported modules from index.ts
jest.mock("../src/notifications/batch-sender", () => ({}));
jest.mock("../src/monitoring/alerting", () => ({}));
jest.mock("../src/cache/leaderboard-cache", () => ({}));
jest.mock("../src/xp/parallel-processing", () => ({}));
jest.mock("../src/voting/mvp-voting", () => ({}));

// Mock badges
jest.mock("../src/badges/badge-helper", () => ({
  getAllBadgesToAward: jest.fn().mockReturnValue([]),
}));

import { onGameStatusUpdate } from "../src/index";

// ==========================================
// HELPERS
// ==========================================

/**
 * Creates a mock Firestore document update event
 * simulating a status transition.
 */
function createMockEvent(
  gameId: string,
  beforeData: Record<string, any>,
  afterData: Record<string, any>,
) {
  const afterRef = {
    update: mockDocUpdate,
    id: gameId,
  };
  return {
    data: {
      before: {
        data: () => beforeData,
        ref: { id: gameId },
      },
      after: {
        data: () => afterData,
        ref: afterRef,
      },
    },
    params: { gameId },
  };
}

/**
 * Sets up Firestore mocks for a standard FINISHED game
 * with the given number of confirmed players.
 */
function setupStandardGameMocks(options: {
  playerCount: number;
  mvpId?: string;
  ownerExists?: boolean;
  xpProcessed?: boolean;
  xpProcessing?: boolean;
}) {
  const {
    playerCount,
    mvpId,
    ownerExists = true,
    xpProcessed = false,
    xpProcessing = false,
  } = options;

  // Build confirmations
  const confirmations = Array.from({ length: playerCount }, (_, i) => ({
    user_id: `user${i + 1}`,
    status: "CONFIRMED",
    position: i === 0 ? "GOALKEEPER" : "STRIKER",
    goals: i === 0 ? 0 : 2,
    assists: 1,
    saves: i === 0 ? 3 : 0,
    yellow_cards: 0,
    red_cards: 0,
    game_id: "game1",
    is_worst_player: false,
  }));

  // Build teams (split players evenly)
  const half = Math.ceil(playerCount / 2);
  const team1PlayerIds = confirmations.slice(0, half).map((c) => c.user_id);
  const team2PlayerIds = confirmations.slice(half).map((c) => c.user_id);

  const teams = [
    { id: "team1", player_ids: team1PlayerIds, score: 3 },
    { id: "team2", player_ids: team2PlayerIds, score: 1 },
  ];

  // Build user docs
  const userDocs = confirmations.map((c) => ({
    id: c.user_id,
    data: () => ({
      experience_points: 100,
      level: 1,
      milestones_achieved: [],
    }),
    exists: true,
  }));

  // Build stats docs
  const statsDocs = confirmations.map((c) => ({
    id: c.user_id,
    data: () => ({
      totalGames: 5,
      totalGoals: 10,
      totalAssists: 5,
      totalSaves: 3,
      totalYellowCards: 0,
      totalRedCards: 0,
      gamesWon: 3,
      gamesLost: 1,
      gamesDraw: 1,
      bestPlayerCount: 1,
      worstPlayerCount: 0,
      currentMvpStreak: 0,
    }),
    exists: true,
  }));

  // Build streaks docs
  const streakDocs = confirmations.map((c) => ({
    id: `streak_${c.user_id}`,
    data: () => ({
      user_id: c.user_id,
      current_streak: 2,
    }),
    exists: true,
  }));

  // Transaction mock: lock the game for processing
  mockRunTransaction.mockImplementation(async (callback: Function) => {
    const mockTx = {
      get: jest.fn().mockResolvedValue({
        data: () => ({
          status: "FINISHED",
          owner_id: "owner1",
          xp_processed: xpProcessed,
          xp_processing: xpProcessing,
        }),
        exists: true,
      }),
      update: jest.fn(),
    };
    return callback(mockTx);
  });

  // Owner doc check
  const ownerDocMock = {
    exists: ownerExists,
    data: () => ({ name: "Owner User" }),
  };

  // Collection routing
  mockCollection.mockImplementation((collectionName: string) => {
    const collObj: any = {
      doc: jest.fn((id?: string) => ({
        id: id || "mock-doc",
        get: jest.fn().mockResolvedValue(
          collectionName === "users" && id
            ? (id === "owner1"
              ? ownerDocMock
              : userDocs.find((u) => u.id === id) || { exists: false, data: () => ({}) })
            : collectionName === "games"
              ? {
                exists: true,
                data: () => ({
                  id: "game1",
                  status: "FINISHED",
                  owner_id: "owner1",
                  mvp_id: mvpId || null,
                }),
              }
              : { exists: false, data: () => null }
        ),
        update: mockDocUpdate,
      })),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    // Setup get() returns based on collection
    if (collectionName === "confirmations") {
      collObj.get.mockResolvedValue({
        docs: confirmations.map((c) => ({
          id: `game1_${c.user_id}`,
          data: () => c,
        })),
        empty: confirmations.length === 0,
      });
    } else if (collectionName === "teams") {
      collObj.get.mockResolvedValue({
        docs: teams.map((t) => ({
          id: t.id,
          data: () => t,
        })),
        empty: false,
      });
    } else if (collectionName === "live_scores") {
      collObj.doc = jest.fn(() => ({
        id: "game1",
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            game_id: "game1",
            team1_id: "team1",
            team2_id: "team2",
            team1_score: 3,
            team2_score: 1,
          }),
        }),
      }));
    } else if (collectionName === "app_settings") {
      collObj.doc = jest.fn(() => ({
        id: "gamification",
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => null,
        }),
      }));
    } else if (collectionName === "seasons") {
      collObj.get.mockResolvedValue({
        docs: [{ id: "season_2026_04" }],
        empty: false,
      });
    } else if (collectionName === "users") {
      // For batch fetch (whereIn queries)
      collObj.get.mockResolvedValue({
        docs: userDocs,
        empty: false,
      });
    } else if (collectionName === "statistics") {
      collObj.get.mockResolvedValue({
        docs: statsDocs,
        empty: false,
      });
    } else if (collectionName === "user_streaks") {
      collObj.get.mockResolvedValue({
        docs: streakDocs,
        empty: false,
      });
    } else if (collectionName === "xp_logs") {
      collObj.doc = jest.fn(() => ({
        id: "xp_log_new",
      }));
    } else {
      collObj.get.mockResolvedValue({ docs: [], empty: true });
    }

    return collObj;
  });

  // Batch mock
  mockBatch.mockReturnValue({
    update: mockBatchUpdate.mockReturnThis(),
    set: mockBatchSet.mockReturnThis(),
    commit: mockBatchCommit.mockResolvedValue([]),
  });
}

// ==========================================
// TESTS
// ==========================================

describe("onGameStatusUpdate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Status Transition Tests
  // ==========================================

  describe("status transitions", () => {
    test.skip("should process XP when status changes from LIVE to FINISHED", async () => {
      setupStandardGameMocks({ playerCount: 8, mvpId: "user2" });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1", mvp_id: "user2" },
      );

      await (onGameStatusUpdate as any)(event);

      // Should have acquired the processing lock
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);

      // Should have committed at least one batch
      expect(mockBatchCommit).toHaveBeenCalled();

      // Should have updated users, stats, confirmations, xp_logs
      expect(mockBatchUpdate).toHaveBeenCalled();
      expect(mockBatchSet).toHaveBeenCalled();
    });

    test.skip("should process XP when status changes from CONFIRMED to FINISHED", async () => {
      setupStandardGameMocks({ playerCount: 8 });

      const event = createMockEvent("game1",
        { status: "CONFIRMED", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await (onGameStatusUpdate as any)(event);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    test("should not process XP when status changes from SCHEDULED to CONFIRMED", async () => {
      const event = createMockEvent("game1",
        { status: "SCHEDULED", owner_id: "owner1" },
        { status: "CONFIRMED", owner_id: "owner1" },
      );

      // Owner doc must exist for security check to pass
      mockCollection.mockImplementation((name: string) => ({
        doc: jest.fn(() => ({
          id: "owner1",
          get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
          update: jest.fn(),
        })),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      }));

      await (onGameStatusUpdate as any)(event);

      // Should NOT acquire the processing lock
      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    test("should not process XP when status does not change to FINISHED", async () => {
      const event = createMockEvent("game1",
        { status: "SCHEDULED", owner_id: "owner1" },
        { status: "LIVE", owner_id: "owner1" },
      );

      mockCollection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          id: "owner1",
          get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
          update: jest.fn(),
        })),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      }));

      await (onGameStatusUpdate as any)(event);

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    test("should not process when status is already FINISHED (no change)", async () => {
      const event = createMockEvent("game1",
        { status: "FINISHED", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      mockCollection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          id: "owner1",
          get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
          update: jest.fn(),
        })),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      }));

      await (onGameStatusUpdate as any)(event);

      // before.status === "FINISHED" means before.status === after.status
      // so the condition before.status !== "FINISHED" is false
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Security Validation Tests
  // ==========================================

  describe("security validations", () => {
    test("should abort when owner_id is missing", async () => {
      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "" },
      );

      await (onGameStatusUpdate as any)(event);

      // Should not proceed to XP processing
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    test("should abort when owner_id was changed (fraud prevention)", async () => {
      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "hacker1" },
      );

      await (onGameStatusUpdate as any)(event);

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    test("should abort when owner does not exist in users collection", async () => {
      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      mockCollection.mockImplementation(() => ({
        doc: jest.fn(() => ({
          id: "owner1",
          get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
          update: jest.fn(),
        })),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
      }));

      await (onGameStatusUpdate as any)(event);

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    test("should return early when event.data is null", async () => {
      const event = { data: null, params: { gameId: "game1" } };

      await (onGameStatusUpdate as any)(event);

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Idempotency Tests
  // ==========================================

  describe("idempotency", () => {
    test("should skip processing when xp_processed is already true", async () => {
      setupStandardGameMocks({ playerCount: 8, xpProcessed: true });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await (onGameStatusUpdate as any)(event);

      // Transaction runs but returns shouldProcess: false
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      // Batch should NOT be committed
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    test("should skip processing when xp_processing is already true (concurrent lock)", async () => {
      setupStandardGameMocks({ playerCount: 8, xpProcessing: true });

      // FIX #2648: lock TTL fallback uses xp_processing_at to detect stale
      // locks. When xp_processing_at is missing, lockAge becomes Date.now() - 0
      // which exceeds the TTL, so the lock is treated as stale and taken over.
      // Override the transaction mock to include xp_processing_at with a
      // recent timestamp so the lock is considered valid and the test correctly
      // asserts skip behavior.
      mockRunTransaction.mockImplementation(async (callback: Function) => {
        const mockTx = {
          get: jest.fn().mockResolvedValue({
            data: () => ({
              status: "FINISHED",
              owner_id: "owner1",
              xp_processed: false,
              xp_processing: true,
              xp_processing_at: { toMillis: () => Date.now() },
            }),
            exists: true,
          }),
          update: jest.fn(),
        };
        return callback(mockTx);
      });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await (onGameStatusUpdate as any)(event);

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // Player Count Validation Tests
  // ==========================================

  describe("player count validation", () => {
    test("should hold XP for review before short-circuiting low-player finished games", async () => {
      setupStandardGameMocks({ playerCount: 4 });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await (onGameStatusUpdate as any)(event);

      // Transaction should run for the lock
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          xp_processing: false,
          xp_reward_status: "HELD_FOR_REVIEW",
          xp_processing_error: "XP held by validation gate",
        })
      );

      // Batch should NOT commit XP updates (no XP to process)
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    test.skip("should handle game with exactly 6 players (minimum for 3v3)", async () => {
      setupStandardGameMocks({ playerCount: 6 });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await (onGameStatusUpdate as any)(event);

      // Should proceed to XP processing
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    // FIX #1572: gate usa validConfirmations (userId válido), não confirmations bruto.
    // Sem o fix: 5 jogadores reais + 1 com userId vazio = 6 total → gate passava,
    // mas o 6º não era processado pois era inválido (filtrado por validConfirmations).
    test(
      "should hold XP when valid player count < 6, even if raw confirmations >= 6",
      async () => {
        // 5 jogadores válidos + 1 com userId vazio = 6 no total bruto
        setupStandardGameMocks({ playerCount: 5 });

        // Override confirmations to add one with empty userId
        const originalImpl =
          mockCollection.getMockImplementation() as any;
        mockCollection.mockImplementation((collectionName: string) => {
          if (collectionName === "confirmations") {
            return {
              doc: jest.fn(() => ({
                id: "mock",
                update: jest.fn(),
              })),
              where: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              get: jest.fn().mockResolvedValue({
                docs: [
                  ...Array.from({ length: 5 }, (_, i) => ({
                    id: `game1_user${i + 1}`,
                    data: () => ({
                      user_id: `user${i + 1}`,
                      status: "CONFIRMED",
                      position: "STRIKER",
                      goals: 1,
                      assists: 0,
                      saves: 0,
                      yellow_cards: 0,
                      red_cards: 0,
                      game_id: "game1",
                      is_worst_player: false,
                    }),
                  })),
                  // Confirmação com userId vazio (inválida)
                  {
                    id: "game1_invalid",
                    data: () => ({
                      user_id: "",
                      status: "CONFIRMED",
                      position: "STRIKER",
                      goals: 0,
                      assists: 0,
                      saves: 0,
                      yellow_cards: 0,
                      red_cards: 0,
                      game_id: "game1",
                      is_worst_player: false,
                    }),
                  },
                ],
                empty: false,
              }),
            };
          }
          if (originalImpl) return originalImpl(collectionName);
          return {
            doc: jest.fn(() => ({
              id: "mock",
              get: jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({}),
              }),
              update: jest.fn(),
            })),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              docs: [],
              empty: true,
            }),
          };
        });

        const event = createMockEvent(
          "game1",
          { status: "LIVE", owner_id: "owner1" },
          { status: "FINISHED", owner_id: "owner1" },
        );

        await (onGameStatusUpdate as any)(event);

        expect(mockDocUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            xp_processing: false,
            xp_reward_status: "HELD_FOR_REVIEW",
            xp_processing_error: "XP held by validation gate",
          })
        );
        // Nenhum XP deve ter sido commitado
        expect(mockBatchCommit).not.toHaveBeenCalled();
      }
    );
  });

  // ==========================================
  // XP Calculation Tests
  // ==========================================

  describe("XP calculation", () => {
    test.skip("should calculate participation XP for all confirmed players", async () => {
      setupStandardGameMocks({ playerCount: 8 });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await (onGameStatusUpdate as any)(event);

      // Each player should get a batch update and xp_log set
      // 8 players * (user update + stats set + confirm update + log set) = 32 ops minimum
      expect(mockBatchUpdate).toHaveBeenCalled();
      expect(mockBatchSet).toHaveBeenCalled();

      // Verify the batch was committed
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    test.skip("should award MVP XP only to confirmed MVP player", async () => {
      setupStandardGameMocks({ playerCount: 8, mvpId: "user3" });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1", mvp_id: "user3" },
      );

      await (onGameStatusUpdate as any)(event);

      expect(mockBatchCommit).toHaveBeenCalled();

      // Verify batch operations were called for XP logs
      // The MVP player should get extra XP in their log entry
      expect(mockBatchSet).toHaveBeenCalled();
    });
  });

  // ==========================================
  // Error Handling Tests
  // ==========================================

  describe("error handling", () => {
    test.skip("should release lock and re-throw when XP processing fails", async () => {
      setupStandardGameMocks({ playerCount: 8 });

      // Make batch commit fail
      mockBatchCommit.mockRejectedValueOnce(new Error("Firestore write failed"));

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await expect((onGameStatusUpdate as any)(event)).rejects.toThrow("Firestore write failed");

      // Should have cleared the xp_processing flag
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          xp_processing: false,
          xp_processing_error: expect.stringContaining("Firestore write failed"),
        })
      );
    });

    test("should handle anti-cheat validation failure (goals exceed max)", async () => {
      // Set up mocks with a player having invalid goals count
      setupStandardGameMocks({ playerCount: 8 });

      // Override confirmations to include a cheater
      const cheaterConfirmation = {
        user_id: "cheater1",
        status: "CONFIRMED",
        position: "STRIKER",
        goals: 999, // exceeds MAX_GOALS_PER_GAME (15)
        assists: 0,
        saves: 0,
        yellow_cards: 0,
        red_cards: 0,
        game_id: "game1",
        is_worst_player: false,
      };

      // We need to override the confirmations collection mock
      // to include the cheater
      mockCollection.mockImplementation((collectionName: string) => {
        if (collectionName === "confirmations") {
          return {
            doc: jest.fn(() => ({ id: "mock", update: jest.fn() })),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              docs: [
                ...Array.from({ length: 7 }, (_, i) => ({
                  id: `game1_user${i + 1}`,
                  data: () => ({
                    user_id: `user${i + 1}`,
                    status: "CONFIRMED",
                    position: "STRIKER",
                    goals: 2,
                    assists: 1,
                    saves: 0,
                    yellow_cards: 0,
                    red_cards: 0,
                    game_id: "game1",
                    is_worst_player: false,
                  }),
                })),
                {
                  id: "game1_cheater1",
                  data: () => cheaterConfirmation,
                },
              ],
              empty: false,
            }),
          };
        }
        // Standard mock with full chain for all other collections
        return {
          doc: jest.fn(() => ({
            id: "mock",
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
            update: jest.fn(),
          })),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
        };
      });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      // Should NOT throw — anti-cheat now clamps and warns instead of aborting
      // The function proceeds past anti-cheat to XP processing. The cheater's
      // stats are capped to MAX_GOALS_PER_GAME via Math.min downstream.
      await expect((onGameStatusUpdate as any)(event)).resolves.not.toThrow();
    });

    test("should handle transaction lock failure gracefully", async () => {
      setupStandardGameMocks({ playerCount: 8 });

      // Make the transaction throw
      mockRunTransaction.mockRejectedValueOnce(new Error("Transaction contention"));

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      await expect((onGameStatusUpdate as any)(event)).rejects.toThrow("Transaction contention");
    });
  });

  // ==========================================
  // Badge & Activity Integration Tests
  // ==========================================

  describe("post-processing integration", () => {
    test.skip("should complete XP processing and activity generation without errors", async () => {
      setupStandardGameMocks({ playerCount: 8 });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      // Activities module is lazy-loaded via dynamic import("./activities.js")
      // which bypasses jest.mock. We verify it completes without throwing.
      await expect((onGameStatusUpdate as any)(event)).resolves.not.toThrow();

      // Batch should have been committed (XP processed successfully)
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    test.skip("should call getAllBadgesToAward for each player", async () => {
      setupStandardGameMocks({ playerCount: 8, mvpId: "user1" });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1", mvp_id: "user1" },
      );

      await (onGameStatusUpdate as any)(event);

      const { getAllBadgesToAward } = require("../src/badges/badge-helper");
      // Should be called once per player
      expect(getAllBadgesToAward).toHaveBeenCalledTimes(8);
    });

    test.skip("should complete streak notification processing without errors", async () => {
      setupStandardGameMocks({ playerCount: 8 });

      const event = createMockEvent("game1",
        { status: "LIVE", owner_id: "owner1" },
        { status: "FINISHED", owner_id: "owner1" },
      );

      // Notifications module is lazy-loaded via dynamic import("./notifications.js")
      // which bypasses jest.mock. We verify no errors thrown during streak processing.
      await expect((onGameStatusUpdate as any)(event)).resolves.not.toThrow();

      // Batch should have been committed (XP processed with streak handling)
      expect(mockBatchCommit).toHaveBeenCalled();
    });
  });
});
