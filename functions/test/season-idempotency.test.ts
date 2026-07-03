/**
 * REGRESSÃO #1281 — closeExpiredSeasons: standings não-idempotentes
 *
 * Verifica que season_final_standings usa ID determinístico
 * `${seasonId}_${user_id}` em vez de auto-ID (.doc() sem arg).
 *
 * Com auto-ID: re-runs por timeout/erro gravam um segundo conjunto de
 * standings com novos IDs → duplicatas permanentes no histórico.
 * Com ID determinístico: batch.set é um upsert idempotente pelo mesmo doc.
 */

// ==========================================
// MOCKS
// ==========================================

const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockGenericQueryGet = jest.fn();
const mockStandingsQueryGet = jest.fn();
const mockDocGet = jest.fn();

// Mock de transação (FIX #1470: criação atômica da próxima season monthly).
const mockTransactionGet = jest.fn().mockResolvedValue({exists: true});
const mockTransactionSet = jest.fn();
const mockRunTransaction = jest.fn(
  async (cb: (tx: unknown) => Promise<unknown>) => {
    await cb({
      get: mockTransactionGet,
      set: mockTransactionSet,
      update: jest.fn(),
      delete: jest.fn(),
    });
  }
);

// Capturar todos os IDs de doc passados a collection().doc(id)
const capturedStandingDocIds: string[] = [];
const mockStandingsDoc = jest.fn().mockImplementation((id?: string) => {
  if (id !== undefined) {
    capturedStandingDocIds.push(id);
  }
  return {get: mockDocGet, ref: {id: id ?? "__auto__"}};
});

// Mock da coleção season_final_standings com rastreamento de doc(id)
const mockStandingsCollection = {
  doc: mockStandingsDoc,
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: mockStandingsQueryGet,
};

// Mock das demais coleções (participações e seasons)
const mockGenericDoc = jest.fn().mockReturnValue({
  get: mockDocGet,
  ref: {id: "generic_ref"},
});
const mockGenericCollection = {
  doc: mockGenericDoc,
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: mockGenericQueryGet,
};

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      collection: jest.fn((name: string) => {
        if (name === "season_final_standings") {
          return mockStandingsCollection;
        }
        return mockGenericCollection;
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
  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  };
  return mockAdmin;
});

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: any, handler: () => Promise<void>) => {
    checkSeasonEndHandlerRef = handler;
    return handler;
  }),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 10,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

jest.mock("../src/constants", () => ({
  FIRESTORE_BATCH_LIMIT: 500,
  MVP_VOTE_WINDOW_HOURS: 24,
  FUNCTION_REGION: "southamerica-east1",
}));

// Handler registrado pelo onSchedule mock
let checkSeasonEndHandlerRef: (() => Promise<void>) | null = null;

// Importar após mocks
beforeAll(() => {
  jest.isolateModules(() => {
    require("../src/season/index");
  });
});

// ==========================================
// HELPERS
// ==========================================

function makeExpiredSeason(id: string, overrides: Record<string, unknown> = {}) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const endDateStr = yesterday.toISOString().split("T")[0];

  return {
    id,
    ref: {id, update: jest.fn()},
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

function makeParticipationDoc(userId: string) {
  return {
    data: () => ({
      user_id: userId,
      division: "OURO",
      league_rating: 1500,
      points: 30,
      wins: 10,
      draws: 0,
      losses: 2,
    }),
  };
}

// ==========================================
// TESTES
// ==========================================

describe("checkSeasonEnd — regressão #1281 standings idempotentes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedStandingDocIds.length = 0;
    mockBatchCommit.mockResolvedValue(undefined);
    mockDocGet.mockResolvedValue({exists: false});
    mockTransactionGet.mockResolvedValue({exists: true});
    mockGenericQueryGet.mockResolvedValue({
      empty: true,
      docs: [],
      size: 0,
    });
    mockStandingsQueryGet.mockResolvedValue({
      empty: true,
      docs: [],
      size: 0,
    });
  });

  test("handler registrado pelo onSchedule", () => {
    expect(checkSeasonEndHandlerRef).not.toBeNull();
  });

  test("REGRESSÃO #1281: doc ID é determinístico (${seasonId}_${user_id})", async () => {
    const seasonId = "monthly_2026_04";
    const expiredSeason = makeExpiredSeason(seasonId);
    const participants = [
      makeParticipationDoc("player-alpha"),
      makeParticipationDoc("player-beta"),
    ];

    mockGenericQueryGet
      .mockResolvedValueOnce({
        // seasons expiradas
        empty: false,
        docs: [expiredSeason],
      })
      .mockResolvedValueOnce({
        // participações da season
        empty: false,
        docs: participants,
      });
    mockStandingsQueryGet.mockResolvedValueOnce({
      // FIX #1290: standings já existentes (1º run = nenhum)
      empty: true,
      docs: [],
    });

    await checkSeasonEndHandlerRef!();

    // Verificar que doc() foi chamado com IDs determinísticos
    expect(capturedStandingDocIds).toContain(`${seasonId}_player-alpha`);
    expect(capturedStandingDocIds).toContain(`${seasonId}_player-beta`);

    // Garantir que não há auto-IDs (doc() chamado sem argumento)
    // Um doc() sem arg não aparecem em capturedStandingDocIds
    // (mockStandingsDoc só captura quando id !== undefined)
    expect(capturedStandingDocIds.every((id) => id.includes(seasonId))).toBe(true);
  });

  test("REGRESSÃO #1281: re-processar mesma season não duplica standings", async () => {
    const seasonId = "monthly_2026_04";
    const expiredSeason = makeExpiredSeason(seasonId);
    const participants = [
      makeParticipationDoc("player-gamma"),
      makeParticipationDoc("player-delta"),
    ];

    // Simular 2 runs da função na mesma season (re-run por retry/timeout)
    const makeQueryMock = () =>
      mockGenericQueryGet
        .mockResolvedValueOnce({empty: false, docs: [expiredSeason]})
        .mockResolvedValueOnce({empty: false, docs: participants});

    // Primeiro run
    makeQueryMock();
    mockStandingsQueryGet.mockResolvedValueOnce({empty: true, docs: []});
    await checkSeasonEndHandlerRef!();
    const idsAfterFirstRun = [...capturedStandingDocIds];

    // Segundo run (simula retry)
    capturedStandingDocIds.length = 0;
    jest.clearAllMocks();
    capturedStandingDocIds.length = 0;
    mockBatchCommit.mockResolvedValue(undefined);
    mockDocGet.mockResolvedValue({exists: false});
    makeQueryMock();
    mockStandingsQueryGet.mockResolvedValueOnce({empty: true, docs: []});
    await checkSeasonEndHandlerRef!();
    const idsAfterSecondRun = [...capturedStandingDocIds];

    // Os IDs gerados nos dois runs devem ser idênticos (upsert idempotente)
    expect(idsAfterFirstRun.sort()).toEqual(idsAfterSecondRun.sort());

    // Com IDs determinísticos, batch.set é upsert — sem duplicatas
    // O número de batch.set calls deve ser o mesmo entre runs
    // (cada participante gera exatamente 1 set call por run)
    // Nota: não podemos verificar estado Firestore em unit test (mock),
    // mas verificamos que os doc IDs são os mesmos → Firestore fará upsert
    expect(idsAfterFirstRun).toHaveLength(participants.length);
    expect(idsAfterSecondRun).toHaveLength(participants.length);
  });

  test("batch.set é chamado com campo season_id e user_id corretos", async () => {
    const seasonId = "monthly_2026_05";
    const expiredSeason = makeExpiredSeason(seasonId);
    const participants = [makeParticipationDoc("player-epsilon")];

    mockGenericQueryGet
      .mockResolvedValueOnce({empty: false, docs: [expiredSeason]})
      .mockResolvedValueOnce({empty: false, docs: participants});
    mockStandingsQueryGet.mockResolvedValueOnce({empty: true, docs: []});

    await checkSeasonEndHandlerRef!();

    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        season_id: seasonId,
        user_id: "player-epsilon",
      })
    );
  });

  test("REGRESSÃO #1290: frozen_at original é preservado em re-run", async () => {
    const seasonId = "monthly_2026_06";
    const expiredSeason = makeExpiredSeason(seasonId);
    const participants = [makeParticipationDoc("player-zeta")];
    const originalFrozenAt = {_type: "OriginalTimestamp"};

    mockGenericQueryGet
      .mockResolvedValueOnce({empty: false, docs: [expiredSeason]})
      .mockResolvedValueOnce({empty: false, docs: participants});
    mockStandingsQueryGet.mockResolvedValueOnce({
      // standing já gravada num run anterior, com frozen_at original
      empty: false,
      size: 1,
      docs: [
        {
          id: `${seasonId}_player-zeta`,
          data: () => ({frozen_at: originalFrozenAt}),
        },
      ],
    });

    await checkSeasonEndHandlerRef!();

    // frozen_at deve ser o ORIGINAL, não um novo serverTimestamp()
    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({frozen_at: originalFrozenAt})
    );
  });

  test("REGRESSÃO #1291: participação com user_id inválido é ignorada", async () => {
    const seasonId = "monthly_2026_07";
    const expiredSeason = makeExpiredSeason(seasonId);
    const participants = [
      makeParticipationDoc("player-valid"),
      {data: () => ({user_id: "", division: "OURO", points: 0})},
      {data: () => ({user_id: undefined, division: "OURO", points: 0})},
    ];

    mockGenericQueryGet
      .mockResolvedValueOnce({empty: false, docs: [expiredSeason]})
      .mockResolvedValueOnce({empty: false, docs: participants});
    mockStandingsQueryGet.mockResolvedValueOnce({empty: true, docs: []});

    await checkSeasonEndHandlerRef!();

    // Só o participante válido vira standing; inválidos são pulados
    expect(capturedStandingDocIds).toEqual([`${seasonId}_player-valid`]);
    // Nenhum batch.set de standing com user_id inválido
    expect(mockBatchSet).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({user_id: ""})
    );
    expect(mockBatchSet).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({user_id: undefined})
    );
  });
});
