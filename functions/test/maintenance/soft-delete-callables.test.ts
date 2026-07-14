const mockSoftDeleteGameCascade = jest.fn();
const mockRestoreSoftDeleted = jest.fn();
const mockSoftDeleteGroupCascade = jest.fn();
const mockCleanupSoftDeleted = jest.fn();
const mockCheckRateLimit = jest.fn().mockResolvedValue({ allowed: true, remaining: 10, resetAt: new Date(Date.now() + 60000) });
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocSet = jest.fn();
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockCollectionGet = jest.fn();
const mockCollectionAdd = jest.fn().mockResolvedValue({ id: "metric1" });
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

const queryChain: any = { where: mockWhere, orderBy: mockOrderBy, limit: mockLimit, get: mockCollectionGet };
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  set: mockDocSet,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({ id: sid, get: mockDocGet, update: mockDocUpdate })),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    get: mockCollectionGet,
  })),
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockCollectionGet,
  add: mockCollectionAdd,
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const mockTimestamp = {
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
};
const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
  batch: jest.fn(() => ({ update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue([]) })),
  runTransaction: mockRunTransaction,
}));
(mockFirestore as any).FieldValue = mockFieldValue;
(mockFirestore as any).Timestamp = mockTimestamp;
(mockFirestore as any).FieldPath = { documentId: jest.fn(() => "__name__") };

jest.mock("firebase-admin", () => {
  const fbMock: any = {
    apps: [{ name: "test" }],
    initializeApp: jest.fn(),
    firestore: mockFirestore,
  };
  return fbMock;
});

const mockHttpsError = class extends Error {
  code: string;
  constructor(code: string, msg: string) {
    super(code);
    this.name = "HttpsError";
    this.code = code;
  }
};

jest.mock("firebase-functions/v2", () => ({
  setGlobalOptions: jest.fn(),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  scheduler: { onSchedule: jest.fn((_c: any, h: any) => h) },
  https: {
    onCall: jest.fn((_c: any, h: any) => h || _c),
    HttpsError: mockHttpsError,
  },
}));

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

jest.mock("../../src/utils/soft-delete-helper", () => ({
  softDeleteGameCascade: mockSoftDeleteGameCascade,
  restoreSoftDeleted: mockRestoreSoftDeleted,
  softDeleteGroupCascade: mockSoftDeleteGroupCascade,
  cleanupSoftDeleted: mockCleanupSoftDeleted,
}));

jest.mock("../../src/_db", () => {
  const dbFn = jest.fn(() => ({
    collection: mockCollection,
    batch: jest.fn(() => ({ update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue([]) })),
    runTransaction: mockRunTransaction,
  }));
  return { db: dbFn };
});

import { softDeleteGame, softDeleteGroup, restoreDeletedGame, restoreDeletedGroup, cleanupAllSoftDeleted } from "../../src/maintenance/soft-delete";

const makeAuthRequest = (overrides: any = {}) => ({
  auth: { uid: "user1", token: { role: "MEMBER" }, ...overrides.auth },
  data: { gameId: "game1", groupId: "group1", reason: "Test", ...overrides.data },
  rawRequest: { ip: "127.0.0.1" },
});

describe("Soft Delete — Callables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunTransaction.mockImplementation(async (callback: any) =>
      callback({
        get: mockTransactionGet,
        set: mockTransactionSet,
      })
    );
    mockTransactionGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });
    mockDocUpdate.mockResolvedValue(undefined);
    mockDocSet.mockResolvedValue(undefined);
    mockSoftDeleteGameCascade.mockReset().mockResolvedValue({
      success: true,
      deletedAt: new Date(),
      docId: "game1",
      dependentsDeleted: 5,
    });
    mockRestoreSoftDeleted.mockReset().mockResolvedValue({ success: true, docId: "game1" });
    mockSoftDeleteGroupCascade.mockReset().mockResolvedValue({ groupDeleted: true, gamesDeleted: 3 });
    mockCleanupSoftDeleted.mockReset().mockResolvedValue({ totalDeleted: 5, batchCount: 1, collection: "games" });
  });

  describe("softDeleteGame", () => {
    it("marca jogo como soft-deleted com sucesso", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1", status: "SCHEDULED" }),
      });

      const result = await softDeleteGame(makeAuthRequest());

      expect(result.success).toBe(true);
      expect(result.gameId).toBe("game1");
      expect(mockSoftDeleteGameCascade).toHaveBeenCalledWith(
        "game1", "user1", "Test"
      );
    });

    it("rejeita sem autenticacao", async () => {
      await expect(
        softDeleteGame(makeAuthRequest({ auth: { uid: undefined, token: {} } })),
      ).rejects.toThrow("unauthenticated");
    });

    it("rejeita gameId ausente", async () => {
      await expect(
        softDeleteGame({ auth: { uid: "user1", token: { role: "MEMBER" } }, data: { groupId: "group1" }, rawRequest: { ip: "127.0.0.1" } }),
      ).rejects.toThrow("invalid-argument");
    });

    it("rejeita quando jogo nao encontrado", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

      await expect(
        softDeleteGame(makeAuthRequest()),
      ).rejects.toThrow("not-found");
    });

    it("rejeita quando usuario nao e dono nem admin", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "outro_usuario", status: "SCHEDULED" }),
      });

      await expect(
        softDeleteGame(makeAuthRequest()),
      ).rejects.toThrow("permission-denied");
    });

    it("rejeita deletar jogo LIVE", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1", status: "LIVE" }),
      });

      await expect(
        softDeleteGame(makeAuthRequest()),
      ).rejects.toThrow("failed-precondition");
    });

    it("admin pode deletar qualquer jogo", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "outro", status: "SCHEDULED" }),
      });

      await softDeleteGame(makeAuthRequest({ auth: { uid: "admin1", token: { role: "ADMIN" } } }));

      expect(mockSoftDeleteGameCascade).toHaveBeenCalled();
    });

    it("e idempotente quando jogo ja deletado", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1", status: "DELETED", deleted_at: { toDate: () => new Date() } }),
      });

      const result = await softDeleteGame(makeAuthRequest());

      expect(result.alreadyDeleted).toBe(true);
      expect(mockSoftDeleteGameCascade).not.toHaveBeenCalled();
    });

    it("escreve audit log apos soft-delete de jogo", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1", status: "SCHEDULED" }),
      });

      await softDeleteGame(makeAuthRequest({ data: { gameId: "game1", reason: "Motivo teste" } }));

      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SOFT_DELETE_GAME",
          target_id: "game1",
          performed_by: "user1",
          reason: "Motivo teste",
          previous_status: "SCHEDULED",
        }),
      );
    });

    it("audit log tem reason null quando nao fornecido", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1", status: "SCHEDULED" }),
      });

      await softDeleteGame(makeAuthRequest({ data: { gameId: "game1", reason: null } }));

      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SOFT_DELETE_GAME",
          target_id: "game1",
          reason: null,
        }),
      );
    });
  });

  describe("softDeleteGroup", () => {
    it("marca grupo e jogos como soft-deleted", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ role: "OWNER" }) });

      const result = await softDeleteGroup(makeAuthRequest());

      expect(result.success).toBe(true);
      expect(result.gamesAffected).toBe(3);
      expect(mockSoftDeleteGroupCascade).toHaveBeenCalledWith("group1", "user1", "Test");
    });

    it("rejeita quando usuario nao e owner nem admin", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ role: "MEMBER" }) });

      await expect(
        softDeleteGroup(makeAuthRequest()),
      ).rejects.toThrow("permission-denied");
    });

    it("escreve audit log apos soft-delete de grupo", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ role: "OWNER" }) });

      await softDeleteGroup(makeAuthRequest({ data: { groupId: "group1", reason: "Motivo grupo" } }));

      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SOFT_DELETE_GROUP",
          target_id: "group1",
          performed_by: "user1",
          reason: "Motivo grupo",
          games_affected: 3,
        }),
      );
    });
  });

  describe("restoreDeletedGame", () => {
    it("restaura jogo soft-deleted com sucesso", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ deleted_at: { toDate: () => new Date() }, deleted_by: "user1", owner_id: "user1" }),
      });

      const result = await restoreDeletedGame(makeAuthRequest());

      expect(result.success).toBe(true);
      expect(mockRestoreSoftDeleted).toHaveBeenCalledWith("games", "game1", "user1", expect.any(Object));
    });

    it("rejeita quando jogo nao esta deletado", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1" }),
      });

      await expect(
        restoreDeletedGame(makeAuthRequest()),
      ).rejects.toThrow("failed-precondition");
    });
  });

  describe("restoreDeletedGroup", () => {
    it("restaura grupo soft-deleted com sucesso", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ deleted_at: { toDate: () => new Date() }, deleted_by: "user1", owner_id: "user1" }),
      });

      const result = await restoreDeletedGroup(makeAuthRequest());

      expect(result.success).toBe(true);
      expect(mockRestoreSoftDeleted).toHaveBeenCalledWith(
        "groups",
        "group1",
        "user1",
        { restoreStatus: "ACTIVE" },
      );
    });

    it("rejeita quando grupo nao esta deletado", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "user1", status: "ACTIVE" }),
      });

      await expect(
        restoreDeletedGroup(makeAuthRequest()),
      ).rejects.toThrow("failed-precondition");

      expect(mockRestoreSoftDeleted).not.toHaveBeenCalled();
    });

    it("rejeita usuario sem permissao para restaurar grupo", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          deleted_at: { toDate: () => new Date() },
          deleted_by: "outro",
          owner_id: "outro",
          status: "DELETED",
        }),
      });

      await expect(
        restoreDeletedGroup(makeAuthRequest()),
      ).rejects.toThrow("permission-denied");

      expect(mockRestoreSoftDeleted).not.toHaveBeenCalled();
    });

    it("admin pode restaurar grupo de outro usuario", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ deleted_at: { toDate: () => new Date() }, deleted_by: "outro", owner_id: "outro" }),
      });

      const result = await restoreDeletedGroup(makeAuthRequest({ auth: { uid: "admin1", token: { role: "ADMIN" } } }));

      expect(result.success).toBe(true);
      expect(mockRestoreSoftDeleted).toHaveBeenCalled();
    });
  });

  describe("cleanupAllSoftDeleted", () => {
    it("limpa documentos soft-deleted expirados em todas as colecoes", async () => {
      mockCleanupSoftDeleted
        .mockResolvedValueOnce({ totalDeleted: 5, batchCount: 1, collection: "games" })
        .mockResolvedValueOnce({ totalDeleted: 3, batchCount: 1, collection: "groups" })
        .mockResolvedValueOnce({ totalDeleted: 10, batchCount: 2, collection: "locations" });

      await cleanupAllSoftDeleted();

      expect(mockCleanupSoftDeleted).toHaveBeenCalledTimes(3);
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({ type: "soft_delete_cleanup_unified" }),
      );
    });

    it("registra metricas apos cleanup", async () => {
      mockCleanupSoftDeleted
        .mockResolvedValueOnce({ totalDeleted: 0, batchCount: 0, collection: "games" })
        .mockResolvedValueOnce({ totalDeleted: 0, batchCount: 0, collection: "groups" })
        .mockResolvedValueOnce({ totalDeleted: 0, batchCount: 0, collection: "locations" });

      await cleanupAllSoftDeleted();

      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "soft_delete_cleanup_unified",
          total_deleted: 0,
        }),
      );
    });

    it("pula cleanup quando scheduler lock ja esta em andamento", async () => {
      mockRunTransaction.mockResolvedValueOnce(false);

      await cleanupAllSoftDeleted();

      expect(mockCleanupSoftDeleted).not.toHaveBeenCalled();
    });
  });
});
