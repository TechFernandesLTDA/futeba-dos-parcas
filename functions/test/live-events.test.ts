const mockRunTransaction = jest.fn();
const mockCollection = jest.fn();
const mockTeamsGet = jest.fn();
const mockDirectGet = jest.fn();

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
    increment: jest.fn((value: number) => ({_type: "Increment", value})),
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
    get: jest.fn(() => mockDirectGet(`${collectionName}/${resolvedId}`)),
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
  mockDirectGet.mockImplementation((path: string) => {
    if (path.startsWith("live_scores/")) {
      return Promise.resolve(makeSnapshot({
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: 0,
        team2_score: 0,
      }));
    }
    return Promise.resolve(makeSnapshot(undefined));
  });

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
          case "teams/teamA":
            return Promise.resolve(makeSnapshot({
              game_id: "game1",
              player_ids: ["player1"],
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
        if (ref.path === "teams/teamA") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            player_ids: ["player1"],
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

  test("submit rejeita roster removido dentro da transação mesmo com snapshot antigo", async () => {
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
            team1_score: 0,
            team2_score: 0,
          }));
        }
        if (ref.path === "teams/teamA") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            player_ids: ["player9"],
          }));
        }
        return Promise.resolve(makeSnapshot({status: "CONFIRMED"}));
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
    expect(mockTeamsGet).not.toHaveBeenCalled();
  });

  test("submitLiveGameEvent rejeita autoassistência", async () => {
    const {submitLiveGameEvent} = require("../src/games/live-events");

    await expect(submitLiveGameEvent(makeRequest({
      gameId: "game1",
      eventType: "GOAL",
      playerId: "player1",
      playerName: "Player 1",
      teamId: "teamA",
      assistedById: "player1",
      assistedByName: "Player 1",
    }))).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockTeamsGet).not.toHaveBeenCalled();
  });

  test("submitLiveGameEvent registra GOAL com projeção atômica sem atualizar games", async () => {
    const txSet = jest.fn();
    const txUpdate = jest.fn();

    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1", "assist1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });
    mockDirectGet
      .mockResolvedValueOnce(makeSnapshot({
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: 0,
        team2_score: 0,
      }))
      .mockResolvedValueOnce(makeSnapshot({
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: 1,
        team2_score: 0,
      }));

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
          case "teams/teamA":
            return Promise.resolve(makeSnapshot({
              game_id: "game1",
              player_ids: ["player1", "assist1"],
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
        score_field: "team1_score",
      }),
    );
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "live_scores/game1"}),
      expect.objectContaining({
        team1_score: expect.anything(),
      }),
      {merge: true},
    );
    expect(txUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({path: "games/game1"}),
      expect.anything(),
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
    mockDirectGet.mockResolvedValue(makeSnapshot({
      team1_id: "teamA",
      team2_id: "teamB",
      team1_score: 2,
      team2_score: 1,
    }));
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
        if (ref.path === "teams/teamA") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            player_ids: ["player1"],
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
            event_type: "GOAL",
            player_id: "player1",
            team_id: "teamA",
            minute: 20,
            assisted_by_id: null,
          }));
        }
        if (ref.path === "teams/teamA") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            player_ids: ["player1"],
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

  test("submitLiveGameEvent rejeita requestId reutilizado com outro conteúdo", async () => {
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
            co_organizers: [],
          }));
        }
        if (ref.path === "live_scores/game1") {
          return Promise.resolve(makeSnapshot({
            team1_id: "teamA",
            team2_id: "teamB",
            team1_score: 1,
            team2_score: 0,
          }));
        }
        if (ref.path === "teams/teamA") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            player_ids: ["player1"],
          }));
        }
        if (ref.path === "game_events/game1_abcdefgh") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            request_id: "abcdefgh",
            created_by: "owner1",
            event_type: "GOAL",
            player_id: "player1",
            team_id: "teamA",
            minute: 10,
            assisted_by_id: null,
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
      requestId: "abcdefgh",
      eventType: "GOAL",
      playerId: "player1",
      playerName: "Player 1",
      teamId: "teamA",
      minute: 11,
    }))).rejects.toMatchObject({code: "already-exists"});
    expect(txSet).not.toHaveBeenCalled();
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
    mockDirectGet
      .mockResolvedValueOnce(makeSnapshot({
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: 2,
        team2_score: 1,
      }))
      .mockResolvedValueOnce(makeSnapshot({
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: 1,
        team2_score: 1,
      }));

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
              score_field: "team1_score",
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
        team1_score: expect.anything(),
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

  test("deleteLiveGameEvent não deixa placar negativo nem recria stats ausentes", async () => {
    const txSet = jest.fn();
    const txDelete = jest.fn();
    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });
    mockDirectGet.mockResolvedValue(makeSnapshot({
      team1_id: "teamA",
      team2_id: "teamB",
      team1_score: 0,
      team2_score: 0,
    }));
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn((ref: {path: string}) => {
        if (ref.path === "games/game1") {
          return Promise.resolve(makeSnapshot({
            owner_id: "owner1",
            status: "LIVE",
            co_organizers: [],
          }));
        }
        if (ref.path === "game_events/event1") {
          return Promise.resolve(makeSnapshot({
            game_id: "game1",
            event_type: "GOAL",
            player_id: "player1",
            team_id: "teamA",
            score_field: "team1_score",
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
        if (ref.path === "confirmations/game1_owner1") {
          return Promise.resolve(makeSnapshot({status: "CONFIRMED"}));
        }
        return Promise.resolve(makeSnapshot(undefined));
      }),
      set: txSet,
      update: jest.fn(),
      delete: txDelete,
    }));

    const {deleteLiveGameEvent} = require("../src/games/live-events");
    await deleteLiveGameEvent(makeRequest({gameId: "game1", eventId: "event1"}));

    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "live_scores/game1"}),
      expect.objectContaining({team1_score: 0}),
      {merge: true},
    );
    expect(txSet).not.toHaveBeenCalledWith(
      expect.objectContaining({path: "live_player_stats/game1_player1"}),
      expect.anything(),
      expect.anything(),
    );
    expect(txSet).not.toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/game1_player1"}),
      expect.anything(),
      expect.anything(),
    );
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

  test("rajadas preservam exatamente 100 eventos no mesmo jogo e 1000 em 50 jogos", async () => {
    const events = new Map<string, Record<string, unknown>>();
    const scores = new Map<string, number>();
    let transactionQueue = Promise.resolve();

    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({player_ids: ["player1"]})},
        {id: "teamB", data: () => ({player_ids: ["player2"]})},
      ],
    });
    mockDirectGet.mockImplementation((path: string) => {
      const gameId = path.split("/")[1];
      return Promise.resolve(makeSnapshot({
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: scores.get(gameId) ?? 0,
        team2_score: 0,
      }));
    });
    mockRunTransaction.mockImplementation((callback: any) => {
      const run = transactionQueue.then(async () => callback({
        get: jest.fn((ref: {path: string}) => {
          if (ref.path.startsWith("games/")) {
            return Promise.resolve(makeSnapshot({
              owner_id: "owner1",
              status: "LIVE",
              co_organizers: [],
            }));
          }
          if (ref.path.startsWith("game_events/")) {
            return Promise.resolve(makeSnapshot(events.get(ref.path)));
          }
          if (ref.path.startsWith("confirmations/")) {
            return Promise.resolve(makeSnapshot({status: "CONFIRMED"}));
          }
          if (ref.path.startsWith("live_scores/")) {
            const gameId = ref.path.split("/")[1];
            return Promise.resolve(makeSnapshot({
              team1_id: `${gameId}-teamA`,
              team2_id: `${gameId}-teamB`,
              team1_score: scores.get(gameId) ?? 0,
              team2_score: 0,
            }));
          }
          if (ref.path.startsWith("teams/") && ref.path.endsWith("-teamA")) {
            const teamId = ref.path.split("/")[1];
            const gameId = teamId.slice(0, -"-teamA".length);
            return Promise.resolve(makeSnapshot({
              game_id: gameId,
              player_ids: ["player1"],
            }));
          }
          return Promise.resolve(makeSnapshot(undefined));
        }),
        set: jest.fn((ref: {path: string}, data: Record<string, unknown>) => {
          if (ref.path.startsWith("game_events/")) {
            events.set(ref.path, data);
          } else if (
            ref.path.startsWith("live_scores/") &&
            data.team1_score !== undefined
          ) {
            const gameId = ref.path.split("/")[1];
            scores.set(gameId, (scores.get(gameId) ?? 0) + 1);
          }
        }),
        update: jest.fn(),
      }));
      transactionQueue = run.then(() => undefined, () => undefined);
      return run;
    });

    const {submitLiveGameEvent} = require("../src/games/live-events");
    const submit = (gameId: string, requestId: string) =>
      submitLiveGameEvent(makeRequest({
        gameId,
        requestId,
        eventType: "GOAL",
        playerId: "player1",
        playerName: "Player 1",
        teamId: `${gameId}-teamA`,
      }));

    const sameGameIds = Array.from(
      {length: 100},
      (_, index) => `same${index.toString().padStart(5, "0")}`,
    );
    await Promise.all([
      ...sameGameIds.map((requestId) => submit("hot-game", requestId)),
      ...sameGameIds.map((requestId) => submit("hot-game", requestId)),
    ]);
    expect(scores.get("hot-game")).toBe(100);
    expect(
      [...events.keys()].filter((path) => path.includes("hot-game_")),
    ).toHaveLength(100);

    await Promise.all(Array.from({length: 1000}, (_, index) => {
      const gameId = `game-${index % 50}`;
      return submit(
        gameId,
        `bulk${index.toString().padStart(5, "0")}`,
      );
    }));

    for (let gameIndex = 0; gameIndex < 50; gameIndex += 1) {
      expect(scores.get(`game-${gameIndex}`)).toBe(20);
    }
    expect(events.size).toBe(1100);
  }, 30000);
});
