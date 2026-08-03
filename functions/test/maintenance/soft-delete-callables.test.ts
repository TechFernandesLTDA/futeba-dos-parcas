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

// Issue #3974: mock apenas startSchedulerHeartbeat (mantendo
// acquire/release reais via jest.requireActual), para controlar
// isLost() e testar o abort gracioso quando o lock é perdido.
const mockHeartbeatStop = jest.fn();
const mockHeartbeatIsLost = jest.fn().mockReturnValue(false);
const mockHeartbeatHandle = {
  stop: mockHeartbeatStop,
  isLost: mockHeartbeatIsLost,
};
const mockStartSchedulerHeartbeat = jest.fn(() => mockHeartbeatHandle);

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

// Issue #3974: partial mock — acquireSchedulerLock e releaseSchedulerLock
// continuam reais (exercitam mockRunTransaction como antes), só
// startSchedulerHeartbeat é substituído para controlar isLost() nos
// testes de abort.
jest.mock("../../src/utils/scheduler-lock", () => {
  const actual = jest.requireActual("../../src/utils/scheduler-lock");
  return {
    ...actual,
    startSchedulerHeartbeat: mockStartSchedulerHeartbeat,
  };
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
    // Issue #3974: isLost() default false — abort só é exercitado no
    // teste específico de lock perdido.
    mockHeartbeatIsLost.mockReturnValue(false);
    mockStartSchedulerHeartbeat.mockReturnValue(mockHeartbeatHandle);
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
    mockCleanupSoftDeleted.mockReset().mockResolvedValue({ totalDeleted: 5, batchCount: 1, collection: "games", maxBatches: 10, truncated: false });
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
        .mockResolvedValueOnce({ totalDeleted: 5, batchCount: 1, collection: "games", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 3, batchCount: 1, collection: "groups", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 10, batchCount: 2, collection: "locations", maxBatches: 20, truncated: false });

      await cleanupAllSoftDeleted();

      expect(mockCleanupSoftDeleted).toHaveBeenCalledTimes(3);
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({ type: "soft_delete_cleanup_unified" }),
      );
    });

    it("registra metricas apos cleanup", async () => {
      mockCleanupSoftDeleted
        .mockResolvedValueOnce({ totalDeleted: 0, batchCount: 0, collection: "games", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 0, batchCount: 0, collection: "groups", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 0, batchCount: 0, collection: "locations", maxBatches: 20, truncated: false });

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

    // ===== Issue #3969: observabilidade de saturação (LGPD) =====

    it("#3969: grava truncated=false na metrica quando NAO ha saturacao", async () => {
      mockCleanupSoftDeleted
        .mockResolvedValueOnce({ totalDeleted: 5, batchCount: 1, collection: "games", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 3, batchCount: 1, collection: "groups", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 10, batchCount: 2, collection: "locations", maxBatches: 20, truncated: false });

      await cleanupAllSoftDeleted();

      // Métrica deve conter o sinal de saturação por coleção
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "soft_delete_cleanup_unified",
          truncated: false,
          truncated_collections: [],
          results: expect.arrayContaining([
            expect.objectContaining({
              collection: "games",
              truncated: false,
              max_batches: 10,
            }),
          ]),
        }),
      );

      // NÃO deve gravar alerta de saturação
      expect(mockCollectionAdd).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: "SOFT_DELETE_CLEANUP_TRUNCATED" }),
      );
    });

    it("#3969: grava truncated=true, emite logger.warn e cria alerta quando colecao satura", async () => {
      // Força games a saturar (maxBatches atingido com backlog) — cenário LGPD.
      mockCleanupSoftDeleted
        .mockResolvedValueOnce({ totalDeleted: 1000, batchCount: 10, collection: "games", maxBatches: 10, truncated: true })
        .mockResolvedValueOnce({ totalDeleted: 3, batchCount: 1, collection: "groups", maxBatches: 10, truncated: false })
        .mockResolvedValueOnce({ totalDeleted: 10, batchCount: 2, collection: "locations", maxBatches: 20, truncated: false });

      await cleanupAllSoftDeleted();

      // Métrica marca saturação ao nível do documento
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "soft_delete_cleanup_unified",
          truncated: true,
          truncated_collections: ["games"],
          results: expect.arrayContaining([
            expect.objectContaining({
              collection: "games",
              truncated: true,
              max_batches: 10,
            }),
          ]),
        }),
      );

      // Alerta persistente gerado (issue #3969 aceite: "Alerta dispara ao forçar maxBatches")
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SOFT_DELETE_CLEANUP_TRUNCATED",
          severity: "WARNING",
          acknowledged: false,
          metadata: expect.objectContaining({
            collections: ["games"],
            retention_days: 30,
          }),
        }),
      );
    });

    it("#3969: reporta multiplas colecoes saturadas simultaneamente", async () => {
      mockCleanupSoftDeleted
        .mockResolvedValueOnce({ totalDeleted: 1000, batchCount: 10, collection: "games", maxBatches: 10, truncated: true })
        .mockResolvedValueOnce({ totalDeleted: 1000, batchCount: 10, collection: "groups", maxBatches: 10, truncated: true })
        .mockResolvedValueOnce({ totalDeleted: 10, batchCount: 2, collection: "locations", maxBatches: 20, truncated: false });

      await cleanupAllSoftDeleted();

      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "soft_delete_cleanup_unified",
          truncated: true,
          truncated_collections: ["games", "groups"],
        }),
      );
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "SOFT_DELETE_CLEANUP_TRUNCATED",
          metadata: expect.objectContaining({
            collections: ["games", "groups"],
          }),
        }),
      );
    });

    // ===== Issue #3974: abort gracioso quando o lock é perdido =====

    it("#3974: aborta o cleanup quando heartbeat reporta lock perdido", async () => {
      // Defeito A: antes o retorno boolean do heartbeat era descartado.
      // Agora o caller checa isLost() no loop de coleções e aborta para
      // evitar writes conflitantes com o novo owner.
      mockHeartbeatIsLost.mockReturnValue(true);

      await cleanupAllSoftDeleted();

      // Nenhuma coleção foi processada — abortou no primeiro cheque do loop.
      expect(mockCleanupSoftDeleted).not.toHaveBeenCalled();
      // Nenhuma métrica/alerta gravado.
      expect(mockCollectionAdd).not.toHaveBeenCalled();
      // Lock perdido é CRITICAL — logado em error.
      const { logger } = require("firebase-functions/v2");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Scheduler lock perdido durante execucao")
      );
      // Heartbeat foi interrompido no finally.
      expect(mockHeartbeatStop).toHaveBeenCalled();
    });

    it("#3974: NAO chama releaseSchedulerLock quando o lock foi perdido", async () => {
      // Quando o lock foi tomado por outro owner, release seria rejeitado
      // (owner divergente) e só geraria ruído — o novo owner cuida da
      // liberação. Verifica-se que o finally pula o release.
      mockHeartbeatIsLost.mockReturnValue(true);
      const releaseSpy = jest.spyOn(
        require("../../src/utils/scheduler-lock"),
        "releaseSchedulerLock"
      );

      try {
        await cleanupAllSoftDeleted();

        expect(releaseSpy).not.toHaveBeenCalled();
        const { logger } = require("firebase-functions/v2");
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining("Pulando release do lock"),
        );
      } finally {
        releaseSpy.mockRestore();
      }
    });
  });
});
