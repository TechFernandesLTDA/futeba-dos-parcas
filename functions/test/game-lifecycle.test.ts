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
  collectionName,
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

  // Sem times por padrão; os testes de placar dos times definem os seus.
  mockTeamsGet.mockResolvedValue({docs: []});
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
      get: jest.fn(async (ref: {path?: string}) => ref.path === "games/game1" ? {
        exists: true,
        data: () => ({
          owner_id: "owner1",
          status: "CONFIRMED",
        }),
      } : mockTeamsGet()),
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
    expect(mockTeamsGet).toHaveBeenCalledTimes(1);
  });

  test("#3942 startGameLifecycle inicializa mapa scores com todos os times (3 times)", async () => {
    const txUpdate = jest.fn();
    const txSet = jest.fn();

    mockTeamsGet.mockResolvedValue({
      docs: [
        {id: "teamA", data: () => ({name: "Time A"})},
        {id: "teamB", data: () => ({name: "Time B"})},
        {id: "teamC", data: () => ({name: "Time C"})},
      ],
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn(async (ref: {path?: string}) => ref.path === "games/game1" ? {
        exists: true,
        data: () => ({owner_id: "owner1", status: "CONFIRMED"}),
      } : mockTeamsGet()),
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
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "live_scores/game1"}),
      expect.objectContaining({
        game_id: "game1",
        owner_id: "owner1",
        // Mapa canônico com os 3 times em 0.
        scores: {teamA: 0, teamB: 0, teamC: 0},
        // Dual-write legado mantido para leitores não atualizados.
        team1_id: "teamA",
        team2_id: "teamB",
        team1_score: 0,
        team2_score: 0,
      })
    );
  });

  describe("times formados no web (bugfix-2026-11-23-times-do-web-iniciam-jogo)", () => {
    function setupStart(
      game: Record<string, unknown>,
      teamDocs: unknown[] = [],
      confirmed: string[] = ["u1", "u2", "u3", "u4", "u5", "u6"],
    ) {
      const txUpdate = jest.fn();
      const txSet = jest.fn();
      mockTeamsGet.mockResolvedValue({docs: teamDocs});
      const confirmationDocs = {
        docs: confirmed.map((uid) => ({data: () => ({user_id: uid, status: "CONFIRMED"})})),
      };
      mockRunTransaction.mockImplementation(async (callback: any) => callback({
        get: jest.fn(async (ref: {path?: string; collectionName?: string}) => {
          if (ref.path === "games/game1") {
            return {
              exists: true,
              data: () => ({owner_id: "owner1", status: "CONFIRMED", ...game}),
            };
          }
          return ref.collectionName === "confirmations" ? confirmationDocs : mockTeamsGet();
        }),
        update: txUpdate,
        set: txSet,
      }));
      return {txUpdate, txSet};
    }

    test("sem documentos em teams, cria os dois times de team1_players/team2_players e inicia", async () => {
      const {txUpdate, txSet} = setupStart({
        team1_players: ["u1", "u2", "u3"],
        team2_players: ["u4", "u5", "u6"],
        team1_name: "Time A",
        team2_name: "Time B",
      });

      const {startGameLifecycle} = require("../src/games/lifecycle");
      const result = await startGameLifecycle(makeRequest());

      expect(result).toEqual({
        success: true,
        status: "LIVE",
        team1Id: "game1_team1",
        team2Id: "game1_team2",
      });
      expect(txSet).toHaveBeenCalledWith(
        expect.objectContaining({path: "teams/game1_team1"}),
        expect.objectContaining({
          id: "game1_team1", game_id: "game1", name: "Time A",
          player_ids: ["u1", "u2", "u3"], score: 0,
        })
      );
      expect(txSet).toHaveBeenCalledWith(
        expect.objectContaining({path: "teams/game1_team2"}),
        expect.objectContaining({
          id: "game1_team2", game_id: "game1", name: "Time B",
          player_ids: ["u4", "u5", "u6"], score: 0,
        })
      );
      expect(txSet).toHaveBeenCalledWith(
        expect.objectContaining({path: "live_scores/game1"}),
        expect.objectContaining({
          scores: {game1_team1: 0, game1_team2: 0},
          team1_id: "game1_team1",
          team2_id: "game1_team2",
        })
      );
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({path: "games/game1"}),
        expect.objectContaining({status: "LIVE"})
      );
    });

    test("com documentos em teams, usa os do app e não cria outros", async () => {
      const {txSet} = setupStart(
        {team1_players: ["u1"], team2_players: ["u2"]},
        [
          {id: "teamA", data: () => ({name: "Azul"})},
          {id: "teamB", data: () => ({name: "Laranja"})},
        ]
      );

      const {startGameLifecycle} = require("../src/games/lifecycle");
      const result = await startGameLifecycle(makeRequest());

      expect(result.team1Id).toBe("teamA");
      const teamWrites = txSet.mock.calls.filter(
        ([ref]: [{path: string}]) => ref.path.startsWith("teams/")
      );
      expect(teamWrites).toHaveLength(0);
    });

    test("jogador sem presença confirmada fica de fora dos times", async () => {
      const {txSet} = setupStart(
        {team1_players: ["u1", "intruso"], team2_players: ["u4", "outro"]},
        [],
        ["u1", "u4"],
      );

      const {startGameLifecycle} = require("../src/games/lifecycle");
      await startGameLifecycle(makeRequest());

      expect(txSet).toHaveBeenCalledWith(
        expect.objectContaining({path: "teams/game1_team1"}),
        expect.objectContaining({player_ids: ["u1"]})
      );
      expect(txSet).toHaveBeenCalledWith(
        expect.objectContaining({path: "teams/game1_team2"}),
        expect.objectContaining({player_ids: ["u4"]})
      );
    });

    test("lado só com quem não confirmou presença é recusado", async () => {
      const {txSet} = setupStart(
        {team1_players: ["u1"], team2_players: ["intruso"]},
        [],
        ["u1"],
      );

      const {startGameLifecycle} = require("../src/games/lifecycle");
      await expect(startGameLifecycle(makeRequest())).rejects.toMatchObject({
        code: "failed-precondition",
      });
      expect(txSet).not.toHaveBeenCalled();
    });

    test("sem jogador num dos lados continua recusando", async () => {
      const {txUpdate, txSet} = setupStart({team1_players: ["u1", "u2"], team2_players: []});

      const {startGameLifecycle} = require("../src/games/lifecycle");
      await expect(startGameLifecycle(makeRequest())).rejects.toMatchObject({
        code: "failed-precondition",
      });
      expect(txUpdate).not.toHaveBeenCalled();
      expect(txSet).not.toHaveBeenCalled();
    });
  });

  test("teamsFromGameRoster limpa ids vazios e repetidos e usa nomes padrão", () => {
    const {teamsFromGameRoster} = require("../src/games/lifecycle");
    const todos = new Set(["u1", "u2", "u3"]);
    expect(teamsFromGameRoster("g", {
      team1_players: ["u1", "", "u1", 7, "u2"],
      team2_players: ["u2", "u3"],
    }, todos)).toEqual([
      {id: "g_team1", name: "Time A", playerIds: ["u1", "u2"]},
      {id: "g_team2", name: "Time B", playerIds: ["u3"]},
    ]);
    expect(teamsFromGameRoster("g", {team1_players: ["u1"]}, todos)).toEqual([]);
  });

  test("start revalida os times na mesma transação do status LIVE", async () => {
    const txUpdate = jest.fn();
    mockTeamsGet.mockResolvedValue({
      docs: [{id: "teamA", data: () => ({name: "Time A"})}],
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn(async (ref: {path?: string}) => ref.path === "games/game1" ? {
        exists: true,
        data: () => ({owner_id: "owner1", status: "CONFIRMED"}),
      } : mockTeamsGet()),
      update: txUpdate,
      set: jest.fn(),
    }));

    const {startGameLifecycle} = require("../src/games/lifecycle");
    await expect(startGameLifecycle(makeRequest())).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(txUpdate).not.toHaveBeenCalled();
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
        {data: () => ({
          player_id: "p1",
          type: "GOAL",
          assisted_by_id: "p2",
        })},
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
      get: jest.fn(async (ref: {path: string}) => ref.path.startsWith("confirmations/") ?
        {exists: true, data: () => ({status: "CONFIRMED"})} :
        {exists: true, data: () => ({...gameState})}),
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
      {goals: 1, assists: 0, saves: 0},
      {merge: true}
    );
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/game1_p2"}),
      {goals: 0, assists: 1, saves: 1},
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

  describe("placar nos documentos de teams (bugfix-2026-11-23-placar-chega-aos-times)", () => {
    function setupFinish(liveScore: Record<string, unknown>, teamIds: string[]) {
      const txUpdate = jest.fn();
      const gameState: Record<string, unknown> = {owner_id: "owner1", status: "LIVE"};
      mockEventsGet.mockResolvedValue({size: 0, docs: []});
      mockLiveScoreGet.mockResolvedValue({exists: true, data: () => liveScore});
      mockTeamsGet.mockResolvedValue({
        docs: teamIds.map((id) => ({id, data: () => ({game_id: "game1"})})),
      });
      mockRunTransaction.mockImplementation(async (callback: any) => callback({
        get: jest.fn(async (ref: {path: string}) => ref.path.startsWith("teams/") ?
          {exists: ref.path !== "teams/apagado", data: () => ({game_id: "game1"})} :
          {exists: true, data: () => ({...gameState})}),
        update: jest.fn((ref: {path: string}, updates: Record<string, unknown>) => {
          txUpdate(ref, updates);
          if (ref.path === "games/game1") Object.assign(gameState, updates);
        }),
        set: jest.fn(),
      }));
      return {txUpdate};
    }

    const teamWrite = (txUpdate: jest.Mock, teamId: string) =>
      txUpdate.mock.calls.find(([ref]: [{path: string}]) => ref.path === `teams/${teamId}`)?.[1];

    test("grava o placar final em cada time, na mesma transação do FINISHED", async () => {
      const {txUpdate} = setupFinish(
        {scores: {teamA: 3, teamB: 1}, team1_id: "teamA", team2_id: "teamB", team1_score: 3, team2_score: 1},
        ["teamA", "teamB"],
      );

      const {finishGameLifecycle} = require("../src/games/lifecycle");
      const result = await finishGameLifecycle(makeRequest());

      expect(result).toMatchObject({status: "FINISHED", team1Score: 3, team2Score: 1});
      expect(teamWrite(txUpdate, "teamA")).toMatchObject({score: 3});
      expect(teamWrite(txUpdate, "teamB")).toMatchObject({score: 1});
      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({path: "games/game1"}),
        expect.objectContaining({status: "FINISHED", team1_score: 3, team2_score: 1}),
      );
    });

    test("jogo de 3 times recebe o placar de cada um pelo mapa scores", async () => {
      const {txUpdate} = setupFinish(
        {scores: {teamA: 2, teamB: 0, teamC: 4}, team1_id: "teamA", team2_id: "teamB"},
        ["teamA", "teamB", "teamC"],
      );

      const {finishGameLifecycle} = require("../src/games/lifecycle");
      await finishGameLifecycle(makeRequest());

      expect(teamWrite(txUpdate, "teamC")).toMatchObject({score: 4});
    });

    test("time apagado durante o jogo não é recriado", async () => {
      const {txUpdate} = setupFinish(
        {scores: {teamA: 1, apagado: 0}, team1_id: "teamA", team2_id: "apagado"},
        ["teamA", "apagado"],
      );

      const {finishGameLifecycle} = require("../src/games/lifecycle");
      await finishGameLifecycle(makeRequest());

      expect(teamWrite(txUpdate, "teamA")).toMatchObject({score: 1});
      expect(teamWrite(txUpdate, "apagado")).toBeUndefined();
    });
  });

  test("finalTeamScores: ids legados e live_scores antigo sem ids", () => {
    const {finalTeamScores} = require("../src/games/lifecycle");
    expect([...finalTeamScores(
      ["t1", "t2", "outro"],
      new Map(),
      {team1Id: "t1", team2Id: "t2", team1Score: 2, team2Score: 5},
    )]).toEqual([["t1", 2], ["t2", 5]]);
    expect([...finalTeamScores(
      ["zeta", "alfa"],
      new Map(),
      {team1Id: "", team2Id: "", team1Score: 1, team2Score: 0},
    )]).toEqual([["alfa", 1], ["zeta", 0]]);
    expect([...finalTeamScores(
      ["a", "b", "c"],
      new Map(),
      {team1Id: "", team2Id: "", team1Score: 1, team2Score: 0},
    )]).toEqual([]);
  });

  test("finish não recria confirmação ausente nem atualiza cancelada", async () => {
    const txSet = jest.fn();
    const gameState: Record<string, unknown> = {
      owner_id: "owner1",
      status: "LIVE",
    };
    mockEventsGet.mockResolvedValue({
      size: 2,
      docs: [
        {data: () => ({player_id: "missing", type: "GOAL"})},
        {data: () => ({player_id: "cancelled", type: "SAVE"})},
      ],
    });
    mockLiveScoreGet.mockResolvedValue({
      exists: true,
      data: () => ({team1_score: 1, team2_score: 0}),
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref.path === "confirmations/game1_missing") {
          return {exists: false, data: () => undefined};
        }
        if (ref.path === "confirmations/game1_cancelled") {
          return {exists: true, data: () => ({status: "CANCELLED"})};
        }
        return {exists: true, data: () => ({...gameState})};
      }),
      update: jest.fn((ref: {path: string}, updates: Record<string, unknown>) => {
        if (ref.path === "games/game1") Object.assign(gameState, updates);
      }),
      set: txSet,
    }));

    const {finishGameLifecycle} = require("../src/games/lifecycle");
    await expect(finishGameLifecycle(makeRequest())).resolves.toMatchObject({
      success: true,
      status: "FINISHED",
    });
    expect(txSet).not.toHaveBeenCalled();
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
