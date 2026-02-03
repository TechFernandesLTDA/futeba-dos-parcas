/**
 * TESTES DO RATE LIMITER
 *
 * Testa o middleware de rate limiting (rate-limiter.ts):
 * - RATE_LIMITS constants
 * - withRateLimit middleware wrapper
 * - checkRateLimit sliding window logic
 * - checkRateLimitByIp IP-based limiting
 * - cleanupExpiredRateLimits bucket cleanup
 * - resetUserRateLimit admin utility
 * - getUserRateLimitStats usage stats
 */

// Mock firebase-admin
const mockRunTransaction = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocDelete = jest.fn().mockResolvedValue(undefined);
const mockDocRef = { id: "rate_limit_doc" };
const mockQueryGet = jest.fn();

const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
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

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: mockDocGet,
          delete: mockDocDelete,
          ref: mockDocRef,
        }),
        where: mockWhere,
        limit: mockLimit,
        get: mockQueryGet,
      }),
      runTransaction: mockRunTransaction,
      batch: jest.fn(() => ({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = mockTimestamp;

  return mockAdmin;
});

// Mock firebase-functions v2
jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;
    details: any;
    constructor(code: string, message: string, details?: any) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

import {
  RATE_LIMITS,
  RateLimitConfig,
  checkRateLimit,
  withRateLimit,
  cleanupExpiredRateLimits,
  resetUserRateLimit,
  getUserRateLimitStats,
  checkRateLimitByIp,
} from "../src/middleware/rate-limiter";

describe("Rate Limiter - RATE_LIMITS constants", () => {
  test("GAME_CREATE deve permitir 10 requests por minuto", () => {
    expect(RATE_LIMITS.GAME_CREATE.maxRequests).toBe(10);
    expect(RATE_LIMITS.GAME_CREATE.windowMs).toBe(60000);
  });

  test("GAME_DELETE deve ser mais restritivo (5/min)", () => {
    expect(RATE_LIMITS.GAME_DELETE.maxRequests).toBe(5);
  });

  test("USER_PROFILE deve ser mais permissivo (50/min)", () => {
    expect(RATE_LIMITS.USER_PROFILE.maxRequests).toBe(50);
  });

  test("DEFAULT deve existir como fallback", () => {
    expect(RATE_LIMITS.DEFAULT).toBeDefined();
    expect(RATE_LIMITS.DEFAULT.maxRequests).toBe(10);
    expect(RATE_LIMITS.DEFAULT.windowMs).toBe(60000);
  });

  test("todas as configs devem ter maxRequests e windowMs positivos", () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(config.maxRequests).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
    }
  });
});

describe("Rate Limiter - checkRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve permitir request dentro do limite", async () => {
    // Simular transação que permite request
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ requests: [] }),
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimit("user1", config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetAt).toBeInstanceOf(Date);
  });

  test("deve bloquear request quando limite excedido", async () => {
    const now = Date.now();
    // Criar array com maxRequests timestamps recentes
    const existingRequests = Array.from({ length: 10 }, (_, i) => now - i * 1000);

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ requests: existingRequests }),
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimit("user1", config);

    // 10 existentes + 1 novo = 11, excede 10
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("deve filtrar requests fora da janela de tempo", async () => {
    const now = Date.now();
    const oldRequests = [now - 120000, now - 90000]; // Fora da janela de 60s
    const recentRequests = [now - 5000]; // Dentro da janela

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ requests: [...oldRequests, ...recentRequests] }),
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimit("user1", config);

    // Apenas 1 request recente + 1 novo = 2, dentro do limite
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(8);
  });

  test("deve permitir request (fail-open) quando transação falha", async () => {
    mockRunTransaction.mockRejectedValue(new Error("Firestore error"));

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimit("user1", config);

    // Fail-open: permite request em caso de erro
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  test("deve usar keyPrefix na chave do bucket", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => null,
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = {
      maxRequests: 10,
      windowMs: 60000,
      keyPrefix: "GAME_CREATE",
    };
    await checkRateLimit("user1", config);

    expect(mockRunTransaction).toHaveBeenCalled();
  });

  test("deve lidar com bucket inexistente (primeiro request)", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: false,
          data: () => null,
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimit("new_user", config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });
});

describe("Rate Limiter - withRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve rejeitar request sem autenticação", async () => {
    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const handler = jest.fn().mockResolvedValue({ success: true });
    const wrapped = withRateLimit(config, handler);

    await expect(
      wrapped({ auth: null, data: {} })
    ).rejects.toThrow("não autenticado");
  });

  test("deve chamar handler quando rate limit permite", async () => {
    // Mock checkRateLimit permitindo
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const handler = jest.fn().mockResolvedValue({ success: true });
    const wrapped = withRateLimit(config, handler);

    const result = await wrapped({
      auth: { uid: "user1" },
      data: {},
    });

    expect(handler).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  test("deve rejeitar request quando rate limit excedido", async () => {
    const now = Date.now();
    const existingRequests = Array.from({ length: 11 }, (_, i) => now - i * 1000);

    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ requests: existingRequests }),
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const handler = jest.fn();
    const wrapped = withRateLimit(config, handler);

    await expect(
      wrapped({ auth: { uid: "user1" }, data: {} })
    ).rejects.toThrow("Rate limit excedido");

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Rate Limiter - cleanupExpiredRateLimits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve retornar 0 quando não há buckets expirados", async () => {
    mockQueryGet.mockResolvedValue({
      empty: true,
      docs: [],
      size: 0,
    });

    const result = await cleanupExpiredRateLimits();
    expect(result).toBe(0);
  });

  test("deve deletar buckets expirados em batch", async () => {
    const mockDocs = [
      { ref: { id: "bucket1" } },
      { ref: { id: "bucket2" } },
      { ref: { id: "bucket3" } },
    ];

    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: mockDocs,
      size: 3,
    });

    const result = await cleanupExpiredRateLimits();

    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(result).toBe(3);
  });

  test("deve propagar erros", async () => {
    mockQueryGet.mockRejectedValue(new Error("Firestore error"));

    await expect(cleanupExpiredRateLimits()).rejects.toThrow("Firestore error");
  });
});

describe("Rate Limiter - resetUserRateLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve deletar bucket do usuário", async () => {
    await resetUserRateLimit("user1");
    expect(mockDocDelete).toHaveBeenCalled();
  });

  test("deve usar keyPrefix personalizado", async () => {
    await resetUserRateLimit("user1", "GAME_CREATE");
    expect(mockDocDelete).toHaveBeenCalled();
  });

  test("deve propagar erros", async () => {
    mockDocDelete.mockRejectedValueOnce(new Error("Delete failed"));

    await expect(
      resetUserRateLimit("user1")
    ).rejects.toThrow("Delete failed");
  });
});

describe("Rate Limiter - getUserRateLimitStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve retornar 0 requests quando bucket não existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const result = await getUserRateLimitStats("user1");
    expect(result.currentRequests).toBe(0);
    expect(result.oldestRequest).toBeNull();
  });

  test("deve retornar contagem correta de requests", async () => {
    const now = Date.now();
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ requests: [now - 30000, now - 20000, now - 10000] }),
    });

    const result = await getUserRateLimitStats("user1");
    expect(result.currentRequests).toBe(3);
    expect(result.oldestRequest).toBeInstanceOf(Date);
  });

  test("deve retornar stats vazias em caso de erro", async () => {
    mockDocGet.mockRejectedValue(new Error("Firestore error"));

    const result = await getUserRateLimitStats("user1");
    expect(result.currentRequests).toBe(0);
    expect(result.oldestRequest).toBeNull();
  });
});

describe("Rate Limiter - checkRateLimitByIp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve sanitizar IP para usar como document ID", async () => {
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValue({
          exists: false,
        }),
        set: jest.fn(),
      };
      return callback(mockTransaction);
    });

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimitByIp("192.168.1.1", config);

    expect(result.allowed).toBe(true);
  });

  test("deve permitir request (fail-open) quando transação falha", async () => {
    mockRunTransaction.mockRejectedValue(new Error("Firestore error"));

    const config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 };
    const result = await checkRateLimitByIp("10.0.0.1", config);

    expect(result.allowed).toBe(true);
  });
});
