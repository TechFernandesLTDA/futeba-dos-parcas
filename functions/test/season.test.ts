/**
 * TESTES DO GERENCIAMENTO DE SEASON
 *
 * Testa as Cloud Functions de season/index.ts:
 * - checkSeasonEnd: Verificação e encerramento de seasons expiradas
 */

// Mock do firebase-admin
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockQueryGet = jest.fn();
const mockDocGet = jest.fn();
const mockDocRef = { id: "next_season_ref" };

// Mock de transação (FIX #1470: criação atômica da próxima season monthly).
// transaction.get reusa mockDocGet — testes controlam "exists" via mockDocGet.
const mockTransactionSet = jest.fn();
const mockRunTransaction = jest.fn(
  async (cb: (tx: unknown) => Promise<unknown>) => {
    await cb({
      get: mockDocGet,
      set: mockTransactionSet,
      update: jest.fn(),
      delete: jest.fn(),
    });
  }
);

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
          ref: mockDocRef,
        }),
        where: jest.fn().mockReturnThis(),
        get: mockQueryGet,
      }),
      batch: jest.fn(() => ({
        update: mockBatchUpdate,
        set: mockBatchSet,
        commit: mockBatchCommit,
      })),
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

// Mock firebase-functions v2/scheduler
let checkSeasonEndHandler: (() => Promise<void>) | null = null;

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((schedule: string, handler: () => Promise<void>) => {
    checkSeasonEndHandler = handler;
    return handler;
  }),
}));

// Mock firebase-functions/v2 logger
jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock rate-limiter (obrigatório por CLAUDE.md)
jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60000),
  }),
  RATE_LIMITS: {
    DEFAULT: { maxRequests: 10, windowMs: 60000 },
    BATCH_OPERATION: { maxRequests: 5, windowMs: 60000, keyPrefix: "batch" },
  },
}));

// Mock constants
jest.mock("../src/constants", () => ({
  FIRESTORE_BATCH_LIMIT: 500,
  MVP_VOTE_WINDOW_HOURS: 24,
}));

// Importar o módulo APÓS os mocks
beforeAll(() => {
  jest.isolateModules(() => {
    require("../src/season/index");
  });
});

// ==========================================
// HELPERS
// ==========================================

/** Cria um doc de season expirada (end_date ontem) */
function makeExpiredSeason(id: string, overrides: Record<string, unknown> = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const endDateStr = yesterday.toISOString().split("T")[0];

  return {
    id,
    ref: { id, update: jest.fn() },
    data: () => ({
      name: `Temporada Teste ${id}`,
      is_active: true,
      end_date: endDateStr,
      start_date: "2026-01-01",
      type: "MONTHLY",
      ...overrides,
    }),
  };
}

/** Cria um doc de season ativa (end_date no futuro) */
function makeActiveSeason(id: string) {
  const future = new Date();
  future.setDate(future.getDate() + 15);
  const futureDateStr = future.toISOString().split("T")[0];

  return {
    id,
    ref: { id },
    data: () => ({
      name: `Temporada Ativa ${id}`,
      is_active: true,
      end_date: futureDateStr,
      start_date: "2026-01-01",
    }),
  };
}

// ==========================================
// TESTES: checkSeasonEnd
// ==========================================

describe("checkSeasonEnd - handler registrado", () => {
  test("deve registrar o handler no onSchedule", () => {
    expect(checkSeasonEndHandler).not.toBeNull();
    expect(typeof checkSeasonEndHandler).toBe("function");
  });
});

describe("checkSeasonEnd - season lista vazia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  test("deve retornar sem processar quando não há seasons expiradas", async () => {
    // Query retorna vazio (nenhuma season expirada)
    mockQueryGet.mockResolvedValue({
      empty: true,
      docs: [],
    });

    await checkSeasonEndHandler!();

    // Nenhum batch commit deve ter ocorrido
    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(mockBatchUpdate).not.toHaveBeenCalled();
  });
});

describe("checkSeasonEnd - encerramento de season expirada", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    // Por padrão: próxima season não existe
    mockDocGet.mockResolvedValue({ exists: false });
  });

  test("deve marcar season como inativa quando end_date passou", async () => {
    const expiredSeason = makeExpiredSeason("monthly_2026_01");

    // Primeira query: seasons expiradas
    // Segunda query (within loop): participações da season
    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [expiredSeason],
      })
      .mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

    await checkSeasonEndHandler!();

    // Deve ter atualizado a season para is_active: false
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expiredSeason.ref,
      expect.objectContaining({ is_active: false })
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  test("deve criar final standings para participações existentes", async () => {
    const expiredSeason = makeExpiredSeason("monthly_2026_01");

    const participationDocs = [
      {
        data: () => ({
          user_id: "player1",
          division: "OURO",
          league_rating: 1500,
          points: 30,
          wins: 10,
          draws: 0,
          losses: 2,
        }),
      },
      {
        data: () => ({
          user_id: "player2",
          division: "PRATA",
          league_rating: 1200,
          points: 18,
          wins: 6,
          draws: 0,
          losses: 6,
        }),
      },
    ];

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [expiredSeason],
      })
      .mockResolvedValueOnce({
        // participações
        empty: false,
        docs: participationDocs,
      });

    await checkSeasonEndHandler!();

    // Deve ter criado final standings via batch.set (mínimo 2: um por participação)
    expect(mockBatchSet.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        season_id: "monthly_2026_01",
        user_id: "player1",
        final_division: "OURO",
      })
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  test("deve criar próxima season mensal automaticamente", async () => {
    const expiredSeason = makeExpiredSeason("monthly_2026_01", {
      end_date: "2026-01-31",
      name: "Temporada Janeiro 2026",
    });

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [expiredSeason],
      })
      .mockResolvedValueOnce({
        // participações vazias
        empty: true,
        docs: [],
      });

    // Próxima season não existe ainda
    mockDocGet.mockResolvedValue({ exists: false });

    await checkSeasonEndHandler!();

    // Deve ter criado a próxima season via transaction.set (FIX #1470)
    expect(mockTransactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        is_active: true,
        type: "MONTHLY",
        start_date: "2026-02-01",
      })
    );
  });

  test("não deve criar próxima season se já existe", async () => {
    const expiredSeason = makeExpiredSeason("monthly_2026_01", {
      end_date: "2026-01-31",
    });

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [expiredSeason],
      })
      .mockResolvedValueOnce({
        empty: true,
        docs: [],
      });

    // Próxima season JÁ EXISTE
    mockDocGet.mockResolvedValue({ exists: true });

    await checkSeasonEndHandler!();

    // Não deve ter tentado criar nova season via transaction.set (FIX #1470)
    const setCallsWithNewSeason = (mockTransactionSet.mock.calls as any[]).filter(
      ([, data]) => data?.is_active === true && data?.type === "MONTHLY"
    );
    expect(setCallsWithNewSeason).toHaveLength(0);
  });

  test("deve processar múltiplas seasons expiradas em batch", async () => {
    const season1 = makeExpiredSeason("monthly_2025_11", {
      end_date: "2025-11-30",
    });
    const season2 = makeExpiredSeason("monthly_2025_12", {
      end_date: "2025-12-31",
    });

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [season1, season2],
      })
      // Participações da season 1
      .mockResolvedValueOnce({ empty: true, docs: [] })
      // Participações da season 2
      .mockResolvedValueOnce({ empty: true, docs: [] });

    // Próximas seasons não existem
    mockDocGet.mockResolvedValue({ exists: false });

    await checkSeasonEndHandler!();

    // Ambas seasons devem ter sido marcadas como inativas
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      season1.ref,
      expect.objectContaining({ is_active: false })
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      season2.ref,
      expect.objectContaining({ is_active: false })
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});

describe("checkSeasonEnd - seasons não mensais", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockDocGet.mockResolvedValue({ exists: false });
  });

  test("não deve criar próxima season para seasons não-mensais", async () => {
    // Season sem prefixo "monthly" — não deve criar próxima
    const customSeason = makeExpiredSeason("custom_season_2026", {
      end_date: "2026-01-15",
      type: "CUSTOM",
    });
    // Sobrescrever id para não começar com "monthly"
    Object.defineProperty(customSeason, "id", { value: "custom_season_2026" });

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [customSeason],
      })
      .mockResolvedValueOnce({ empty: true, docs: [] });

    await checkSeasonEndHandler!();

    // Season deve ser fechada
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      customSeason.ref,
      expect.objectContaining({ is_active: false })
    );

    // Mas não deve criar próxima season (transaction nem é chamada p/ não-mensal)
    const setCallsWithNewSeason = (mockTransactionSet.mock.calls as any[]).filter(
      ([, data]) => data?.is_active === true
    );
    expect(setCallsWithNewSeason).toHaveLength(0);
  });
});
