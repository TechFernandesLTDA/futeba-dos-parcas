/**
 * TESTES DE IDEMPOTÊNCIA — migration-example.ts (FIX #1584)
 *
 * Verifica que o log de XP usa ID determinístico
 * `game_{gameId}_user_{userId}` em vez de doc() aleatório,
 * garantindo que retries não criem logs duplicados.
 */

// Mock rate-limiter (padrão do projeto para callable tests)
jest.mock("../src/middleware/rate-limiter");

// Controla o mockDocFn para capturar IDs usados
const mockDocFn = jest.fn((id?: string) => ({
  id: id ?? "auto-id",
  get: jest.fn().mockResolvedValue({ exists: false }),
  set: jest.fn().mockResolvedValue(undefined),
  update: jest.fn().mockResolvedValue(undefined),
}));

const mockBatchUpdate = jest.fn().mockReturnThis();
const mockBatchSet = jest.fn().mockReturnThis();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

const mockBatchInstance = {
  update: mockBatchUpdate,
  set: mockBatchSet,
  commit: mockBatchCommit,
};

const mockCollection = jest.fn(() => ({
  doc: mockDocFn,
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ docs: [], empty: true }),
}));

const mockFirestoreInstance = {
  collection: mockCollection,
  batch: jest.fn(() => mockBatchInstance),
  runTransaction: jest.fn(),
};

// Mock firebase-admin antes de qualquer import do módulo testado
jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    firestore: jest.fn(() => mockFirestoreInstance),
    initializeApp: jest.fn(),
  };
  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
    arrayUnion: jest.fn((...args: any[]) => ({ _arrayUnion: args })),
    delete: jest.fn(() => ({ _delete: true })),
  };
  return mockAdmin;
});

// Mock do _db (lazy getter usado em migration-example.ts)
jest.mock("../src/_db", () => ({
  db: jest.fn(() => mockFirestoreInstance),
}));

// Mock do sistema idempotente (desabilitar pra forçar caminho legado)
let mockIsIdempotentEnabled = false;
jest.mock("../src/xp/processing", () => ({
  processXpIdempotent: jest.fn().mockResolvedValue({
    success: true,
    alreadyProcessed: false,
    transactionId: "game_game123_user_user456",
  }),
  processXpBatch: jest.fn().mockResolvedValue({ success: true }),
  XpTransactionData: {},
  XpBreakdown: {},
  XpMetadata: {},
}));

// Spy em isIdempotentXpEnabled via mock do módulo inteiro
jest.mock("../src/xp/migration-example", () => {
  const actual = jest.requireActual(
    "../src/xp/migration-example"
  ) as Record<string, unknown>;
  return {
    ...actual,
    isIdempotentXpEnabled: jest.fn(() =>
      Promise.resolve(mockIsIdempotentEnabled)
    ),
  };
});

// Import estático (após todos os mocks acima)
import {
  processXpHybrid,
  isIdempotentXpEnabled,
} from "../src/xp/migration-example";

// Helpers
const buildParams = (gameId: string, userId: string) => ({
  gameId,
  userId,
  currentXp: 50,
  finalXp: 80,
  currentLevel: 0,
  newLevel: 0,
  settings: {
    xp_presence: 10,
    xp_per_goal: 10,
    xp_per_assist: 7,
    xp_per_save: 8,
    xp_win: 20,
    xp_draw: 10,
  },
  conf: { goals: 1, assists: 0, saves: 0 },
  result: "WIN",
  isMvp: false,
  cleanSheetXp: 0,
  streakXp: 0,
  milesXp: 0,
  penaltyXp: 0,
  newMilestones: [] as string[],
});

describe("migration-example — FIX #1584: ID determinístico em xp_logs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsIdempotentEnabled = false; // força caminho legado
    mockDocFn.mockImplementation((id?: string) => ({
      id: id ?? "auto-id",
      get: jest.fn().mockResolvedValue({ exists: false }),
      set: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    }));
    mockFirestoreInstance.batch.mockReturnValue(mockBatchInstance);
    // Re-configura isIdempotentXpEnabled pra retornar false
    (isIdempotentXpEnabled as jest.Mock).mockResolvedValue(false);
  });

  /**
   * Retorna todos os IDs passados a doc() que seguem o padrão
   * `game_{gameId}_user_{userId}`.
   */
  const captureLogIds = (): string[] =>
    mockDocFn.mock.calls
      .map((c) => c[0] as string | undefined)
      .filter((id): id is string => !!id && id.startsWith("game_"));

  test(
    "deve criar xp_log com ID determinístico game_{gameId}_user_{userId}",
    async () => {
      await processXpHybrid(
        buildParams("game123", "user456"),
        mockBatchInstance as any
      );

      const logIds = captureLogIds();
      expect(logIds.length).toBeGreaterThan(0);
      expect(logIds[0]).toBe("game_game123_user_user456");
    }
  );

  test(
    "retry deve gerar mesmo ID — sem duplicação de log (idempotência)",
    async () => {
      const params = buildParams("gameABC", "userXYZ");

      // Primeira execução
      await processXpHybrid(params, mockBatchInstance as any);
      const firstIds = captureLogIds();

      // Simula reset de estado entre execuções
      mockDocFn.mockClear();

      // Segunda execução (retry)
      await processXpHybrid(params, mockBatchInstance as any);
      const secondIds = captureLogIds();

      expect(firstIds[0]).toBe("game_gameABC_user_userXYZ");
      expect(secondIds[0]).toBe("game_gameABC_user_userXYZ");
      // IDs idênticos = operação idempotente em Firestore (set sobrescreve)
      expect(firstIds[0]).toBe(secondIds[0]);
    }
  );

  test(
    "IDs diferentes para usuários diferentes no mesmo jogo",
    async () => {
      await processXpHybrid(
        buildParams("game1", "userA"),
        mockBatchInstance as any
      );
      const idsA = captureLogIds();

      mockDocFn.mockClear();

      await processXpHybrid(
        buildParams("game1", "userB"),
        mockBatchInstance as any
      );
      const idsB = captureLogIds();

      expect(idsA[0]).toBe("game_game1_user_userA");
      expect(idsB[0]).toBe("game_game1_user_userB");
      expect(idsA[0]).not.toBe(idsB[0]);
    }
  );
});
