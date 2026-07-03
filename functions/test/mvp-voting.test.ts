/**
 * TESTES DO SISTEMA DE VOTAÇÃO MVP
 *
 * Testa as Cloud Functions de mvp-voting.ts:
 * - submitMvpVote: Submissão atômica de votos
 * - concludeMvpVoting: Contagem e encerramento
 */

// Mock do firebase-admin
const mockRunTransaction = jest.fn();
const mockCollectionGet = jest.fn();
const mockDocGet = jest.fn();

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    increment: jest.fn((value: number) => ({ _type: "Increment", value })),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockDocGet,
        }),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: mockCollectionGet,
      }),
      runTransaction: mockRunTransaction,
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  };

  return mockAdmin;
});

// Mock firebase-functions v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((configOrHandler: any, handler?: any) => {
    return handler || configOrHandler;
  }),
  HttpsError: class HttpsError extends Error {
    code: string;
    details: any;
    constructor(code: string, message: string, details?: any) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "HttpsError";
    }
  },
}));

// Mock rate-limiter (obrigatório por CLAUDE.md)
jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 19,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

// Mock constants
jest.mock("../src/constants", () => ({
  MVP_VOTE_WINDOW_HOURS: 24,
  XP_ACTIONS: {
    MVP: 30,
    WORST_PLAYER: -10,
  },
  LEVEL_TABLE: {
    levels: [
      {level: 0, name: "Novato", xpRequired: 0},
      {level: 1, name: "Iniciante", xpRequired: 100},
      {level: 2, name: "Amador", xpRequired: 300},
      {level: 3, name: "Intermediario", xpRequired: 750},
      {level: 4, name: "Avancado", xpRequired: 1500},
      {level: 5, name: "Profissional", xpRequired: 2800},
      {level: 6, name: "Elite", xpRequired: 5000},
      {level: 7, name: "Mestre", xpRequired: 8500},
      {level: 8, name: "Lenda Viva", xpRequired: 14000},
      {level: 9, name: "Craque", xpRequired: 22000},
      {level: 10, name: "GOAT", xpRequired: 35000},
      {level: 11, name: "Extra 11", xpRequired: 52850},
      {level: 12, name: "Extra 12", xpRequired: 80000},
      {level: 13, name: "Extra 13", xpRequired: 120000},
      {level: 14, name: "Extra 14", xpRequired: 180000},
      {level: 15, name: "Extra 15", xpRequired: 250000},
      {level: 16, name: "Extra 16", xpRequired: 350000},
      {level: 17, name: "Extra 17", xpRequired: 500000},
      {level: 18, name: "Extra 18", xpRequired: 700000},
      {level: 19, name: "Extra 19", xpRequired: 1000000},
      {level: 20, name: "Lendario", xpRequired: 1500000},
    ],
  },
  MAX_XP_PER_GAME: 100,
  MIN_XP_PER_GAME: -100,
}));

// Capturar handlers registrados pelo onCall
let submitMvpVoteHandler: ((request: any) => Promise<any>) | null = null;
let submitMvpVotesHandler: ((request: any) => Promise<any>) | null = null;
let concludeMvpVotingHandler: ((request: any) => Promise<any>) | null = null;

const { onCall } = require("firebase-functions/v2/https");

beforeAll(() => {
  // Registrar os dois handlers na ordem de importação
  (onCall as jest.Mock).mockImplementationOnce((_config: any, handler: any) => {
    submitMvpVoteHandler = handler || _config;
    return submitMvpVoteHandler;
  });
  (onCall as jest.Mock).mockImplementationOnce((_config: any, handler: any) => {
    submitMvpVotesHandler = handler || _config;
    return submitMvpVotesHandler;
  });
  (onCall as jest.Mock).mockImplementationOnce((_config: any, handler: any) => {
    concludeMvpVotingHandler = handler || _config;
    return concludeMvpVotingHandler;
  });

  jest.isolateModules(() => {
    require("../src/voting/mvp-voting");
  });
});

// ==========================================
// HELPERS
// ==========================================

/** Cria um jogo FINISHED dentro da janela de votação */
function makeFinishedGame(overrides: Record<string, unknown> = {}) {
  const gameDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h atrás
  return {
    status: "FINISHED",
    voting_status: "OPEN",
    owner_id: "owner1",
    dateTime: {
      toDate: () => gameDate,
    },
    ...overrides,
  };
}

/** Cria um snapshot de transação para a transaction do Firestore */
function makeTransactionMock(snapshots: Record<string, { exists: boolean; data: () => any }>) {
  return {
    get: jest.fn().mockImplementation((ref: any) => {
      // Identificar pelo path ou pela propriedade id mockada
      const id = ref?._mockId || ref?.id || "";
      const snap = snapshots[id];
      if (snap) return Promise.resolve(snap);
      return Promise.resolve({ exists: false, data: () => null });
    }),
    set: jest.fn(),
    update: jest.fn(),
  };
}

// ==========================================
// TESTES: submitMvpVote
// ==========================================

describe("submitMvpVote - autenticação e validação", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Restaurar rate limit como permitido por padrão
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("deve rejeitar request sem autenticação", async () => {
    const request = {
      auth: null,
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("auth required");
  });

  test("deve rejeitar token sem profileComplete", async () => {
    const request = {
      auth: { uid: "player1", token: {} },
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("profile.incomplete");
  });

  test("deve rejeitar voto em si mesmo", async () => {
    const request = {
      auth: { uid: "player1", token: { profileComplete: true } },
      data: { gameId: "game1", votedPlayerId: "player1", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow(
      "Não é permitido votar em si mesmo"
    );
  });

  test("deve rejeitar gameId inválido (vazio)", async () => {
    const request = {
      auth: { uid: "player1", token: { profileComplete: true } },
      data: { gameId: "", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("gameId");
  });

  test("deve rejeitar categoria inválida", async () => {
    const request = {
      auth: { uid: "player1", token: { profileComplete: true } },
      data: { gameId: "game1", votedPlayerId: "player2", category: "INVALID_CAT" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("Categoria");
  });

  test("deve rejeitar IDs com barra (path traversal)", async () => {
    const request = {
      auth: { uid: "player1", token: { profileComplete: true } },
      data: { gameId: "game1/subpath", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("caracteres especiais");
  });
});

describe("submitMvpVote - submissão bem-sucedida", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("deve registrar voto com sucesso", async () => {
    // Configurar transaction que simula estado válido:
    // - jogo existe e está FINISHED
    // - votante confirmado
    // - votado confirmado
    // - voto não existe ainda
    mockRunTransaction.mockImplementation(async (callback: any) => {
      // Criar mock de transaction com respostas para cada get
      let callIndex = 0;
      const responses = [
        // 1. Snapshot do jogo
        { exists: true, data: () => makeFinishedGame() },
        // 2. Snapshot de confirmação do votante
        { exists: true, data: () => ({ status: "CONFIRMED", user_id: "voter1" }) },
        // 3. Snapshot de confirmação do votado
        { exists: true, data: () => ({ status: "CONFIRMED", user_id: "player2" }) },
        // 4. Verificação de voto duplicado (não existe)
        { exists: false, data: () => null },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex] || { exists: false, data: () => null };
          callIndex++;
          return Promise.resolve(snap);
        }),
        set: jest.fn(),
      };

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "voter1", token: { profileComplete: true } },
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    const result = await submitMvpVoteHandler!(request);

    expect(result.success).toBe(true);
    expect(result.voteId).toContain("game1");
    expect(result.voteId).toContain("voter1");
    expect(result.voteId).toContain("MVP");
    expect(result.message).toBe("Voto registrado com sucesso.");
  });
});

describe("submitMvpVotes - submissão em lote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("deve registrar múltiplas categorias em uma transaction", async () => {
    const setMock = jest.fn();
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        { exists: true, data: () => makeFinishedGame() },
        { exists: true, data: () => ({ status: "CONFIRMED", user_id: "voter1" }) },
        { exists: true, data: () => ({ status: "CONFIRMED", user_id: "player2" }) },
        { exists: false, data: () => null },
        { exists: true, data: () => ({ status: "CONFIRMED", user_id: "player3" }) },
        { exists: false, data: () => null },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex] || { exists: false, data: () => null };
          callIndex++;
          return Promise.resolve(snap);
        }),
        set: setMock,
      };

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "voter1", token: { profileComplete: true } },
      data: {
        gameId: "game1",
        votes: [
          { votedPlayerId: "player2", category: "MVP" },
          { votedPlayerId: "player3", category: "WORST" },
        ],
      },
    };

    const result = await submitMvpVotesHandler!(request);

    expect(result.success).toBe(true);
    expect(result.voteIds).toEqual([
      "game1_voter1_MVP",
      "game1_voter1_WORST",
    ]);
    expect(setMock).toHaveBeenCalledTimes(2);
  });

  test("deve rejeitar categorias duplicadas antes da transaction", async () => {
    const request = {
      auth: { uid: "voter1", token: { profileComplete: true } },
      data: {
        gameId: "game1",
        votes: [
          { votedPlayerId: "player2", category: "MVP" },
          { votedPlayerId: "player3", category: "MVP" },
        ],
      },
    };

    await expect(submitMvpVotesHandler!(request)).rejects.toThrow(
      "Categoria duplicada"
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});

describe("submitMvpVote - rejeições via transaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("deve rejeitar voto duplicado (mesmo usuário, mesmo jogo)", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // jogo FINISHED
        { exists: true, data: () => makeFinishedGame() },
        // votante confirmado
        { exists: true, data: () => ({ status: "CONFIRMED" }) },
        // votado confirmado
        { exists: true, data: () => ({ status: "CONFIRMED" }) },
        // voto JÁ EXISTE
        { exists: true, data: () => ({ voter_id: "voter1", category: "MVP" }) },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false };
          return Promise.resolve(snap);
        }),
        set: jest.fn(),
      };

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "voter1", token: { profileComplete: true } },
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("já votou");
  });

  test("deve rejeitar quando janela de votação expirou (>24h)", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      // Data do jogo: 30h atrás (fora da janela de 24h)
      const oldDate = new Date(Date.now() - 30 * 60 * 60 * 1000);
      const mockTx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            dateTime: { toDate: () => oldDate },
          }),
        }),
        set: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "voter1", token: { profileComplete: true } },
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("expirado");
  });

  test("deve rejeitar votante não confirmado no jogo", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // jogo FINISHED dentro da janela
        { exists: true, data: () => makeFinishedGame() },
        // confirmação do votante NÃO EXISTE
        { exists: false, data: () => null },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false };
          return Promise.resolve(snap);
        }),
        set: jest.fn(),
      };

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "voter1", token: { profileComplete: true } },
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("confirmados");
  });

});

// Nota: O comportamento de rate limiting do submitMvpVote é garantido pelo middleware
// rate-limiter, cujos testes completos estão em rate-limiter.test.ts.
// O parallel-processing.test.ts também cobre o padrão de rate limiting em callable functions.

// ==========================================
// TESTES: concludeMvpVoting
// ==========================================

describe("concludeMvpVoting - validações", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  test("deve rejeitar request sem autenticação", async () => {
    const request = { auth: null, data: { gameId: "game1" } };
    await expect(concludeMvpVotingHandler!(request)).rejects.toThrow("auth required");
  });

  test("deve rejeitar token sem profileComplete", async () => {
    const request = {
      auth: { uid: "owner1", token: {} },
      data: { gameId: "game1" },
    };
    await expect(concludeMvpVotingHandler!(request)).rejects.toThrow("profile.incomplete");
  });

  test("deve rejeitar gameId inválido", async () => {
    const request = {
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "" },
    };
    await expect(concludeMvpVotingHandler!(request)).rejects.toThrow("gameId");
  });
});

describe("concludeMvpVoting - contagem de votos e vencedor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: new Date(Date.now() + 60000),
    });
    // Restaurar mockCollectionGet após clearAllMocks.
    // A query de confirmações (db.collection("confirmations")....get()) fora da
    // transaction retorna undefined por padrão após clear, causando
    // confirmationsSnap.docs → "Cannot read properties of undefined".
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
  });

  test("deve eleger corretamente o MVP com mais votos", async () => {
    // 3 votos para playerA, 1 voto para playerB
    const votes = [
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerB" },
    ];

    // Mock: transaction interna (votos lidos dentro da transaction, não fora)
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // 1º get: votos (transaction.get(db.collection("mvp_votes").where(...)))
        {
          docs: votes.map((v) => ({ data: () => v })),
          empty: false,
        },
        // 2º get: jogo
        {
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "owner1",
          }),
        },
        // 3º get: confirmations query (FIX #617 — agora via transaction.get())
        { docs: [], empty: true },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBe("playerA");
    expect(result.alreadyConcluded).toBe(false);
  });

  test("grava log de XP do MVP com origem auditavel da votacao", async () => {
    const votes = [
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerB" },
    ];

    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let votingCallIndex = 0;
    const votingResponses = [
      {
        docs: votes.map((v) => ({ data: () => v })),
        empty: false,
      },
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
        }),
      },
      { docs: [], empty: true },
    ];
    votingTx.get.mockImplementation(() => {
      const snap = votingResponses[votingCallIndex++] ||
        { exists: false, data: () => ({}) };
      return Promise.resolve(snap);
    });

    const xpTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    const gameDate = new Date("2026-06-10T12:00:00-03:00");
    let xpCallIndex = 0;
    const xpResponses = [
      { exists: false, data: () => null },
      { exists: false, data: () => ({}) },
      {
        exists: true,
        data: () => ({
          dateTime: { toDate: () => gameDate },
          gender: "mixed",
        }),
      },
      {
        exists: true,
        data: () => ({
          experience_points: 120,
          level: 1,
        }),
      },
      {
        exists: true,
        data: () => ({
          currentMvpStreak: 1,
          bestMvpStreak: 2,
        }),
      },
    ];
    xpTx.get.mockImplementation(() => {
      const snap = xpResponses[xpCallIndex++] ||
        { exists: false, data: () => ({}) };
      return Promise.resolve(snap);
    });

    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementationOnce(async (callback: any) => callback(xpTx));

    const request = {
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    const xpLogSet = xpTx.set.mock.calls.find(
      ([, data]) => data?.reason === "MVP"
    );

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBe("playerA");
    expect(result.xpApplied.mvp).toBe(true);
    expect(xpLogSet?.[1]).toEqual(expect.objectContaining({
      user_id: "playerA",
      game_id: "game1",
      xp_earned: 30,
      transaction_id: "mvp_game1_playerA",
      source: "mvp_voting_concluded",
      source_collection: "mvp_votes",
      source_event_id: "game1",
      source_vote_category: "MVP",
      source_total_votes: 3,
      source_category_votes: 3,
    }));
  });

  test("deve resolver empate pelo playerId alfabético (determinístico)", async () => {
    // Empate entre "zebra" e "alpha" - deve vencer "alpha" (alfabético)
    const votes = [
      { category: "MVP", voted_player_id: "zebra" },
      { category: "MVP", voted_player_id: "alpha" },
    ];

    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // 1º get: votos
        {
          docs: votes.map((v) => ({ data: () => v })),
          empty: false,
        },
        // 2º get: jogo
        {
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "owner1",
          }),
        },
        // 3º get: confirmations query (FIX #617 — agora via transaction.get())
        { docs: [], empty: true },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    // "alpha" vence o desempate alfabético vs "zebra"
    expect(result.results.mvpId).toBe("alpha");
  });

  test("deve encerrar sem vencedor quando não há votos", async () => {
    // Nenhum voto registrado
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // 1º get: votos (vazio)
        { docs: [], empty: true },
        // 2º get: jogo
        {
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "owner1",
          }),
        },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBeNull();
    expect(result.results.bestGkId).toBeNull();
  });

  test("deve retornar alreadyConcluded quando votação já foi encerrada", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // 1º get: votos (vazio — irrelevante pois voting_status=CONCLUDED)
        { docs: [], empty: true },
        // 2º get: jogo já concluído
        {
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "CONCLUDED",
            owner_id: "owner1",
            mvp_id: "playerA",
            best_gk_id: null,
            worst_player_id: "playerZ",
          }),
        },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.alreadyConcluded).toBe(true);
    expect(result.message).toContain("já havia sido");
  });

  test("não duplica Bola Murcha quando o trigger principal já aplicou a penalidade", async () => {
    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let votingCallIndex = 0;
    const votingResponses = [
      {
        docs: [{data: () => ({category: "WORST", voted_player_id: "playerZ"})}],
        empty: false,
      },
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
        }),
      },
      {docs: [], empty: true},
    ];
    votingTx.get.mockImplementation(() => {
      const snap = votingResponses[votingCallIndex++] || {exists: false, data: () => ({})};
      return Promise.resolve(snap);
    });

    const xpTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let xpCallIndex = 0;
    const xpResponses = [
      {exists: false, data: () => null},
      {
        exists: true,
        data: () => ({
          xp_penalty: -10,
          was_worst_player: true,
        }),
      },
    ];
    xpTx.get.mockImplementation(() => {
      const snap = xpResponses[xpCallIndex++] || {exists: false, data: () => ({})};
      return Promise.resolve(snap);
    });

    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementationOnce(async (callback: any) => callback(xpTx));

    const request = {
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game1"},
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.results.worstPlayerId).toBe("playerZ");
    expect(result.xpApplied.worst).toBe(true);
    expect(xpTx.get).toHaveBeenCalledTimes(2);
    expect(xpTx.set).not.toHaveBeenCalled();
    expect(xpTx.update).not.toHaveBeenCalled();
  });

  test("não duplica Bola Murcha quando o log principal marca was_worst_player", async () => {
    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let votingCallIndex = 0;
    const votingResponses = [
      {
        docs: [{data: () => ({category: "WORST", voted_player_id: "playerY"})}],
        empty: false,
      },
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
        }),
      },
      {docs: [], empty: true},
    ];
    votingTx.get.mockImplementation(() => {
      const snap = votingResponses[votingCallIndex++] || {exists: false, data: () => ({})};
      return Promise.resolve(snap);
    });

    const xpTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let xpCallIndex = 0;
    const xpResponses = [
      {exists: false, data: () => null},
      {
        exists: true,
        data: () => ({
          xp_penalty: 0,
          was_worst_player: true,
        }),
      },
    ];
    xpTx.get.mockImplementation(() => {
      const snap = xpResponses[xpCallIndex++] || {exists: false, data: () => ({})};
      return Promise.resolve(snap);
    });

    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementationOnce(async (callback: any) => callback(xpTx));

    const request = {
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game1"},
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.results.worstPlayerId).toBe("playerY");
    expect(result.xpApplied.worst).toBe(true);
    expect(xpTx.get).toHaveBeenCalledTimes(2);
    expect(xpTx.set).not.toHaveBeenCalled();
    expect(xpTx.update).not.toHaveBeenCalled();
  });

  test("deve rejeitar quando caller não é dono nem admin", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // 1º get: votos (vazio)
        { docs: [], empty: true },
        // 2º get: jogo pertence a outro dono
        {
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "real_owner",
          }),
        },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "other_user", token: { role: "PLAYER", profileComplete: true } },
      data: { gameId: "game1" },
    };

    await expect(concludeMvpVotingHandler!(request)).rejects.toThrow("dono do jogo");
  });
});
