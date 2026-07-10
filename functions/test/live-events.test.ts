const mockRunTransaction = jest.fn();
const mockCollection = jest.fn();
const mockTeamsGet = jest.fn();

let generatedEventCounter = 0;

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
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 19,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

function makeDocRef(collectionName: string, id?: string) {
  const resolvedId = id ?? `generated-event-${++generatedEventCounter}`;
  return {
    id: resolvedId,
    path: `${collectionName}/${resolvedId}`,
    collectionName,
  };
}

function makeQuery(collectionName: string) {
  return {
    where: jest.fn().mockReturnThis(),
    get: collectionName === "teams" ? mockTeamsGet : jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  generatedEventCounter = 0;

  mockCollection.mockImplementation((collectionName: string) => ({
    doc: jest.fn((id?: string) => makeDocRef(collectionName, id)),
    where: jest.fn(() => makeQuery(collectionName)),
  }));
});

function makeRequest(data: Record<string, unknown>) {
  return {
    auth: {
      uid: "owner1",
      token: {
        role: "PLAYER",
        profileComplete: true,
      },
    },
    data,
  };
}

function makeSnapshot(data?: Record<string, unknown>) {
  return {
    exists: !!data,
    data: () => data,
  };
}

describe("live game event callables", () => {
  test("submitLiveGameEvent rejeita quando jogo não está LIVE", async () => {
    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });

    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        switch (ref.path) {
          case "games/game1":
            return Promise.resolve(makeSnapshot({
              owner_id: "owner1",
              status: "CONFIRMED",
              co_organizers: [],
            }));
          case "live_scores/game1":
            return Promise.resolve(makeSnapshot({
              team1_id: "teamA",
              team2_id: "teamB",
              team1_score: 0,
              team2_score: 0,
            }));
          case "confirmations/game1_player1":
          case "confirmations/game1_owner1":
            return Promise.resolve(makeSnapshot({
              status: "CONFIRMED",
            }));
          case "live_player_stats/game1_player1":
            return Promise.resolve(makeSnapshot(undefined));
          default:
            return Promise.resolve(makeSnapshot(undefined));
        }
      }),
      set: jest.fn(),
      update: jest.fn(),
    }));

    const {submitLiveGameEvent} = require("../src/games/live-events");

    await expect(
      submitLiveGameEvent(makeRequest({
        gameId: "game1",
        eventType: "GOAL",
        playerId: "player1",
        playerName: "Player 1",
        teamId: "teamA",
        minute: 12,
      })),
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  test("submitLiveGameEvent rejeita evento durante finalização", async () => {
    const txSet = jest.fn();
    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        if (ref.path === "games/game1") {
          return Promise.resolve(makeSnapshot({
            owner_id: "owner1",
            status: "LIVE",
            finalization_id: "finish-lock",
            co_organizers: [],
          }));
        }
        if (ref.path === "live_scores/game1") {
          return Promise.resolve(makeSnapshot({
            team1_id: "teamA",
            team2_id: "teamB",
            team1_score: 0,
            team2_score: 0,
          }));
        }
        return Promise.resolve(makeSnapshot({status: "CONFIRMED"}));
      }),
      set: txSet,
      update: jest.fn(),
    }));

    const {submitLiveGameEvent} = require("../src/games/live-events");
    await expect(submitLiveGameEvent(makeRequest({
      gameId: "game1",
      eventType: "GOAL",
      playerId: "player1",
      playerName: "Player 1",
      teamId: "teamA",
      minute: 90,
    }))).rejects.toMatchObject({code: "failed-precondition"});
    expect(txSet).not.toHaveBeenCalled();
  });

  test("submitLiveGameEvent rejeita jogador fora do time informado", async () => {
    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player9"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });

    const {submitLiveGameEvent} = require("../src/games/live-events");

    await expect(
      submitLiveGameEvent(makeRequest({
        gameId: "game1",
        eventType: "GOAL",
        playerId: "player1",
        playerName: "Player 1",
        teamId: "teamA",
        minute: 12,
      })),
    ).rejects.toMatchObject({
      code: "failed-precondition",
    });
  });

  test("submitLiveGameEvent registra GOAL e atualiza placar/stats no servidor", async () => {
    const txSet = jest.fn();
    const txUpdate = jest.fn();

    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1", "assist1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });

    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        switch (ref.path) {
          case "games/game1":
            return Promise.resolve(makeSnapshot({
              owner_id: "owner1",
              status: "LIVE",
              co_organizers: [],
            }));
          case "live_scores/game1":
            return Promise.resolve(makeSnapshot({
              team1_id: "teamA",
              team2_id: "teamB",
              team1_score: 0,
              team2_score: 0,
            }));
          case "confirmations/game1_player1":
          case "confirmations/game1_owner1":
          case "confirmations/game1_assist1":
            return Promise.resolve(makeSnapshot({
              status: "CONFIRMED",
            }));
          case "live_player_stats/game1_player1":
          case "live_player_stats/game1_assist1":
            return Promise.resolve(makeSnapshot(undefined));
          default:
            return Promise.resolve(makeSnapshot(undefined));
        }
      }),
      set: txSet,
      update: txUpdate,
    }));

    const {submitLiveGameEvent} = require("../src/games/live-events");
    const result = await submitLiveGameEvent(makeRequest({
      gameId: "game1",
      eventType: "GOAL",
      playerId: "player1",
      playerName: "Player 1",
      teamId: "teamA",
      minute: 12,
      assistedById: "assist1",
      assistedByName: "Assist 1",
    }));

    expect(result).toEqual({
      success: true,
      eventId: "generated-event-1",
      team1Score: 1,
      team2Score: 0,
      duplicate: false,
    });
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "game_events/generated-event-1"}),
      expect.objectContaining({
        game_id: "game1",
        event_type: "GOAL",
        player_id: "player1",
        assisted_by_id: "assist1",
      }),
    );
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "live_scores/game1"}),
      expect.objectContaining({
        team1_score: 1,
        team2_score: 0,
      }),
      {merge: true},
    );
    expect(txUpdate).toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.objectContaining({
        team1_score: 1,
        team2_score: 0,
      }),
    );
  });

  test("submitLiveGameEvent é idempotente para o mesmo requestId", async () => {
    const txSet = jest.fn();
    const txUpdate = jest.fn();
    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        if (ref.path === "games/game1") {
          return Promise.resolve(makeSnapshot({
            owner_id: "owner1",
            status: "LIVE",
            co_organizers: [],
          }));
        }
        if (ref.path === "live_scores/game1") {
          return Promise.resolve(makeSnapshot({
            team1_id: "teamA",
            team2_id: "teamB",
            team1_score: 2,
            team2_score: 1,
          }));
        }
        if (ref.path === "confirmations/game1_owner1") {
          return Promise.resolve(makeSnapshot({status: "CONFIRMED"}));
        }
        if (ref.path === "game_events/game1_abcdefgh") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            request_id: "abcdefgh",
            created_by: "owner1",
          }));
        }
        return Promise.resolve(makeSnapshot(undefined));
      }),
      set: txSet,
      update: txUpdate,
    }));

    const {submitLiveGameEvent} = require("../src/games/live-events");
    const result = await submitLiveGameEvent(makeRequest({
      gameId: "game1",
      requestId: "abcdefgh",
      eventType: "GOAL",
      playerId: "player1",
      playerName: "Player 1",
      teamId: "teamA",
      minute: 20,
    }));

    expect(result).toEqual({
      success: true,
      eventId: "game1_abcdefgh",
      team1Score: 2,
      team2Score: 1,
      duplicate: true,
    });
    expect(txSet).not.toHaveBeenCalled();
    expect(txUpdate).not.toHaveBeenCalled();
  });

  test("deleteLiveGameEvent reverte GOAL e remove o evento", async () => {
    const txSet = jest.fn();
    const txUpdate = jest.fn();
    const txDelete = jest.fn();

    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1", "assist1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });

    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        switch (ref.path) {
          case "games/game1":
            return Promise.resolve(makeSnapshot({
              owner_id: "owner1",
              status: "LIVE",
              co_organizers: [],
            }));
          case "game_events/event1":
            return Promise.resolve(makeSnapshot({
              game_id: "game1",
              event_type: "GOAL",
              player_id: "player1",
              team_id: "teamA",
              created_by: "owner1",
              assisted_by_id: "assist1",
            }));
          case "live_scores/game1":
            return Promise.resolve(makeSnapshot({
              team1_id: "teamA",
              team2_id: "teamB",
              team1_score: 2,
              team2_score: 1,
            }));
          case "confirmations/game1_owner1":
            return Promise.resolve(makeSnapshot({
              status: "CONFIRMED",
            }));
          case "confirmations/game1_player1":
            return Promise.resolve(makeSnapshot({
              status: "CONFIRMED",
              goals: 1,
            }));
          case "live_player_stats/game1_player1":
            return Promise.resolve(makeSnapshot({
              goals: 1,
            }));
          case "confirmations/game1_assist1":
            return Promise.resolve(makeSnapshot({
              status: "CONFIRMED",
              assists: 1,
            }));
          case "live_player_stats/game1_assist1":
            return Promise.resolve(makeSnapshot({
              assists: 1,
            }));
          default:
            return Promise.resolve(makeSnapshot(undefined));
        }
      }),
      set: txSet,
      update: txUpdate,
      delete: txDelete,
    }));

    const {deleteLiveGameEvent} = require("../src/games/live-events");
    const result = await deleteLiveGameEvent(makeRequest({
      gameId: "game1",
      eventId: "event1",
    }));

    expect(result).toEqual({
      success: true,
      eventId: "event1",
      team1Score: 1,
      team2Score: 1,
    });
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "live_scores/game1"}),
      expect.objectContaining({
        team1_score: 1,
        team2_score: 1,
      }),
      {merge: true},
    );
    expect(txDelete).toHaveBeenCalledWith(
      expect.objectContaining({path: "game_events/event1"}),
    );
  });

  test("deleteLiveGameEvent rejeita evento pertencente a outro jogo", async () => {
    mockTeamsGet.mockResolvedValue({docs: []});
    const txDelete = jest.fn();
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        if (ref.path === "games/game1") {
          return Promise.resolve(makeSnapshot({
            owner_id: "owner1",
            status: "LIVE",
            co_organizers: [],
          }));
        }
        if (ref.path === "game_events/event-from-game2") {
          return Promise.resolve(makeSnapshot({
            game_id: "game2",
            event_type: "GOAL",
            player_id: "player1",
            team_id: "teamA",
            created_by: "owner1",
          }));
        }
        if (ref.path === "live_scores/game1") {
          return Promise.resolve(makeSnapshot({
            team1_id: "teamA",
            team2_id: "teamB",
            team1_score: 0,
            team2_score: 0,
          }));
        }
        return Promise.resolve(makeSnapshot({status: "CONFIRMED"}));
      }),
      set: jest.fn(),
      update: jest.fn(),
      delete: txDelete,
    }));

    const {deleteLiveGameEvent} = require("../src/games/live-events");
    await expect(deleteLiveGameEvent(makeRequest({
      gameId: "game1",
      eventId: "event-from-game2",
    }))).rejects.toMatchObject({code: "not-found"});
    expect(txDelete).not.toHaveBeenCalled();
  });

  test("isScoreConsistentFromEventStream detecta mismatch", () => {
    const {isScoreConsistentFromEventStream} = require("../src/games/live-events");

    expect(
      isScoreConsistentFromEventStream(
        [
          {data: () => ({type: "GOAL", team_id: "teamA"})},
          {data: () => ({event_type: "GOAL", team_id: "teamA"})},
          {data: () => ({event_type: "GOAL", team_id: "teamB"})},
        ],
        "teamA",
        "teamB",
        2,
        1,
      ),
    ).toBe(true);

    expect(
      isScoreConsistentFromEventStream(
        [{data: () => ({type: "GOAL", team_id: "teamA"})}],
        "teamA",
        "teamB",
        2,
        0,
      ),
    ).toBe(false);
  });
});
