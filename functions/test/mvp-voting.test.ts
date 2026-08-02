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
      collection: jest.fn((collectionName: string) => {
        const collectionRef: any = {
          _mockCollection: collectionName,
          doc: jest.fn((id: string) => ({
            _mockCollection: collectionName,
            _mockId: id,
            get: mockDocGet,
          })),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: mockCollectionGet,
        };
        return collectionRef;
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
  GAME_GENDERS: ["MALE", "FEMALE", "MIXED"],
  DEFAULT_GAME_GENDER: "MIXED",
  XP_ACTIONS: {
    PARTICIPATION: 10,
    GOAL: 25,
    ASSIST: 20,
    SAVE: 15,
    CLEAN_SHEET: 15,
    WIN: 30,
    DRAW: 10,
    MVP: 50,
    WORST_PLAYER: -10,
  },
  STREAK_BONUSES: {
    STREAK_3: 20,
    STREAK_5: 35,
    STREAK_7: 50,
    STREAK_10: 100,
  },
  PERFORMANCE_BONUSES: {
    TOP_SCORER: 15,
    HAT_TRICK: 30,
    FIRST_GOAL: 5,
    GOALKEEPER_GOAL: 20,
    FAIR_PLAY: 5,
    EVENT_RECORDER_PER_EVENT: 2,
    EVENT_RECORDER_MIN_EVENTS: 3,
    EVENT_RECORDER_MAX_XP: 20,
  },
  BEHAVIOR_BONUSES: {
    EARLY_CONFIRMATION: 5,
    ON_TIME_CHECKIN: 5,
    LAST_MINUTE_SAVER: 15,
    WAITLIST_PROMOTED: 10,
  },
  RETENTION_BONUSES: {
    COMEBACK_14D: 10,
    COMEBACK_30D: 20,
    COMEBACK_14D_THRESHOLD_DAYS: 14,
    COMEBACK_30D_THRESHOLD_DAYS: 30,
    COMEBACK_MAX_PER_MONTH: 1,
    FIRST_GAME_OF_MONTH: 15,
    MONTHLY_STREAK_3: 50,
    MONTHLY_STREAK_6: 100,
    MONTHLY_STREAK_12: 250,
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
let buildCanonicalVotingMilestoneStatistics:
  ((stats: Record<string, unknown>) => Record<string, number>) | null = null;

const { onCall } = require("firebase-functions/v2/https");

const eligibleConfirmationDoc = (userId: string) => ({
  ref: { id: `confirmation-${userId}` },
  data: () => ({
    status: "CONFIRMED",
    user_id: userId,
    checked_in: true,
  }),
});

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
    const votingModule = require("../src/voting/mvp-voting");
    buildCanonicalVotingMilestoneStatistics =
      votingModule.buildCanonicalVotingMilestoneStatistics;
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

function makeReadBeforeWriteTransaction(responses: any[]) {
  let callIndex = 0;
  let wrote = false;
  const markWrite = () => {
    wrote = true;
  };

  return {
    get: jest.fn(async () => {
      if (wrote) {
        throw new Error("Firestore transaction read after write");
      }
      return responses[callIndex++] || {exists: false, data: () => ({})};
    }),
    set: jest.fn(markWrite),
    update: jest.fn(markWrite),
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
        { exists: true, data: () => ({ status: "CONFIRMED", user_id: "player3" }) },
        { exists: false, data: () => null },
        { exists: false, data: () => null },
        { exists: false, data: () => null },
        { exists: false, data: () => null },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex] || { exists: false, data: () => null };
          callIndex++;
          return Promise.resolve(snap);
        }),
        set: setMock,
        update: jest.fn(),
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

  test("faz todas as leituras antes da primeira escrita", async () => {
    const transaction = makeReadBeforeWriteTransaction([
      {exists: true, data: () => makeFinishedGame()},
      {exists: true, data: () => ({status: "CONFIRMED", user_id: "voter1"})},
      {exists: true, data: () => ({status: "CONFIRMED", user_id: "player2"})},
      {exists: true, data: () => ({status: "CONFIRMED", user_id: "player3"})},
      {exists: false, data: () => null},
      {exists: false, data: () => null},
      {exists: false, data: () => null},
      {exists: false, data: () => null},
    ]);
    mockRunTransaction.mockImplementation(async (callback: any) => callback(transaction));

    const result = await submitMvpVotesHandler!({
      auth: {uid: "voter1", token: {profileComplete: true}},
      data: {
        gameId: "game1",
        votes: [
          {votedPlayerId: "player2", category: "MVP"},
          {votedPlayerId: "player3", category: "WORST"},
        ],
      },
    });

    expect(result.ballotComplete).toBe(true);
    expect(transaction.set).toHaveBeenCalledTimes(2);
    expect(transaction.update).toHaveBeenCalledTimes(1);
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

  test("rejeita jogador igual em categoria positiva e WORST", async () => {
    const request = {
      auth: {uid: "voter1", token: {profileComplete: true}},
      data: {
        gameId: "game1",
        votes: [
          {votedPlayerId: "player2", category: "MVP"},
          {votedPlayerId: "player2", category: "WORST"},
        ],
      },
    };

    await expect(submitMvpVotesHandler!(request)).rejects.toThrow(
      "não pode ser escolhido como destaque e Bola Murcha"
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  test("permite o mesmo goleiro como MVP e melhor goleiro", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const transaction = makeReadBeforeWriteTransaction([
        {exists: true, data: () => makeFinishedGame()},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "voter1"})},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "goalkeeper1"})},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "goalkeeper1"})},
        {exists: false, data: () => null},
        {exists: false, data: () => null},
        {exists: false, data: () => null},
      ]);
      return callback(transaction);
    });

    const result = await submitMvpVotesHandler!({
      auth: {uid: "voter1", token: {profileComplete: true}},
      data: {
        gameId: "game1",
        votes: [
          {votedPlayerId: "goalkeeper1", category: "MVP"},
          {votedPlayerId: "goalkeeper1", category: "BEST_GOALKEEPER"},
        ],
      },
    });

    expect(result.success).toBe(true);
  });

  test("rejeita conflito com categoria positiva já persistida", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const transaction = makeReadBeforeWriteTransaction([
        {exists: true, data: () => makeFinishedGame()},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "voter1"})},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "player2"})},
        {
          exists: true,
          data: () => ({
            category: "MVP",
            voted_player_id: "player2",
          }),
        },
        {exists: false, data: () => null},
        {exists: false, data: () => null},
      ]);
      return callback(transaction);
    });

    await expect(submitMvpVotesHandler!({
      auth: {uid: "voter1", token: {profileComplete: true}},
      data: {
        gameId: "game1",
        votes: [{votedPlayerId: "player2", category: "WORST"}],
      },
    })).rejects.toThrow(
      "não pode ser escolhido como destaque e Bola Murcha"
    );
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

  test("rejeita voto individual contraditório com WORST persistido", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const transaction = makeReadBeforeWriteTransaction([
        {exists: true, data: () => makeFinishedGame()},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "voter1"})},
        {exists: true, data: () => ({status: "CONFIRMED", user_id: "player2"})},
        {exists: false, data: () => null},
        {exists: false, data: () => null},
        {
          exists: true,
          data: () => ({
            category: "WORST",
            voted_player_id: "player2",
          }),
        },
      ]);
      return callback(transaction);
    });

    await expect(submitMvpVoteHandler!({
      auth: {uid: "voter1", token: {profileComplete: true}},
      data: {
        gameId: "game1",
        votedPlayerId: "player2",
        category: "MVP",
      },
    })).rejects.toThrow(
      "não pode ser escolhido como destaque e Bola Murcha"
    );
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
      { category: "MVP", voter_id: "voter1", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "voter2", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "voter3", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "voter4", voted_player_id: "playerB" },
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
        {
          docs: [
            eligibleConfirmationDoc("voter1"),
            eligibleConfirmationDoc("voter2"),
            eligibleConfirmationDoc("voter3"),
            eligibleConfirmationDoc("voter4"),
            eligibleConfirmationDoc("playerA"),
            eligibleConfirmationDoc("playerB"),
          ],
          empty: false,
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
    expect(result.results.mvpId).toBe("playerA");
    expect(result.alreadyConcluded).toBe(false);
  });

  test("mantém 3 MVPs consecutivos e zera quem perde o jogo seguinte", async () => {
    const statistics: Record<string, {
      bestPlayerCount: number;
      currentMvpStreak: number;
      bestMvpStreak: number;
    }> = {
      playerA: {bestPlayerCount: 0, currentMvpStreak: 0, bestMvpStreak: 0},
      playerB: {bestPlayerCount: 0, currentMvpStreak: 0, bestMvpStreak: 0},
    };
    const winners = ["playerA", "playerA", "playerA", "playerB"];
    const votingTransactions: any[] = [];
    let transactionCall = 0;

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const isVotingTransaction = transactionCall % 2 === 0;
      if (!isVotingTransaction) {
        transactionCall += 1;
        return callback({
          get: jest.fn().mockResolvedValue({exists: true, data: () => ({})}),
          set: jest.fn(),
          update: jest.fn(),
        });
      }

      const gameIndex = Math.floor(transactionCall / 2);
      const winner = winners[gameIndex];
      const voter = winner === "playerA" ? "playerB" : "playerA";
      const responses = [
        {
          docs: [{data: () => ({
            category: "MVP",
            voter_id: voter,
            voted_player_id: winner,
          })}],
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
        {
          docs: [
            eligibleConfirmationDoc("playerA"),
            eligibleConfirmationDoc("playerB"),
          ],
          empty: false,
        },
        {
          exists: true,
          data: () => ({...statistics[winner]}),
        },
      ];
      let readIndex = 0;
      const votingTx = {
        get: jest.fn().mockImplementation(() =>
          Promise.resolve(responses[readIndex++])),
        set: jest.fn(),
        update: jest.fn(),
      };
      transactionCall += 1;
      const result = await callback(votingTx);
      votingTransactions.push(votingTx);

      for (const [ref, data] of votingTx.set.mock.calls) {
        if (ref?._mockCollection !== "statistics") continue;
        const userStats = statistics[ref._mockId];
        userStats.currentMvpStreak = data.currentMvpStreak;
        if (data.bestMvpStreak !== undefined) {
          userStats.bestMvpStreak = data.bestMvpStreak;
        }
        if (data.bestPlayerCount !== undefined) {
          userStats.bestPlayerCount += 1;
        }
      }
      return result;
    });

    for (let index = 0; index < winners.length; index += 1) {
      await concludeMvpVotingHandler!({
        auth: {uid: "owner1", token: {profileComplete: true}},
        data: {gameId: `game-${index + 1}`},
      });
      if (index === 2) {
        expect(statistics.playerA).toEqual({
          bestPlayerCount: 3,
          currentMvpStreak: 3,
          bestMvpStreak: 3,
        });
        const streakBadge = votingTransactions[index].set.mock.calls.find(
          ([ref, data]: any[]) =>
            ref?._mockCollection === "user_badges" &&
            data?.badge_id === "mvp_streak_3"
        );
        expect(streakBadge).toBeDefined();
      }
    }

    expect(statistics.playerA).toEqual({
      bestPlayerCount: 3,
      currentMvpStreak: 0,
      bestMvpStreak: 3,
    });
    expect(statistics.playerB).toEqual({
      bestPlayerCount: 1,
      currentMvpStreak: 1,
      bestMvpStreak: 1,
    });
  });

  test("incrementa Bola Murcha no fechamento canônico", async () => {
    const votes = [
      {category: "MVP", voter_id: "playerB", voted_player_id: "playerA"},
      {category: "WORST", voter_id: "playerA", voted_player_id: "playerZ"},
    ];
    const responses = [
      {docs: votes.map((vote) => ({data: () => vote})), empty: false},
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
        }),
      },
      {
        docs: [
          eligibleConfirmationDoc("playerA"),
          eligibleConfirmationDoc("playerB"),
          eligibleConfirmationDoc("playerZ"),
        ],
        empty: false,
      },
      {exists: true, data: () => ({currentMvpStreak: 1, bestMvpStreak: 1})},
    ];
    let readIndex = 0;
    const votingTx = {
      get: jest.fn().mockImplementation(() =>
        Promise.resolve(responses[readIndex++])),
      set: jest.fn(),
      update: jest.fn(),
    };
    const alreadyAppliedXpTx = {
      get: jest.fn().mockResolvedValue({exists: true, data: () => ({})}),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementation(async (callback: any) => callback(alreadyAppliedXpTx));

    await concludeMvpVotingHandler!({
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game-worst"},
    });

    const worstStatsSet = votingTx.set.mock.calls.find(
      ([ref]) => ref?._mockCollection === "statistics" &&
        ref?._mockId === "playerZ"
    );
    expect(worstStatsSet?.[1]).toEqual(expect.objectContaining({
      currentMvpStreak: 0,
      worstPlayerCount: expect.anything(),
    }));
    expect(worstStatsSet?.[1].worstPlayerCount.operand).toBe(1);
  });

  test("replay de votação concluída não regrava estatísticas", async () => {
    const responses = [
      {docs: [], empty: true},
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "CONCLUDED",
          owner_id: "owner1",
        }),
      },
    ];
    let readIndex = 0;
    const replayTx = {
      get: jest.fn().mockImplementation(() =>
        Promise.resolve(responses[readIndex++])),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockRunTransaction.mockImplementationOnce(
      async (callback: any) => callback(replayTx)
    );

    const result = await concludeMvpVotingHandler!({
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game-replay"},
    });

    expect(result.alreadyConcluded).toBe(true);
    expect(replayTx.set).not.toHaveBeenCalled();
    expect(replayTx.update).not.toHaveBeenCalled();
  });

  test("grava log de XP do MVP com origem auditavel da votacao", async () => {
    const votes = [
      { category: "MVP", voter_id: "voter1", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "voter2", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "voter3", voted_player_id: "playerB" },
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
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("voter2"),
          eligibleConfirmationDoc("voter3"),
          eligibleConfirmationDoc("playerA"),
          eligibleConfirmationDoc("playerB"),
        ],
        empty: false,
      },
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
      {empty: false, docs: [{id: "season-active"}]},
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
      xp_earned: 50,
      transaction_id: "mvp_game1_playerA",
      source: "mvp_voting_concluded",
      source_collection: "mvp_votes",
      source_event_id: "game1",
      source_vote_category: "MVP",
      source_total_votes: 3,
      source_category_votes: 3,
    }));
  });

  test("atribui milestone de MVP na temporada do jogo e marca o log principal", async () => {
    const votes = [
      {category: "MVP", voter_id: "voter1", voted_player_id: "playerA"},
      {category: "MVP", voter_id: "voter2", voted_player_id: "playerA"},
    ];

    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let votingCallIndex = 0;
    const votingResponses = [
      {docs: votes.map((vote) => ({data: () => vote})), empty: false},
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
        }),
      },
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("voter2"),
          eligibleConfirmationDoc("playerA"),
        ],
        empty: false,
      },
    ];
    votingTx.get.mockImplementation(() => {
      const snap = votingResponses[votingCallIndex++] ||
        {exists: false, data: () => ({})};
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
      {exists: true, data: () => ({xp_mvp: 0, was_mvp: false})},
      {
        exists: true,
        data: () => ({
          dateTime: {toDate: () => new Date("2026-06-15T12:00:00-03:00")},
          gender: "mixed",
        }),
      },
      {empty: false, docs: [{id: "season-active"}]},
      // FIX #3882: leitura do standing congelado (não existe → season aberta)
      {exists: false, data: () => null},
      {
        exists: true,
        data: () => ({
          experience_points: 1000,
          level: 4,
          milestones_achieved: [],
        }),
      },
      {
        exists: true,
        data: () => ({
          bestPlayerCount: 10,
          currentMvpStreak: 3,
          bestMvpStreak: 3,
        }),
      },
    ];
    xpTx.get.mockImplementation(() => {
      const snap = xpResponses[xpCallIndex++] ||
        {exists: false, data: () => ({})};
      return Promise.resolve(snap);
    });

    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementationOnce(async (callback: any) => callback(xpTx));

    await concludeMvpVotingHandler!({
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game1"},
    });

    const milestoneBadgeSet = xpTx.set.mock.calls.find(
      ([, data]) => data?.badge_id === "MVP_10"
    );
    const votingLogSet = xpTx.set.mock.calls.find(
      ([, data]) => data?.reason === "MVP"
    );
    const mainXpLogSync = xpTx.set.mock.calls.find(
      ([, data]) => data?.was_mvp === true && data?.updated_at
    );
    const duplicateStatisticsSet = xpTx.set.mock.calls.find(
      ([ref]) => ref?._mockCollection === "statistics"
    );
    const milestoneInput = buildCanonicalVotingMilestoneStatistics!({
      bestPlayerCount: 10,
      currentMvpStreak: 3,
      bestMvpStreak: 3,
    });

    expect(milestoneInput).toEqual(expect.objectContaining({
      bestPlayerCount: 10,
      currentMvpStreak: 3,
      bestMvpStreak: 3,
    }));

    expect(votingLogSet?.[1]).toEqual(expect.objectContaining({
      xp_earned: 450,
      xp_mvp: 50,
      xp_milestones: 400,
      milestones_unlocked: ["MVP_5", "MVP_10"],
    }));
    expect(milestoneBadgeSet?.[1]).toEqual(expect.objectContaining({
      badge_id: "MVP_10",
      user_id: "playerA",
      xp_reward: 300,
    }));
    expect(mainXpLogSync?.[1]).toEqual(expect.objectContaining({
      was_mvp: true,
    }));
    expect(duplicateStatisticsSet).toBeUndefined();
  });

  test("lê tudo antes de escrever XP de MVP e Bola Murcha", async () => {
    const votes = [
      {category: "MVP", voter_id: "voter1", voted_player_id: "playerA"},
      {category: "MVP", voter_id: "voter2", voted_player_id: "playerA"},
      {category: "WORST", voter_id: "voter3", voted_player_id: "playerZ"},
      {category: "WORST", voter_id: "voter4", voted_player_id: "playerZ"},
    ];
    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    const votingResponses = [
      {docs: votes.map((vote) => ({data: () => vote})), empty: false},
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
        }),
      },
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("voter2"),
          eligibleConfirmationDoc("voter3"),
          eligibleConfirmationDoc("voter4"),
          eligibleConfirmationDoc("playerA"),
          eligibleConfirmationDoc("playerZ"),
        ],
        empty: false,
      },
    ];
    votingTx.get.mockImplementation(async () =>
      votingResponses.shift() || {exists: false, data: () => ({})}
    );

    const gameSnap = {
      exists: true,
      data: () => makeFinishedGame({
        season_id: "season-1",
        gender: "MIXED",
      }),
    };
    const userSnap = {
      exists: true,
      data: () => ({experience_points: 100, level: 1}),
    };
    const mvpXpTx = makeReadBeforeWriteTransaction([
      {exists: false, data: () => null},
      {exists: true, data: () => ({was_mvp: false})},
      gameSnap,
      // FIX #3882: leitura do standing congelado (não existe → season aberta)
      {exists: false, data: () => null},
      userSnap,
      {exists: true, data: () => ({bestPlayerCount: 0})},
    ]);
    const worstXpTx = makeReadBeforeWriteTransaction([
      {exists: false, data: () => null},
      {
        exists: true,
        data: () => ({xp_penalty: 0, was_worst_player: false}),
      },
      gameSnap,
      userSnap,
    ]);

    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementationOnce(async (callback: any) => callback(mvpXpTx))
      .mockImplementationOnce(async (callback: any) => callback(worstXpTx));

    const result = await concludeMvpVotingHandler!({
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game1"},
    });

    expect(result.xpApplied).toEqual({mvp: true, worst: true, allOk: true, deferred: false});
    // FIX #3882: +1 leitura (standing congelado) no caminho de MVP
    expect(mvpXpTx.get).toHaveBeenCalledTimes(6);
    expect(worstXpTx.get).toHaveBeenCalledTimes(4);
    expect(mvpXpTx.set).toHaveBeenCalled();
    expect(worstXpTx.set).toHaveBeenCalled();
  });

  test("deve resolver empate pelo playerId alfabético (determinístico)", async () => {
    // Empate entre "zebra" e "alpha" - deve vencer "alpha" (alfabético)
    const votes = [
      { category: "MVP", voter_id: "voter1", voted_player_id: "zebra" },
      { category: "MVP", voter_id: "voter2", voted_player_id: "alpha" },
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
        {
          docs: [
            eligibleConfirmationDoc("voter1"),
            eligibleConfirmationDoc("voter2"),
            eligibleConfirmationDoc("zebra"),
            eligibleConfirmationDoc("alpha"),
          ],
          empty: false,
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
    // "alpha" vence o desempate alfabético vs "zebra"
    expect(result.results.mvpId).toBe("alpha");
  });

  test("empate em WORST conclui sem vencedor, flag ou penalidade", async () => {
    const votes = [
      {category: "WORST", voter_id: "voter1", voted_player_id: "zebra"},
      {category: "WORST", voter_id: "voter2", voted_player_id: "alpha"},
    ];
    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let callIndex = 0;
    const responses = [
      {
        docs: votes.map((vote) => ({data: () => vote})),
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
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("voter2"),
          eligibleConfirmationDoc("zebra"),
          eligibleConfirmationDoc("alpha"),
        ],
        empty: false,
      },
    ];
    votingTx.get.mockImplementation(() => Promise.resolve(
      responses[callIndex++] || {exists: false, data: () => ({})}
    ));
    mockRunTransaction.mockImplementationOnce(
      async (callback: any) => callback(votingTx)
    );

    const result = await concludeMvpVotingHandler!({
      auth: {uid: "owner1", token: {profileComplete: true}},
      data: {gameId: "game1"},
    });

    expect(result.results.worstPlayerId).toBeNull();
    expect(result.xpApplied).toEqual({mvp: false, worst: false, allOk: true, deferred: false});
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    const gameUpdate = votingTx.update.mock.calls.find(
      ([, data]) => data?.voting_status === "CONCLUDED"
    );
    expect(gameUpdate?.[1]).toEqual(expect.objectContaining({
      worst_player_id: null,
      worst_player_votes: 0,
      worst_player_total_votes: 2,
    }));
    const confirmationUpdates = votingTx.update.mock.calls.filter(
      ([, data]) => Object.hasOwn(data, "is_worst_player")
    );
    expect(confirmationUpdates).toHaveLength(4);
    confirmationUpdates.forEach(([, data]) => {
      expect(data.is_worst_player).toBe(false);
    });
  });

  test("ignora votos de jogadores sem presença real", async () => {
    const votes = [
      { category: "MVP", voter_id: "voter1", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "ghost", voted_player_id: "playerA" },
    ];

    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
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
        {
          docs: [
            eligibleConfirmationDoc("voter1"),
            eligibleConfirmationDoc("playerA"),
            {
              ref: { id: "confirmation-ghost" },
              data: () => ({
                status: "CONFIRMED",
                user_id: "ghost",
                checked_in: false,
              }),
            },
          ],
          empty: false,
        },
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] ||
            { exists: false, data: () => ({}) };
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
  });

  test("deve encerrar sem vencedor quando não há votos", async () => {
    // Nenhum voto registrado
    let capturedTx: any;
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
        // 3º get: confirmações elegíveis
        {docs: [eligibleConfirmationDoc("playerA")], empty: false},
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      capturedTx = mockTx;
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
    const resetSet = capturedTx.set.mock.calls.find(
      ([ref]: any[]) => ref?._mockCollection === "statistics" &&
        ref?._mockId === "playerA"
    );
    expect(resetSet?.[1]).toEqual(expect.objectContaining({
      currentMvpStreak: 0,
    }));
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
        docs: [{
          data: () => ({
            category: "WORST",
            voter_id: "voter1",
            voted_player_id: "playerZ",
          }),
        }],
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
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("playerZ"),
        ],
        empty: false,
      },
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
        docs: [{
          data: () => ({
            category: "WORST",
            voter_id: "voter1",
            voted_player_id: "playerY",
          }),
        }],
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
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("playerY"),
        ],
        empty: false,
      },
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

// ==========================================
// REGRESSÃO #3940: anti-fraud hold não paga XP de votação em dobro
// ==========================================
//
// Cenário: jogo HELD_FOR_REVIEW → votação apurada ANTES do pipeline
// principal → admin APPROVE roda o pipeline e pagaria MVP/Bola Murcha
// de novo (dobro). O fix defere o XP de votação para o release.
describe("FIX #3940 — concludeMvpVoting adia XP de votação sob hold anti-fraude", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkRateLimit } = require("../src/middleware/rate-limiter");
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: new Date(Date.now() + 60000),
    });
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });
  });

  /**
   * Monta a transaction de votação com MVP=playerA e Bola Murcha=playerZ,
   * parametrizando o xp_reward_status do jogo.
   */
  function makeHeldVotingTransaction(xpRewardStatus: string) {
    const votes = [
      { category: "MVP", voter_id: "voter1", voted_player_id: "playerA" },
      { category: "MVP", voter_id: "voter2", voted_player_id: "playerA" },
      { category: "WORST", voter_id: "voter3", voted_player_id: "playerZ" },
      { category: "WORST", voter_id: "voter4", voted_player_id: "playerZ" },
    ];
    const votingTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    const responses = [
      { docs: votes.map((v) => ({ data: () => v })), empty: false },
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "OPEN",
          owner_id: "owner1",
          xp_reward_status: xpRewardStatus,
        }),
      },
      {
        docs: [
          eligibleConfirmationDoc("voter1"),
          eligibleConfirmationDoc("voter2"),
          eligibleConfirmationDoc("voter3"),
          eligibleConfirmationDoc("voter4"),
          eligibleConfirmationDoc("playerA"),
          eligibleConfirmationDoc("playerZ"),
        ],
        empty: false,
      },
      { exists: true, data: () => ({ currentMvpStreak: 0, bestMvpStreak: 0 }) },
    ];
    let idx = 0;
    votingTx.get.mockImplementation(() =>
      Promise.resolve(responses[idx++] || { exists: false, data: () => ({}) })
    );
    return votingTx;
  }

  test("NÃO paga XP de MVP/Bola Murcha quando xp_reward_status = HELD_FOR_REVIEW", async () => {
    const votingTx = makeHeldVotingTransaction("HELD_FOR_REVIEW");
    // Apenas a transaction de votação deve rodar — applyVotingXpDelta NÃO
    // pode ser chamado (seria uma segunda/third transaction).
    mockRunTransaction.mockImplementationOnce(
      async (callback: any) => callback(votingTx)
    );

    const result = await concludeMvpVotingHandler!({
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game-held" },
    });

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBe("playerA");
    expect(result.results.worstPlayerId).toBe("playerZ");
    // XP de votação foi adiado, não aplicado.
    expect(result.xpApplied).toEqual({
      mvp: false,
      worst: false,
      allOk: true,
      deferred: true,
    });
    // Nenhuma transaction de XP foi aberta (somente a de votação).
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    // O flag de auditoria voting_xp_pending=true foi gravado no jogo.
    const gameUpdate = votingTx.update.mock.calls.find(
      ([, data]) => data?.voting_status === "CONCLUDED"
    );
    expect(gameUpdate?.[1]).toEqual(
      expect.objectContaining({ voting_xp_pending: true })
    );
  });

  test("NÃO paga XP de votação quando xp_reward_status = REJECTED_BY_ADMIN", async () => {
    const votingTx = makeHeldVotingTransaction("REJECTED_BY_ADMIN");
    mockRunTransaction.mockImplementationOnce(
      async (callback: any) => callback(votingTx)
    );

    const result = await concludeMvpVotingHandler!({
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game-rejected" },
    });

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBe("playerA");
    expect(result.xpApplied.deferred).toBe(true);
    expect(result.xpApplied.mvp).toBe(false);
    expect(result.xpApplied.worst).toBe(false);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    const gameUpdate = votingTx.update.mock.calls.find(
      ([, data]) => data?.voting_status === "CONCLUDED"
    );
    expect(gameUpdate?.[1]).toEqual(
      expect.objectContaining({ voting_xp_pending: true })
    );
  });

  test("paga XP de votação normalmente quando xp_reward_status = ELIGIBLE (sem hold)", async () => {
    const votingTx = makeHeldVotingTransaction("ELIGIBLE");
    // Transaction de XP do MVP: simula applyVotingXpDelta idempotente que
    // grava o log de votação.
    const mvpXpTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    const gameDate = new Date("2026-06-10T12:00:00-03:00");
    let xpIdx = 0;
    const xpResponses = [
      { exists: false, data: () => null }, // log de votação (não existe)
      { exists: false, data: () => ({}) }, // log principal (não existe)
      {
        exists: true,
        data: () => ({ dateTime: { toDate: () => gameDate }, gender: "mixed" }),
      },
      { empty: false, docs: [{ id: "season-active" }] },
      { exists: false, data: () => null }, // standing congelado (não existe)
      {
        exists: true,
        data: () => ({ experience_points: 120, level: 1 }),
      },
      {
        exists: true,
        data: () => ({ currentMvpStreak: 1, bestMvpStreak: 2 }),
      },
    ];
    mvpXpTx.get.mockImplementation(() =>
      Promise.resolve(
        xpResponses[xpIdx++] || { exists: false, data: () => ({}) }
      )
    );
    mockRunTransaction
      .mockImplementationOnce(async (callback: any) => callback(votingTx))
      .mockImplementationOnce(async (callback: any) => callback(mvpXpTx));

    const result = await concludeMvpVotingHandler!({
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game-eligible" },
    });

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBe("playerA");
    // Caminho normal: XP aplicado, NÃO adiado.
    expect(result.xpApplied.deferred).toBe(false);
    expect(result.xpApplied.mvp).toBe(true);
    // O flag voting_xp_pending deve ser false (sem hold).
    const gameUpdate = votingTx.update.mock.calls.find(
      ([, data]) => data?.voting_status === "CONCLUDED"
    );
    expect(gameUpdate?.[1]).toEqual(
      expect.objectContaining({ voting_xp_pending: false })
    );
    // Log de XP do MVP gravado.
    const mvpLog = mvpXpTx.set.mock.calls.find(
      ([, data]) => data?.reason === "MVP"
    );
    expect(mvpLog?.[1]).toEqual(
      expect.objectContaining({
        user_id: "playerA",
        transaction_id: "mvp_game-eligible_playerA",
        xp_earned: 50,
      })
    );
  });

  test("replay de votação concluída sob hold não paga XP nem reabre votação", async () => {
    // Segunda chamada: voting_status já CONCLUDED, xp_reward_status ainda
    // HELD_FOR_REVIEW. Deve retornar alreadyConcluded sem aplicar XP.
    const replayTx = {
      get: jest.fn(),
      update: jest.fn(),
      set: jest.fn(),
    };
    let idx = 0;
    const responses = [
      { docs: [], empty: true },
      {
        exists: true,
        data: () => ({
          status: "FINISHED",
          voting_status: "CONCLUDED",
          owner_id: "owner1",
          mvp_id: "playerA",
          worst_player_id: "playerZ",
          xp_reward_status: "HELD_FOR_REVIEW",
        }),
      },
    ];
    replayTx.get.mockImplementation(() =>
      Promise.resolve(responses[idx++] || { exists: false, data: () => ({}) })
    );
    mockRunTransaction.mockImplementationOnce(
      async (callback: any) => callback(replayTx)
    );

    const result = await concludeMvpVotingHandler!({
      auth: { uid: "owner1", token: { profileComplete: true } },
      data: { gameId: "game-replay-held" },
    });

    expect(result.alreadyConcluded).toBe(true);
    expect(result.xpApplied.deferred).toBe(true);
    expect(result.xpApplied.mvp).toBe(false);
    // Nenhuma escrita no replay.
    expect(replayTx.set).not.toHaveBeenCalled();
    expect(replayTx.update).not.toHaveBeenCalled();
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });
});
