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

const queryChain: any = { where: mockWhere, orderBy: mockOrderBy, limit: mockLimit, select: mockSelect, startAfter: mockStartAfter, get: mockCollectionGet };
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);
mockSelect.mockReturnValue(queryChain);
mockStartAfter.mockReturnValue(queryChain);

const mockSubColDoc = jest.fn((sid: string) => ({ id: sid, get: mockDocGet, update: mockDocUpdate }));
const mockSubCol = jest.fn((name: string) => ({ doc: mockSubColDoc, where: mockWhere, orderBy: mockOrderBy, limit: mockLimit, get: mockCollectionGet }));

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  collection: mockSubCol,
}));

const mockCollection = jest.fn((name?: string) => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  select: mockSelect,
  startAfter: mockStartAfter,
  get: mockCollectionGet,
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
  fromMillis: jest.fn((ms: number) => ({ toDate: () => new Date(ms), _type: "Timestamp" })),
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

const mockDeleteFiles = jest.fn().mockResolvedValue([]);

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
  auth: jest.fn(() => ({
    getUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  })),
  storage: jest.fn(() => ({
    bucket: jest.fn(() => ({deleteFiles: mockDeleteFiles})),
  })),
}));

jest.mock("firebase-functions/v2", () => ({
  setGlobalOptions: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
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

jest.mock("../src/badges/badge-helper", () => ({
  getAllBadgesToAward: jest.fn().mockReturnValue([]),
}));

jest.mock("../src/game/helpers", () => ({
  toGameConfirmation: jest.fn((d: any) => d),
  toTeam: jest.fn((id: string, d: any) => ({ id, ...d, playerIds: d.player_ids || [] })),
  toLiveScore: jest.fn((d: any) => d),
  getGameDate: jest.fn(() => new Date("2024-06-15")),
  getWeekKey: jest.fn(() => "2024-W24"),
  determineGameResults: jest.fn(() => ({})),
  getOpponentScore: jest.fn(() => 0),
  fetchAllUsers: jest.fn(() => new Map()),
  fetchAllStats: jest.fn(() => new Map()),
  fetchAllStreaks: jest.fn(() => new Map()),
  isParticipationEligible: jest.fn((c: any) =>
    c.status === "CONFIRMED" &&
    c.suspiciousOverlap !== true &&
    c.suspicious_overlap !== true
  ),
  updateRankingDeltas: jest.fn(),
  updateSeasonParticipation: jest.fn(),
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

import { recalculateLeagueRating, onGameDeleted, onGroupDeleted, onConfirmationWrite } from "../src/index";

describe("Index — Funcoes do index.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunTransaction.mockReset();
    mockBatchCommit.mockResolvedValue([]);
    mockDocUpdate.mockResolvedValue(undefined);
    // FIX #4049: coletas extras (game_photos/game_videos) retornam vazio por
    // padrão quando o teste não programa respostas específicas.
    mockCollectionGet.mockResolvedValue({docs: [], size: 0});
    mockDeleteFiles.mockResolvedValue([]);
  });

  describe("recalculateLeagueRating", () => {
    it("ignora quando games_played nao mudou", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Joao" }) });

      const event = {
        data: {
          before: { data: () => ({ user_id: "user1", games_played: 5 }) },
          after: { data: () => ({ user_id: "user1", games_played: 5 }) },
        },
        params: { partId: "part1" },
      };

      await recalculateLeagueRating(event);

      expect(mockDocUpdate).not.toHaveBeenCalled();
      expect(mockCollectionGet).not.toHaveBeenCalled();
    });

    it("ignora quando userId ausente no after", async () => {
      const event = {
        data: {
          before: { data: () => ({ games_played: 5 }) },
          after: { data: () => ({ games_played: 6 }) },
        },
        params: { partId: "part1" },
      };

      await recalculateLeagueRating(event);

      expect(mockDocUpdate).not.toHaveBeenCalled();
    });

    it("ignora quando user nao encontrado no Firestore", async () => {
      mockDocGet.mockResolvedValue({ exists: false, data: () => null });

      const event = {
        data: {
          before: { data: () => ({ games_played: 5 }) },
          after: { data: () => ({ user_id: "user1", games_played: 6 }) },
        },
        params: { partId: "part1" },
      };

      await recalculateLeagueRating(event);

      expect(mockDocUpdate).not.toHaveBeenCalled();
    });

    it("retorna cedo quando partId sem data", async () => {
      const event = {
        data: null,
        params: { partId: "part1" },
      };

      await recalculateLeagueRating(event);

      expect(mockDocUpdate).not.toHaveBeenCalled();
    });
  });

  describe("onGameDeleted", () => {
    const makeEvent = (overrides: any = {}) => ({
      data: { exists: true, data: () => ({ owner_id: "owner1", ...overrides }) },
      params: { gameId: "game1" },
    });

    it("deleta confirmations, teams, events, votes, logs em cascata", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [{ ref: { id: "c1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "t1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "e1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "v1" } }], size: 1 });
      mockDocGet.mockResolvedValueOnce({ exists: false });
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [{ ref: { id: "x1" } }], size: 1 });

      await onGameDeleted(makeEvent());

      expect(mockBatchDelete).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("deleta live_score quando existe", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 });
      mockDocGet.mockResolvedValueOnce({ exists: true });
      mockCollectionGet.mockResolvedValueOnce({ docs: [], size: 0 });

      await onGameDeleted(makeEvent());

      expect(mockBatchDelete).toHaveBeenCalled();
    });

    it("deleta apenas confirmations quando outras colecoes vazias", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [{ ref: { id: "c1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 });
      mockDocGet.mockResolvedValueOnce({ exists: false });
      mockCollectionGet.mockResolvedValueOnce({ docs: [], size: 0 });

      await onGameDeleted(makeEvent());

      expect(mockBatchDelete).toHaveBeenCalled();
    });

    it("retorna cedo quando jogo sem dados pre-delecao", async () => {
      await onGameDeleted({
        data: { exists: false },
        params: { gameId: "game1" },
      });

      expect(mockCollectionGet).not.toHaveBeenCalled();
      expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it("loga erro mas segue quando a deleção de objetos do Storage falha (#4049)", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false });
      mockDeleteFiles.mockRejectedValueOnce(new Error("storage unavailable"));

      await onGameDeleted(makeEvent());

      const logger = jest.requireMock("firebase-functions/v2").logger;
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Error deleting storage objects"),
        expect.any(Error),
      );
    });
  });

  describe("onGroupDeleted", () => {
    it("deleta membros e subcolecoes em cascata", async () => {
      // FIX #2605: member-based iteration for user group refs.
      // Member docs must include data() with user_id so the new code
      // can extract the uid to delete users/{uid}/groups/{groupId}.
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [{ ref: { id: "m1" }, data: () => ({ user_id: "user1" }) }], size: 1 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "tx1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "g1" } }], size: 1 });

      await onGroupDeleted({
        data: { data: () => null },
        params: { groupId: "group1" },
      });

      expect(mockBatchDelete).toHaveBeenCalled();
      expect(mockBatchUpdate).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("deleta cashbox entries e join_requests", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "tx1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "jr1" } }], size: 1 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 });

      await onGroupDeleted({
        data: { data: () => null },
        params: { groupId: "group1" },
      });

      expect(mockBatchDelete).toHaveBeenCalled();
    });

    it("marca jogos do grupo como orphaned", async () => {
      mockCollectionGet
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [], size: 0 })
        .mockResolvedValueOnce({ docs: [{ ref: { id: "game1" }, data: () => ({}) }], size: 1 });

      await onGroupDeleted({
        data: { data: () => null },
        params: { groupId: "group1" },
      });

      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ group_deleted: true }),
      );
    });

    it("pagina wall_posts e remove group_polls sem acumular a cascata", async () => {
      const wallPage = Array.from({length: 200}, (_, index) => ({
        ref: {id: `wall-${index}`},
        data: () => ({}),
      }));
      const wallTail = [{ref: {id: "wall-200"}, data: () => ({})}];
      const poll = {ref: {id: "poll-1"}, data: () => ({})};
      const empty = {docs: [], empty: true, size: 0};
      mockCollectionGet
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce({
          docs: wallPage,
          empty: false,
          size: wallPage.length,
        })
        .mockResolvedValueOnce({docs: wallTail, empty: false, size: 1})
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce({docs: [poll], empty: false, size: 1})
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce(empty);

      await onGroupDeleted({
        data: {data: () => null},
        params: {groupId: "group1"},
      });

      expect(mockBatchDelete).toHaveBeenCalledTimes(202);
      expect(mockBatchCommit).toHaveBeenCalledTimes(3);
    });

    it("retry reprocessa somente a página cujo commit falhou", async () => {
      const wall = {ref: {id: "wall-retry"}, data: () => ({})};
      const empty = {docs: [], empty: true, size: 0};
      // Primeira tentativa chega até wall_posts e o batch atômico falha.
      for (let index = 0; index < 4; index++) {
        mockCollectionGet.mockResolvedValueOnce(empty);
      }
      mockCollectionGet.mockResolvedValueOnce({
        docs: [wall], empty: false, size: 1,
      });
      // Segunda tentativa relê os quatro prefixos e a mesma página pendente.
      for (let index = 0; index < 4; index++) {
        mockCollectionGet.mockResolvedValueOnce(empty);
      }
      mockCollectionGet.mockResolvedValueOnce({
        docs: [wall], empty: false, size: 1,
      });
      for (let index = 0; index < 4; index++) {
        mockCollectionGet.mockResolvedValueOnce(empty);
      }
      mockBatchCommit
        .mockRejectedValueOnce(new Error("UNAVAILABLE"))
        .mockResolvedValue([]);

      const event = {
        data: {data: () => null},
        params: {groupId: "group1"},
      };
      await expect(onGroupDeleted(event)).rejects.toThrow("UNAVAILABLE");
      await expect(onGroupDeleted(event)).resolves.toBeUndefined();

      const retryDeletes = mockBatchDelete.mock.calls
        .filter(([ref]) => ref === wall.ref);
      expect(retryDeletes).toHaveLength(2);
    });
  });

  describe("onConfirmationWrite", () => {
    const makeEvent = (before: any, after: any, id: string | null = "event-1") => ({
      ...(id === null ? {} : {id}),
      data: {
        before: { data: () => before },
        after: { data: () => after },
      },
      params: { confirmationId: "g1_u1" },
    });

    const installIdempotentTransaction = (markerInitiallyExists = false) => {
      let markerExists = markerInitiallyExists;
      const transactionUpdate = jest.fn();
      const transactionCreate = jest.fn(() => {
        markerExists = true;
      });
      mockRunTransaction.mockImplementation(async (callback: any) => {
        let readIndex = 0;
        return callback({
          get: jest.fn(async () => {
            readIndex += 1;
            return readIndex === 1 ?
              {exists: markerExists} :
              {exists: true, data: () => ({})};
          }),
          update: transactionUpdate,
          create: transactionCreate,
        });
      });
      return {transactionUpdate, transactionCreate};
    };

    it("incrementa players_count quando status muda para CONFIRMED", async () => {
      const {transactionUpdate} = installIdempotentTransaction();
      await onConfirmationWrite(makeEvent(
        { status: "PENDING", game_id: "game1" },
        { status: "CONFIRMED", game_id: "game1" },
      ));

      expect(transactionUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          players_count: { operand: 1 },
        }),
      );
    });

    it("decrementa players_count quando status sai de CONFIRMED", async () => {
      const {transactionUpdate} = installIdempotentTransaction();
      await onConfirmationWrite(makeEvent(
        { status: "CONFIRMED", game_id: "game1" },
        { status: "CANCELLED", game_id: "game1" },
      ));

      expect(transactionUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          players_count: { operand: -1 },
        }),
      );
    });

    it("ignora delivery duplicada do mesmo cancelamento", async () => {
      const {transactionUpdate, transactionCreate} = installIdempotentTransaction();
      const event = makeEvent(
        {status: "CONFIRMED", game_id: "game1"},
        {status: "CANCELLED", game_id: "game1"},
        "cancel/event-1",
      );

      await onConfirmationWrite(event);
      await onConfirmationWrite(event);

      expect(transactionUpdate).toHaveBeenCalledTimes(1);
      expect(transactionCreate).toHaveBeenCalledTimes(1);
      expect(mockSubCol).toHaveBeenCalledWith(
        "confirmation_counter_events",
      );
      expect(mockSubColDoc).toHaveBeenCalledWith("cancel%2Fevent-1");
      expect(transactionCreate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          event_id: "cancel/event-1",
          confirmation_id: "g1_u1",
          players_delta: -1,
          goalkeepers_delta: 0,
          expires_at: expect.any(Date),
        }),
      );
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });

    it("ignora delivery duplicada de delete confirmado", async () => {
      const {transactionUpdate, transactionCreate} = installIdempotentTransaction();
      const event = makeEvent(
        {status: "CONFIRMED", position: "GOALKEEPER", game_id: "game1"},
        undefined,
        "delete-event-1",
      );

      await onConfirmationWrite(event);
      await onConfirmationWrite(event);

      expect(transactionUpdate).toHaveBeenCalledTimes(1);
      expect(transactionUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          players_count: {operand: -1},
          goalkeepers_count: {operand: -1},
        }),
      );
      expect(transactionCreate).toHaveBeenCalledTimes(1);
    });

    it("ignora delivery duplicada de troca de posicao", async () => {
      const {transactionUpdate, transactionCreate} = installIdempotentTransaction();
      const event = makeEvent(
        {status: "CONFIRMED", position: "FIELD", game_id: "game1"},
        {status: "CONFIRMED", position: "GOALKEEPER", game_id: "game1"},
        "position-event-1",
      );

      await onConfirmationWrite(event);
      await onConfirmationWrite(event);

      expect(transactionUpdate).toHaveBeenCalledTimes(1);
      expect(transactionUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          players_count: {operand: 0},
          goalkeepers_count: {operand: 1},
        }),
      );
      expect(transactionCreate).toHaveBeenCalledTimes(1);
    });

    it("reprocessa com sucesso depois de falha transacional", async () => {
      const transactionFailure = new Error("temporary transaction failure");
      mockRunTransaction.mockRejectedValueOnce(transactionFailure);
      const transactionUpdate = jest.fn();
      const transactionCreate = jest.fn();
      mockRunTransaction.mockImplementationOnce(async (callback: any) => {
        let readIndex = 0;
        return callback({
          get: jest.fn(async () => {
            readIndex += 1;
            return readIndex === 1 ? {exists: false} : {exists: true};
          }),
          update: transactionUpdate,
          create: transactionCreate,
        });
      });
      const event = makeEvent(
        {status: "CONFIRMED", game_id: "game1"},
        {status: "CANCELLED", game_id: "game1"},
        "retry-event-1",
      );

      await expect(onConfirmationWrite(event)).rejects.toThrow(
        "temporary transaction failure",
      );
      await onConfirmationWrite(event);

      expect(transactionUpdate).toHaveBeenCalledTimes(1);
      expect(transactionCreate).toHaveBeenCalledTimes(1);
    });

    it("falha evento relevante sem CloudEvent id", async () => {
      await expect(onConfirmationWrite(makeEvent(
        {status: "CONFIRMED", game_id: "game1"},
        {status: "CANCELLED", game_id: "game1"},
        null,
      ))).rejects.toThrow("missing CloudEvent id");
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("preserva skip do token do callable canonico", async () => {
      await onConfirmationWrite(makeEvent(
        {status: "PENDING", game_id: "game1"},
        {
          status: "CONFIRMED",
          game_id: "game1",
          capacity_sync_token: "canonical-token",
        },
        null,
      ));
      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("nao faz nada quando status nao mudou", async () => {
      await onConfirmationWrite(makeEvent(
        { status: "CONFIRMED", game_id: "game1" },
        { status: "CONFIRMED", game_id: "game1" },
      ));

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("nao faz nada quando game_id ausente", async () => {
      await onConfirmationWrite(makeEvent(
        { status: "PENDING" },
        { status: "CONFIRMED" },
      ));

      expect(mockRunTransaction).not.toHaveBeenCalled();
    });

    it("trata CREATE sem before (before undefined)", async () => {
      const {transactionUpdate} = installIdempotentTransaction();
      await onConfirmationWrite({
        id: "create-event-1",
        data: {
          before: { data: () => undefined },
          after: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
        },
        params: { confirmationId: "g1_u2" },
      });

      expect(transactionUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          players_count: { operand: 1 },
        }),
      );
    });
  });
});
