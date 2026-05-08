/**
 * TESTES DO PROCESSAMENTO PARALELO DE XP
 *
 * Testa as funções de parallel-processing.ts:
 * - processXpBatch: Callable com rate limiting
 * - processXpParallel: Processamento em paralelo
 * - generateParallelTransactionId: ID determinístico
 * - isParallelTransactionProcessed: Verificação de idempotência
 */

// Mock do firebase-admin - deve vir antes dos imports
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockDocGet = jest.fn();
const mockDocDelete = jest.fn().mockResolvedValue(undefined);
const mockQueryGet = jest.fn();
const mockCollectionDoc = jest.fn();

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: jest.fn((name: string) => ({
        doc: mockCollectionDoc.mockReturnValue({
          get: mockDocGet,
          delete: mockDocDelete,
        }),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: mockQueryGet,
      })),
      batch: jest.fn(() => ({
        update: mockBatchUpdate,
        set: mockBatchSet,
        commit: mockBatchCommit,
      })),
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
    remaining: 4,
    resetAt: new Date(Date.now() + 60000),
  }),
  RATE_LIMITS: {
    BATCH_OPERATION: {
      maxRequests: 5,
      windowMs: 60000,
      keyPrefix: "batch_op",
    },
  },
}));

import {
  generateParallelTransactionId,
  isParallelTransactionProcessed,
  processXpParallel,
} from "../src/xp/parallel-processing";

// ==========================================
// HELPERS
// ==========================================

/** Cria um playerUpdate válido para testes */
function makePlayerUpdate(userId: string, xpEarned = 50) {
  return {
    userId,
    xpEarned,
    xpBefore: 100,
    xpAfter: 100 + xpEarned,
    levelBefore: 1,
    levelAfter: 1,
    breakdown: {
      participation: 10,
      goals: 15,
      assists: 9,
      saves: 0,
      result: 20,
      mvp: 0,
      cleanSheet: 0,
      milestones: 0,
      streak: 0,
      penalty: 0,
    },
    metadata: {
      goals: 3,
      assists: 3,
      saves: 0,
      wasMvp: false,
      wasCleanSheet: false,
      wasWorstPlayer: false,
      gameResult: "WIN",
      milestonesUnlocked: [],
    },
  };
}

// Handler do callable processXpBatch foi REMOVIDO em FIX #581 (dead code + anti-cheat bypass).
// Apenas helpers internos (`processXpParallel` etc.) continuam testáveis.

beforeAll(() => {
  const { onCall } = require("firebase-functions/v2/https");
  // resetXpRateLimit ainda é callable — ignoramos no mock
  (onCall as jest.Mock).mockImplementation((_config: any, handler?: any) => {
    return handler || _config;
  });

  jest.isolateModules(() => {
    require("../src/xp/parallel-processing");
  });
});

// ==========================================
// TESTES: generateParallelTransactionId
// ==========================================

describe("generateParallelTransactionId", () => {
  test("deve gerar ID determinístico", () => {
    const id1 = generateParallelTransactionId("game123", "user456");
    const id2 = generateParallelTransactionId("game123", "user456");
    expect(id1).toBe(id2);
  });

  test("deve seguir o formato parallel_game_{gameId}_user_{userId}", () => {
    const id = generateParallelTransactionId("game123", "user456");
    expect(id).toBe("parallel_game_game123_user_user456");
  });

  test("deve gerar IDs diferentes para jogos diferentes", () => {
    const id1 = generateParallelTransactionId("game1", "user1");
    const id2 = generateParallelTransactionId("game2", "user1");
    expect(id1).not.toBe(id2);
  });

  test("deve gerar IDs diferentes para usuários diferentes", () => {
    const id1 = generateParallelTransactionId("game1", "user1");
    const id2 = generateParallelTransactionId("game1", "user2");
    expect(id1).not.toBe(id2);
  });
});

// ==========================================
// TESTES: isParallelTransactionProcessed
// ==========================================

describe("isParallelTransactionProcessed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve retornar false quando transação não existe", async () => {
    mockQueryGet.mockResolvedValue({ empty: true, docs: [] });

    const result = await isParallelTransactionProcessed("parallel_game_1_user_1");
    expect(result).toBe(false);
  });

  test("deve retornar true quando transação já existe", async () => {
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ transaction_id: "parallel_game_1_user_1" }) }],
    });

    const result = await isParallelTransactionProcessed("parallel_game_1_user_1");
    expect(result).toBe(true);
  });

  test("deve retornar false em caso de erro no Firestore (fail-safe)", async () => {
    mockQueryGet.mockRejectedValue(new Error("Firestore unavailable"));

    const result = await isParallelTransactionProcessed("tx_id");
    expect(result).toBe(false);
  });
});

// ==========================================
// TESTES: processXpParallel
// ==========================================

describe("processXpParallel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Por padrão: nenhuma transação processada ainda
    mockQueryGet.mockResolvedValue({ empty: true, docs: [] });
    mockBatchCommit.mockResolvedValue(undefined);
  });

  test("deve retornar sucesso imediato quando playerUpdates está vazio", async () => {
    const result = await processXpParallel("game1", []);

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.batches).toHaveLength(0);
  });

  test("deve processar batch de jogadores com sucesso", async () => {
    const updates = [
      makePlayerUpdate("user1", 50),
      makePlayerUpdate("user2", 30),
    ];

    const result = await processXpParallel("game1", updates);

    expect(result.success).toBe(true);
    expect(result.gameId).toBe("game1");
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  test("deve pular jogadores já processados (idempotência)", async () => {
    const updates = [
      makePlayerUpdate("user1", 50),
      makePlayerUpdate("user2", 30),
    ];

    // Simular que user1 já foi processado
    const txIdUser1 = generateParallelTransactionId("game1", "user1");
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ transaction_id: txIdUser1 }) }],
    });

    const result = await processXpParallel("game1", updates);

    // Apenas user2 deve ser processado
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  test("deve retornar sucesso com 0 processados quando todos já foram processados", async () => {
    const updates = [makePlayerUpdate("user1", 50)];

    const txId = generateParallelTransactionId("game1", "user1");
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ transaction_id: txId }) }],
    });

    const result = await processXpParallel("game1", updates);

    expect(result.success).toBe(true);
    expect(result.processedCount).toBe(0);
    expect(result.batches).toHaveLength(0);
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });
});


// ==========================================
// TESTES: processXpBatch (callable) — REMOVIDOS em FIX #581
// ==========================================
// O callable foi deletado por ser dead code + anti-cheat bypass.
// Tests dos 8 cenários (validações + segurança) movidos junto.
// Helpers internos (generateParallelTransactionId, isParallelTransactionProcessed,
// processXpParallel) continuam cobertos pelos describe blocks acima.
