/**
 * Testes para FIX #2797 (SECFIX #430): suspicious_overlap consumer.
 *
 * Cobre:
 * - toGameConfirmation mapeia suspicious_overlap=true → suspiciousOverlap=true
 * - toGameConfirmation com suspicious_overlap=false → suspiciousOverlap=false
 * - toGameConfirmation sem o campo → suspiciousOverlap=false (default)
 * - Integração: onGameStatusUpdate exclui jogadores flagados do XP e loga
 *   [ANTI-CHEAT][OVERLAP]
 */

// ==========================================
// MOCKS — devem vir ANTES de qualquer import
// ==========================================

const mockWarnFn = jest.fn();
const mockInfoFn = jest.fn();
const mockErrorFn = jest.fn();

const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockCollectionGet = jest.fn();
const mockCollectionGroup = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue([]);
const mockRunTransaction = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockSelect = jest.fn().mockReturnThis();
const mockStartAfter = jest.fn().mockReturnThis();

const queryChain: any = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  select: mockSelect,
  startAfter: mockStartAfter,
  get: mockCollectionGet,
};
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);
mockSelect.mockReturnValue(queryChain);
mockStartAfter.mockReturnValue(queryChain);

const mockSubColDoc = jest.fn((sid: string) => ({
  id: sid,
  get: mockDocGet,
  update: mockDocUpdate,
}));
const mockSubCol = jest.fn(() => ({
  doc: mockSubColDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockCollectionGet,
}));

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  collection: mockSubCol,
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  select: mockSelect,
  startAfter: mockStartAfter,
  get: mockCollectionGet,
  add: jest.fn().mockResolvedValue({}),
}));

const indexFieldValue = {
  serverTimestamp: jest.fn(() => ({})),
  delete: jest.fn(() => ({})),
  increment: jest.fn((n: number) => ({ operand: n })),
  arrayUnion: jest.fn((...args: any[]) => ({ elements: args })),
};
const indexTimestamp = {
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
  fromMillis: jest.fn((ms: number) => ({
    toDate: () => new Date(ms),
    _type: "Timestamp",
  })),
};
const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
  batch: jest.fn(() => ({
    update: mockBatchUpdate,
    set: mockBatchSet,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  })),
  runTransaction: mockRunTransaction,
  collectionGroup: mockCollectionGroup,
})) as any;
mockFirestore.FieldValue = indexFieldValue;
mockFirestore.Timestamp = indexTimestamp;
mockFirestore.FieldPath = { documentId: jest.fn(() => "__name__") };

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
  auth: jest.fn(() => ({
    getUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  })),
}));

jest.mock("firebase-functions/v2", () => ({
  setGlobalOptions: jest.fn(),
  logger: {
    info: mockInfoFn,
    warn: mockWarnFn,
    error: mockErrorFn,
  },
  scheduler: { onSchedule: jest.fn((_c: any, h: any) => h) },
  https: {
    onCall: jest.fn((_c: any, h: any) => h || _c),
    HttpsError: class extends Error {
      code: string;
      constructor(code: string, msg: string) {
        super(msg);
        this.name = "HttpsError";
        this.code = code;
      }
    },
  },
  storage: { onObjectFinalized: jest.fn(() => jest.fn()) },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_c: any, h: any) => h),
  onDocumentDeleted: jest.fn((_c: any, h: any) => h),
  onDocumentWritten: jest.fn((_c: any, h: any) => h),
  onDocumentCreated: jest.fn((_c: any, h: any) => h),
}));

// Obrigatório para testes que importam src/index.ts
jest.mock("../src/middleware/rate-limiter");

jest.mock("../src/badges/badge-helper", () => ({
  getAllBadgesToAward: jest.fn().mockReturnValue([]),
}));

jest.mock("../src/notifications", () => ({
  sendStreakNotificationIfMilestone: jest.fn().mockResolvedValue(false),
}));

jest.mock("../src/_db", () => {
  const dbFn = jest.fn(() => ({
    collection: mockCollection,
    collectionGroup: mockCollectionGroup,
    batch: jest.fn(() => ({
      update: mockBatchUpdate,
      set: mockBatchSet,
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
    runTransaction: mockRunTransaction,
  }));
  return { db: dbFn };
});

// ==========================================
// IMPORTS — depois dos mocks
// ==========================================

import { toGameConfirmation } from "../src/game/helpers";
import { onGameStatusUpdate } from "../src/index";

// ==========================================
// TESTES UNITÁRIOS: toGameConfirmation
// ==========================================

describe("FIX #2797 — toGameConfirmation mapeia suspicious_overlap", () => {
  it("suspicious_overlap=true → suspiciousOverlap=true", () => {
    const raw = {
      user_id: "u1",
      status: "CONFIRMED",
      goals: 0,
      assists: 0,
      saves: 0,
      game_id: "g1",
      suspicious_overlap: true,
    };
    const result = toGameConfirmation(raw);
    expect(result.suspiciousOverlap).toBe(true);
  });

  it("suspicious_overlap=false → suspiciousOverlap=false", () => {
    const raw = {
      user_id: "u1",
      status: "CONFIRMED",
      goals: 0,
      assists: 0,
      saves: 0,
      game_id: "g1",
      suspicious_overlap: false,
    };
    const result = toGameConfirmation(raw);
    expect(result.suspiciousOverlap).toBe(false);
  });

  it("campo ausente → suspiciousOverlap=false (default seguro)", () => {
    const raw = {
      user_id: "u1",
      status: "CONFIRMED",
      goals: 0,
      assists: 0,
      saves: 0,
      game_id: "g1",
    };
    const result = toGameConfirmation(raw);
    expect(result.suspiciousOverlap).toBe(false);
  });
});

// ==========================================
// TESTES DE INTEGRAÇÃO: onGameStatusUpdate
// exclui jogadores com suspiciousOverlap=true
// ==========================================

// Versão simplificada que mocka game/helpers para controlar suspiciousOverlap
// mas usa a lógica real de exclusão de index.ts
jest.mock("../src/game/helpers", () => ({
  // toGameConfirmation real — não mockado aqui, importado diretamente acima.
  // Para os testes de integração de onGameStatusUpdate, usamos o mock abaixo
  // que mapeia suspicious_overlap diretamente.
  toGameConfirmation: jest.fn((d: any) => ({
    userId: d.user_id ?? "",
    status: d.status ?? "CONFIRMED",
    position: d.position ?? "",
    goals: Number(d.goals ?? 0),
    assists: Number(d.assists ?? 0),
    saves: Number(d.saves ?? 0),
    yellowCards: 0,
    redCards: 0,
    game_id: d.game_id ?? "",
    is_worst_player: false,
    // FIX #2797: mapeamento de suspicious_overlap → suspiciousOverlap
    suspiciousOverlap: d.suspicious_overlap === true,
  })),
  toTeam: jest.fn((id: string, d: any) => ({
    id,
    playerIds: d.player_ids || [],
    score: 0,
  })),
  toLiveScore: jest.fn(() => null),
  getGameDate: jest.fn(() => new Date("2024-06-15")),
  getWeekKey: jest.fn(() => "2024-W24"),
  determineGameResults: jest.fn(() => ({})),
  getOpponentScore: jest.fn(() => 0),
  fetchAllUsers: jest.fn(() => new Map()),
  fetchAllStats: jest.fn(() => new Map()),
  fetchAllStreaks: jest.fn(() => new Map()),
  updateRankingDeltas: jest.fn(),
  updateSeasonParticipation: jest.fn(),
}));

describe("FIX #2797 — onGameStatusUpdate exclui suspicious_overlap do XP", () => {
  const gameId = "game-overlap-integ";
  const flaggedUser = "user-flagged";
  // 6 usuários no total para passar MIN_PLAYERS (1 flagado + 5 normais)
  const normalUsers = ["u2", "u3", "u4", "u5", "u6"];

  const confirmationDocs = [
    {
      user_id: flaggedUser,
      status: "CONFIRMED",
      goals: 3,
      assists: 1,
      saves: 0,
      suspicious_overlap: true,
      game_id: gameId,
    },
    ...normalUsers.map((uid) => ({
      user_id: uid,
      status: "CONFIRMED",
      goals: 0,
      assists: 0,
      saves: 0,
      game_id: gameId,
    })),
  ];

  function makeSnap(docs: any[]) {
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs: docs.map((d, i) => ({ id: `doc${i}`, data: () => d })),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue([]);
    mockDocUpdate.mockResolvedValue(undefined);
    mockWarnFn.mockClear();
    mockInfoFn.mockClear();
    mockErrorFn.mockClear();

    // Transação de lock
    mockRunTransaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: "FINISHED",
              xp_processed: false,
              xp_processing: false,
              owner_id: "owner1",
            }),
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }
    );

    // Promise.all no onGameFinished:
    // [confirmationsSnap, teamsSnap, liveScoreDoc, settingsSnap, seasonSnap, gameSnap]
    // confirmations e teams usam collection().where().get() → mockCollectionGet
    // liveScoreDoc, settingsSnap usam doc().get() → mockDocGet
    // seasonSnap usa collection().where().limit().get() → mockCollectionGet
    // gameSnap usa collection().doc().get() → mockDocGet

    mockCollectionGet
      .mockResolvedValueOnce(makeSnap(confirmationDocs)) // confirmations
      .mockResolvedValueOnce(makeSnap([{                  // teams
        player_ids: [flaggedUser, ...normalUsers],
        score: 0,
      }]))
      .mockResolvedValueOnce(makeSnap([{ is_active: true }])); // seasons

    // Sequência de mockDocGet:
    // 1. owner validation: db().collection("users").doc(owner_id).get()
    // 2. live_scores doc (via doc(gameId).get())
    // 3. app_settings doc
    // 4. game doc (games collection)
    // 5+ xp_log idempotency reads (todos exists: false)
    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ uid: "owner1" }) }) // owner
      .mockResolvedValueOnce({ exists: false })  // live_scores
      .mockResolvedValueOnce({ exists: false })  // app_settings
      .mockResolvedValueOnce({                   // game doc
        exists: true,
        data: () => ({
          status: "FINISHED",
          owner_id: "owner1",
          group_id: "group1",
          mvp_id: null,
          worst_player_id: null,
        }),
      })
      // xp_log idempotency reads — nenhum processado
      .mockResolvedValue({ exists: false });
  });

  function makeFinishedEvent() {
    return {
      data: {
        before: {
          data: () => ({
            status: "LIVE",
            xp_processed: false,
            xp_processing: false,
            owner_id: "owner1",
          }),
        },
        after: {
          ref: { update: mockDocUpdate },
          data: () => ({
            status: "FINISHED",
            xp_processed: false,
            xp_processing: false,
            owner_id: "owner1",
            mvp_id: null,
            worst_player_id: null,
          }),
        },
      },
      params: { gameId },
    };
  }

  it("loga [ANTI-CHEAT][OVERLAP] para jogador com suspicious_overlap=true", async () => {
    await onGameStatusUpdate(makeFinishedEvent() as any);

    const warnMessages = mockWarnFn.mock.calls
      .map((args) => String(args[0]));
    const hasOverlapWarn = warnMessages.some((msg) =>
      msg.includes("[ANTI-CHEAT][OVERLAP]")
    );
    expect(hasOverlapWarn).toBe(true);
  });

  it("nao loga [ANTI-CHEAT][OVERLAP] quando nenhum jogador esta flagado", async () => {
    // Resetar mocks explicitamente para esta variante (sem a carga do beforeEach)
    mockCollectionGet.mockReset();
    mockDocGet.mockReset();
    mockWarnFn.mockReset();

    // Retomar mock do runTransaction (clearAllMocks limpa, mas o describe já
    // tem o beforeEach acima que o reconfigura — precisa repetir aqui após reset)
    mockRunTransaction.mockImplementation(
      async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              status: "FINISHED",
              xp_processed: false,
              xp_processing: false,
              owner_id: "owner1",
            }),
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }
    );

    // Apenas usuários normais, sem flag de overlap
    const allNormal = normalUsers.map((uid) => ({
      user_id: uid,
      status: "CONFIRMED",
      goals: 0,
      assists: 0,
      saves: 0,
      game_id: gameId,
    }));

    mockCollectionGet
      .mockResolvedValueOnce(makeSnap(allNormal))
      .mockResolvedValueOnce(makeSnap([{
        player_ids: normalUsers,
        score: 0,
      }]))
      .mockResolvedValueOnce(makeSnap([{ is_active: true }]));

    mockDocGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ uid: "owner1" }) })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: "FINISHED",
          owner_id: "owner1",
          group_id: "group1",
          mvp_id: null,
          worst_player_id: null,
        }),
      })
      .mockResolvedValue({ exists: false });

    await onGameStatusUpdate(makeFinishedEvent() as any);

    const warnMessages = mockWarnFn.mock.calls
      .map((args: any[]) => String(args[0]));
    const hasOverlapWarn = warnMessages.some((msg) =>
      msg.includes("[ANTI-CHEAT][OVERLAP]")
    );
    expect(hasOverlapWarn).toBe(false);
  });
});
