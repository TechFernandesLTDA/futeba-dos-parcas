/**
 * TESTES DO MÓDULO SOFT-DELETE
 *
 * Testa as funções do utilitário soft-delete-helper.ts:
 * - softDelete: marca documento com deleted_at
 * - restoreSoftDeleted: remove campos de deleção
 * - isSoftDeleted: verifica se documento está deletado
 * - cleanupSoftDeleted: remove documentos expirados em batch
 * - softDeleteGroupCascade: soft-delete em cascata de grupo
 */

jest.mock("../src/middleware/rate-limiter");

// ==========================================
// MOCKS DO FIREBASE ADMIN
// ==========================================

const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocDelete = jest.fn().mockResolvedValue(undefined);
const mockBatchUpdate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockQueryGet = jest.fn();

const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

// Referência ao doc mock para capturar o doc id
const mockDocRef = jest.fn().mockImplementation((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  delete: mockDocDelete,
  collection: jest.fn().mockReturnValue({
    doc: jest.fn().mockReturnValue({
      get: mockDocGet,
    }),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    get: mockQueryGet,
  }),
}));

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    delete: jest.fn(() => ({ _type: "FieldValueDelete" })),
    increment: jest.fn((n: number) => ({ _type: "Increment", operand: n })),
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
        doc: mockDocRef,
        where: mockWhere,
        orderBy: mockOrderBy,
        limit: mockLimit,
        get: mockQueryGet,
      }),
      batch: jest.fn(() => ({
        update: mockBatchUpdate,
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
      runTransaction: jest.fn(),
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = mockTimestamp;

  return mockAdmin;
});

import {
  softDelete,
  restoreSoftDeleted,
  isSoftDeleted,
  cleanupSoftDeleted,
  softDeleteGroupCascade,
} from "../src/utils/soft-delete-helper";

// ==========================================
// softDelete
// ==========================================

describe("softDelete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
    mockDocUpdate.mockResolvedValue(undefined);
  });

  test("deve marcar documento com deleted_at e deleted_by", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "SCHEDULED", owner_id: "user1" }),
    });

    const result = await softDelete("games", "game1", "user1");

    expect(result.success).toBe(true);
    expect(result.docId).toBe("game1");
    expect(result.collection).toBe("games");
    expect(result.deletedBy).toBe("user1");
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_by: "user1",
        status: "DELETED",
      })
    );
  });

  test("deve incluir motivo quando fornecido", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "SCHEDULED" }),
    });

    await softDelete("games", "game1", "user1", {
      reason: "Cancelado pelo organizador",
    });

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_reason: "Cancelado pelo organizador",
      })
    );
  });

  test("deve retornar success=false quando documento não existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const result = await softDelete("games", "game-inexistente", "user1");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  test("deve ser idempotente: retornar success=true quando já deletado", async () => {
    const deletedAt = { toDate: () => new Date(), _type: "Timestamp" };
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        deleted_at: deletedAt,
        deleted_by: "user1",
        status: "DELETED",
      }),
    });

    const result = await softDelete("games", "game1", "user1");

    expect(result.success).toBe(true);
    // Não deve atualizar novamente
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  test("deve não alterar status quando setStatusDeleted=false", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "SCHEDULED" }),
    });

    await softDelete("games", "game1", "user1", {
      setStatusDeleted: false,
    });

    const updateCall = mockDocUpdate.mock.calls[0][0];
    expect(updateCall.status).toBeUndefined();
  });

  test("deve retornar success=false em erros do Firestore", async () => {
    mockDocGet.mockRejectedValue(new Error("Firestore error"));

    const result = await softDelete("games", "game1", "user1");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ==========================================
// restoreSoftDeleted
// ==========================================

describe("restoreSoftDeleted", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocUpdate.mockResolvedValue(undefined);
  });

  test("deve remover campos deleted_at e deleted_by", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        deleted_at: { toDate: () => new Date() },
        deleted_by: "user1",
        status: "DELETED",
      }),
    });

    const result = await restoreSoftDeleted("games", "game1", "user1");

    expect(result.success).toBe(true);
    expect(result.docId).toBe("game1");
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        restored_by: "user1",
      })
    );
  });

  test("deve restaurar status quando restoreStatus especificado", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        deleted_at: { toDate: () => new Date() },
        deleted_by: "user1",
        status: "DELETED",
      }),
    });

    await restoreSoftDeleted("games", "game1", "user1", {
      restoreStatus: "SCHEDULED",
    });

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "SCHEDULED",
      })
    );
  });

  test("deve retornar success=false quando documento não existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const result = await restoreSoftDeleted("games", "game-inexistente", "user1");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  test("deve retornar success=false quando documento não está deletado", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "SCHEDULED",
        // sem deleted_at
      }),
    });

    const result = await restoreSoftDeleted("games", "game1", "user1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("não está soft-deleted");
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  test("deve retornar success=false em erros do Firestore", async () => {
    mockDocGet.mockRejectedValue(new Error("Firestore error"));

    const result = await restoreSoftDeleted("games", "game1", "user1");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ==========================================
// isSoftDeleted
// ==========================================

describe("isSoftDeleted", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve retornar true quando documento tem deleted_at", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        deleted_at: { toDate: () => new Date() },
        status: "DELETED",
      }),
    });

    const result = await isSoftDeleted("games", "game1");

    expect(result).toBe(true);
  });

  test("deve retornar false quando documento não tem deleted_at", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ status: "SCHEDULED" }),
    });

    const result = await isSoftDeleted("games", "game1");

    expect(result).toBe(false);
  });

  test("deve retornar false quando documento não existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const result = await isSoftDeleted("games", "game-inexistente");

    expect(result).toBe(false);
  });

  test("deve retornar false em erros do Firestore", async () => {
    mockDocGet.mockRejectedValue(new Error("Firestore error"));

    const result = await isSoftDeleted("games", "game1");

    expect(result).toBe(false);
  });
});

// ==========================================
// cleanupSoftDeleted
// ==========================================

describe("cleanupSoftDeleted", () => {
  beforeEach(() => {
    // Usar mockReset apenas nos mocks de dados, não nos de encadeamento
    mockDocGet.mockReset();
    mockDocUpdate.mockResolvedValue(undefined);
    mockBatchUpdate.mockReset();
    mockBatchDelete.mockReset();
    mockBatchCommit.mockResolvedValue(undefined);
    mockQueryGet.mockReset();
    // Garantir que encadeamento retorna this
    mockWhere.mockReturnThis();
    mockOrderBy.mockReturnThis();
    mockLimit.mockReturnThis();
  });

  test("deve retornar 0 documentos deletados quando não há expirados", async () => {
    mockQueryGet.mockResolvedValue({
      empty: true,
      docs: [],
      size: 0,
    });

    const result = await cleanupSoftDeleted("games", 30);

    expect(result.totalDeleted).toBe(0);
    expect(result.batchCount).toBe(0);
    expect(result.collection).toBe("games");
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });

  test("deve deletar documentos expirados permanentemente", async () => {
    const mockDocs = [
      { ref: { id: "game1" } },
      { ref: { id: "game2" } },
      { ref: { id: "game3" } },
    ];

    // Retorna docs na primeira chamada, vazio na segunda (fim da paginação)
    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: mockDocs,
        size: 3,
      })
      .mockResolvedValueOnce({
        empty: true,
        docs: [],
        size: 0,
      });

    const result = await cleanupSoftDeleted("games", 30, 10, 100);

    expect(result.totalDeleted).toBe(3);
    expect(result.batchCount).toBe(1);
    expect(mockBatchDelete).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  test("deve respeitar maxBatches como limite de iterações", async () => {
    // Retorna sempre batch cheio para forçar múltiplos loops
    const mockDocs = Array.from({ length: 5 }, (_, i) => ({
      ref: { id: `doc${i}` },
    }));
    // Sempre retorna docs cheios (size === batchSize), código continua em loop
    // até atingir maxBatches
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: mockDocs,
      size: 5,
    });

    // maxBatches=2, batchSize=5: cada batch retorna 5 docs (= batchSize)
    // portanto continua, mas para após maxBatches=2 iterações
    const result = await cleanupSoftDeleted("games", 30, 2, 5);

    expect(result.batchCount).toBe(2);
    expect(result.totalDeleted).toBe(10); // 5 * 2 batches
  });

  test("deve retornar resultado com cutoffDate correto", async () => {
    mockQueryGet.mockResolvedValue({
      empty: true,
      docs: [],
      size: 0,
    });

    const retentionDays = 30;
    const before = new Date();
    const result = await cleanupSoftDeleted("games", retentionDays);
    const after = new Date();

    // cutoffDate deve ser aproximadamente retentionDays atrás
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - retentionDays);

    expect(result.cutoffDate.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - retentionDays * 24 * 60 * 60 * 1000 - 1000
    );
    expect(result.cutoffDate.getTime()).toBeLessThanOrEqual(
      after.getTime() - retentionDays * 24 * 60 * 60 * 1000 + 1000
    );
  });

  test("deve lidar com erros do Firestore graciosamente", async () => {
    mockQueryGet.mockRejectedValue(new Error("Firestore error"));

    const result = await cleanupSoftDeleted("games", 30);

    // Deve retornar sem lançar exceção
    expect(result.totalDeleted).toBe(0);
    expect(result.collection).toBe("games");
  });
});

// ==========================================
// softDeleteGroupCascade
// ==========================================

describe("softDeleteGroupCascade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchUpdate.mockReturnValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
  });

  test("deve soft-delete grupo e seus jogos em cascata", async () => {
    // Mock do grupo
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Pelada dos Parcas" }), // sem deleted_at
    });

    // Mock dos jogos do grupo
    const mockGameDocs = [
      {
        ref: { id: "game1", update: jest.fn() },
        data: () => ({ status: "SCHEDULED", group_id: "group1" }),
      },
      {
        ref: { id: "game2", update: jest.fn() },
        data: () => ({ status: "CONFIRMED", group_id: "group1" }),
      },
    ];
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: mockGameDocs,
      size: 2,
    });

    const result = await softDeleteGroupCascade("group1", "user1", "Encerramento do grupo");

    expect(result.groupDeleted).toBe(true);
    expect(result.gamesDeleted).toBe(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  test("deve retornar erro quando grupo não existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const result = await softDeleteGroupCascade("group-inexistente", "user1");

    expect(result.groupDeleted).toBe(false);
    expect(result.gamesDeleted).toBe(0);
    expect(result.error).toBeDefined();
  });

  test("deve ser idempotente: retornar erro quando grupo já deletado", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        deleted_at: { toDate: () => new Date() },
        deleted_by: "user1",
      }),
    });

    const result = await softDeleteGroupCascade("group1", "user1");

    expect(result.groupDeleted).toBe(false);
    expect(result.error).toBe("Grupo já deletado");
  });

  test("deve pular jogos que já estão deletados na cascata", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ name: "Grupo" }), // grupo ativo
    });

    const mockGameDocs = [
      {
        ref: { id: "game1", update: jest.fn() },
        data: () => ({ status: "SCHEDULED", group_id: "group1" }),
      },
      {
        ref: { id: "game2", update: jest.fn() },
        // game2 já está deletado — deve ser pulado
        data: () => ({
          status: "DELETED",
          group_id: "group1",
          deleted_at: { toDate: () => new Date() },
        }),
      },
    ];
    mockQueryGet.mockResolvedValue({
      empty: false,
      docs: mockGameDocs,
      size: 2,
    });

    const result = await softDeleteGroupCascade("group1", "user1");

    // Apenas 1 jogo ativo deve ser deletado
    expect(result.groupDeleted).toBe(true);
    expect(result.gamesDeleted).toBe(1);
  });

  test("deve retornar erro em caso de exceção do Firestore", async () => {
    mockDocGet.mockRejectedValue(new Error("Firestore connection error"));

    const result = await softDeleteGroupCascade("group1", "user1");

    expect(result.groupDeleted).toBe(false);
    expect(result.error).toBeDefined();
  });
});
