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
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockDocGet,
        }),
        where: jest.fn().mockReturnThis(),
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
}));

// Capturar handlers registrados pelo onCall
let submitMvpVoteHandler: ((request: any) => Promise<any>) | null = null;
let concludeMvpVotingHandler: ((request: any) => Promise<any>) | null = null;

const { onCall } = require("firebase-functions/v2/https");

beforeAll(() => {
  // Registrar os dois handlers na ordem de importação
  (onCall as jest.Mock).mockImplementationOnce((_config: any, handler: any) => {
    submitMvpVoteHandler = handler || _config;
    return submitMvpVoteHandler;
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

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("não autenticado");
  });

  test("deve rejeitar voto em si mesmo", async () => {
    const request = {
      auth: { uid: "player1" },
      data: { gameId: "game1", votedPlayerId: "player1", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow(
      "Não é permitido votar em si mesmo"
    );
  });

  test("deve rejeitar gameId inválido (vazio)", async () => {
    const request = {
      auth: { uid: "player1" },
      data: { gameId: "", votedPlayerId: "player2", category: "MVP" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("gameId");
  });

  test("deve rejeitar categoria inválida", async () => {
    const request = {
      auth: { uid: "player1" },
      data: { gameId: "game1", votedPlayerId: "player2", category: "INVALID_CAT" },
    };

    await expect(submitMvpVoteHandler!(request)).rejects.toThrow("Categoria inválida");
  });

  test("deve rejeitar IDs com barra (path traversal)", async () => {
    const request = {
      auth: { uid: "player1" },
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
      auth: { uid: "voter1" },
      data: { gameId: "game1", votedPlayerId: "player2", category: "MVP" },
    };

    const result = await submitMvpVoteHandler!(request);

    expect(result.success).toBe(true);
    expect(result.voteId).toContain("game1");
    expect(result.voteId).toContain("voter1");
    expect(result.voteId).toContain("MVP");
    expect(result.message).toBe("Voto registrado com sucesso");
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
      auth: { uid: "voter1" },
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
      auth: { uid: "voter1" },
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
      auth: { uid: "voter1" },
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
    await expect(concludeMvpVotingHandler!(request)).rejects.toThrow("não autenticado");
  });

  test("deve rejeitar gameId inválido", async () => {
    const request = {
      auth: { uid: "owner1", token: {} },
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
  });

  test("deve eleger corretamente o MVP com mais votos", async () => {
    // 3 votos para playerA, 1 voto para playerB
    const votes = [
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerA" },
      { category: "MVP", voted_player_id: "playerB" },
    ];

    // Mock: busca de votos (fora da transaction)
    mockCollectionGet.mockResolvedValue({
      empty: false,
      docs: votes.map((v) => ({ data: () => v })),
    });

    // Mock: transaction interna
    mockRunTransaction.mockImplementation(async (callback: any) => {
      let callIndex = 0;
      const responses = [
        // jogo snapshot
        {
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "owner1",
          }),
        },
        // confirmações snapshot (dentro da transaction)
        // Retornado via db.collection().where().where().get()
      ];

      const mockTx = {
        get: jest.fn().mockImplementation(() => {
          const snap = responses[callIndex++] || { exists: false, data: () => ({}) };
          return Promise.resolve(snap);
        }),
        update: jest.fn(),
        set: jest.fn(),
      };

      // Mock para confirmations query dentro da transaction
      const admin = require("firebase-admin");
      const db = admin.firestore();
      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({ get: jest.fn() }),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: true,
          docs: [],
        }),
      });

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { role: undefined } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBe("playerA");
    expect(result.alreadyConcluded).toBe(false);
  });

  test("deve resolver empate pelo playerId alfabético (determinístico)", async () => {
    // Empate entre "zebra" e "alpha" - deve vencer "alpha" (alfabético)
    const votes = [
      { category: "MVP", voted_player_id: "zebra" },
      { category: "MVP", voted_player_id: "alpha" },
    ];

    mockCollectionGet.mockResolvedValue({
      empty: false,
      docs: votes.map((v) => ({ data: () => v })),
    });

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "owner1",
          }),
        }),
        update: jest.fn(),
        set: jest.fn(),
      };

      const admin = require("firebase-admin");
      const db = admin.firestore();
      db.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({ get: jest.fn() }),
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      });

      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { role: undefined } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    // "alpha" vence o desempate alfabético vs "zebra"
    expect(result.results.mvpId).toBe("alpha");
  });

  test("deve encerrar sem vencedor quando não há votos", async () => {
    // Nenhum voto registrado
    mockCollectionGet.mockResolvedValue({
      empty: true,
      docs: [],
    });

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "owner1",
          }),
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { role: undefined } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.results.mvpId).toBeNull();
    expect(result.results.bestGkId).toBeNull();
  });

  test("deve retornar alreadyConcluded quando votação já foi encerrada", async () => {
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "CONCLUDED",
            owner_id: "owner1",
            mvp_id: "playerA",
            best_gk_id: null,
            worst_player_id: "playerZ",
          }),
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "owner1", token: { role: undefined } },
      data: { gameId: "game1" },
    };

    const result = await concludeMvpVotingHandler!(request);

    expect(result.success).toBe(true);
    expect(result.alreadyConcluded).toBe(true);
    expect(result.message).toContain("já havia sido");
  });

  test("deve rejeitar quando caller não é dono nem admin", async () => {
    mockCollectionGet.mockResolvedValue({ empty: true, docs: [] });

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            status: "FINISHED",
            voting_status: "OPEN",
            owner_id: "real_owner",
          }),
        }),
        update: jest.fn(),
      };
      return callback(mockTx);
    });

    const request = {
      auth: { uid: "other_user", token: { role: "PLAYER" } },
      data: { gameId: "game1" },
    };

    await expect(concludeMvpVotingHandler!(request)).rejects.toThrow("dono do jogo");
  });
});
