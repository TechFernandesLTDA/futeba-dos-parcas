const mockRunTransaction = jest.fn();
const mockCollection = jest.fn();
const mockTeamsGet = jest.fn();
const mockEventsGet = jest.fn();
const mockLiveScoreGet = jest.fn();

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
    delete: jest.fn(() => ({_type: "Delete"})),
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
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

const makeDocRef = (collectionName: string, id: string) => ({
  collectionName,
  id,
  path: `${collectionName}/${id}`,
  get:
    collectionName === "live_scores" ?
      mockLiveScoreGet :
      jest.fn(),
});

const makeQuery = (collectionName: string) => ({
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get:
    collectionName === "teams" ?
      mockTeamsGet :
      mockEventsGet,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  mockCollection.mockImplementation((collectionName: string) => ({
    doc: jest.fn((id: string) => makeDocRef(collectionName, id)),
    where: jest.fn(() => makeQuery(collectionName)),
  }));
});

function makeRequest(data: Record<string, unknown> = {}) {
  return {
    auth: {
      uid: "owner1",
      token: {profileComplete: true},
    },
    data: {gameId: "game1", ...data},
  };
}

describe("game lifecycle callables", () => {
  test("startGameLifecycle move jogo CONFIRMED para LIVE e cria live_score", async () => {
    const txUpdate = jest.fn();
    const txSet = jest.fn();

    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({name: "Time A"})},
        {id: "teamB", data: () => ({name: "Time B"})},
      ],
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          owner_id: "owner1",
          status: "CONFIRMED",
        }),
      }),
      update: txUpdate,
      set: txSet,
    }));

    const {startGameLifecycle} = require("../src/games/lifecycle");
    const result = await startGameLifecycle(makeRequest());

    expect(result).toEqual({
      success: true,
      status: "LIVE",
      team1Id: "teamA",
      team2Id: "teamB",
    });
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.objectContaining({
        status: "LIVE",
        team1_name: "Time A",
        team2_name: "Time B",
        team1_score: 0,
        team2_score: 0,
        lifecycle_update_source: "callable",
      })
    );
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "live_scores/game1"}),
      expect.objectContaining({
        game_id: "game1",
        owner_id: "owner1",
        team1_id: "teamA",
        team2_id: "teamB",
      })
    );
  });

  test("finishGameLifecycle agrega eventos e finaliza jogo", async () => {
    const txUpdate = jest.fn();
    const txSet = jest.fn();
    const gameState: Record<string, unknown> = {
      owner_id: "owner1",
      status: "LIVE",
    };

    mockEventsGet.mockResolvedValue({
      docs: [
        {data: () => ({player_id: "p1", type: "GOAL"})},
        {data: () => ({player_id: "p1", type: "ASSIST"})},
        {data: () => ({player_id: "p2", type: "SAVE"})},
      ],
    });
    mockLiveScoreGet.mockResolvedValue({
      exists: true,
      data: () => ({
        team1_score: 2,
        team2_score: 1,
      }),
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({...gameState}),
      }),
      update: jest.fn((ref: {path: string}, updates: Record<string, unknown>) => {
        txUpdate(ref, updates);
        if (ref.path === "games/game1") Object.assign(gameState, updates);
      }),
      set: txSet,
    }));

    const {finishGameLifecycle} = require("../src/games/lifecycle");
    const result = await finishGameLifecycle(makeRequest());

    expect(result).toEqual({
      success: true,
      status: "FINISHED",
      team1Score: 2,
      team2Score: 1,
      aggregatedPlayers: 2,
    });
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/game1_p1"}),
      {goals: 1, assists: 1, saves: 0},
      {merge: true}
    );
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/game1_p2"}),
      {goals: 0, assists: 0, saves: 1},
      {merge: true}
    );
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.objectContaining({
        status: "FINISHED",
        team1_score: 2,
        team2_score: 1,
        lifecycle_update_source: "callable",
      })
    );
  });

  test("finishGameLifecycle não sobrescreve finalização concorrente ativa", async () => {
    const txUpdate = jest.fn();
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          owner_id: "owner1",
          status: "LIVE",
          finalization_id: "active-lock",
          finalization_started_at: {toMillis: () => Date.now()},
        }),
      }),
      update: txUpdate,
      set: jest.fn(),
    }));

    const {finishGameLifecycle} = require("../src/games/lifecycle");
    await expect(finishGameLifecycle(makeRequest())).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(txUpdate).not.toHaveBeenCalled();
  });

  test("finishGameLifecycle libera o lock quando o limite de eventos é excedido", async () => {
    const txUpdate = jest.fn();
    const gameState: Record<string, unknown> = {
      owner_id: "owner1",
      status: "LIVE",
    };
    mockEventsGet.mockResolvedValue({size: 501, docs: []});
    mockLiveScoreGet.mockResolvedValue({
      exists: true,
      data: () => ({team1_score: 0, team2_score: 0}),
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({...gameState}),
      }),
      update: jest.fn((ref: {path: string}, updates: Record<string, unknown>) => {
        txUpdate(ref, updates);
        if (ref.path === "games/game1") Object.assign(gameState, updates);
      }),
      set: jest.fn(),
    }));

    const {finishGameLifecycle} = require("../src/games/lifecycle");
    await expect(finishGameLifecycle(makeRequest())).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(txUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.objectContaining({
        finalization_id: expect.anything(),
        finalization_started_at: expect.anything(),
      })
    );
  });
});
