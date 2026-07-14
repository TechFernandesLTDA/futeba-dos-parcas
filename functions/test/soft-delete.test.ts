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
const mockRecursiveDelete = jest.fn().mockResolvedValue(undefined);

const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockStartAfter = jest.fn().mockReturnThis();

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
    startAfter: mockStartAfter,
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
      doc: mockDocRef,
      collection: jest.fn().mockReturnValue({
        doc: mockDocRef,
        where: mockWhere,
        orderBy: mockOrderBy,
        limit: mockLimit,
        startAfter: mockStartAfter,
        get: mockQueryGet,
      }),
      batch: jest.fn(() => ({
        update: mockBatchUpdate,
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
      recursiveDelete: mockRecursiveDelete,
      runTransaction: jest.fn(),
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = mockTimestamp;
  mockAdmin.firestore.FieldPath = {
    documentId: jest.fn(() => ({ _type: "FieldPathDocumentId" })),
  };

  return mockAdmin;
});

import {
  softDelete,
  restoreSoftDeleted,
  isSoftDeleted,
  cleanupSoftDeleted,
  softDeleteGameCascade,
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

  test("deve restaurar grupo deletado para status ACTIVE", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        deleted_at: { toDate: () => new Date() },
        deleted_by: "user1",
        status: "DELETED",
      }),
    });

    const result = await restoreSoftDeleted(
      "groups",
      "group1",
      "user1",
      { restoreStatus: "ACTIVE" }
    );

    expect(result.success).toBe(true);
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ACTIVE",
        restored_by: "user1",
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

  // FIX #2529: teto de concorrência de recursiveDelete
  test("deve limitar concorrência de recursiveDelete a no máximo 10 por chunk (fix #2529)", async () => {
    // Simula 25 docs — mais que o teto de 10 — para forçar múltiplos chunks.
    const DOC_COUNT = 25;
    const mockDocs = Array.from({ length: DOC_COUNT }, (_, i) => ({
      ref: { id: `loc${i}` },
    }));

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: mockDocs,
        size: DOC_COUNT,
      })
      .mockResolvedValueOnce({ empty: true, docs: [], size: 0 });

    // Rastreia quantos recursiveDelete estão em voo ao mesmo tempo.
    let inFlight = 0;
    let maxInFlight = 0;
    mockRecursiveDelete.mockReset();
    mockRecursiveDelete.mockImplementation(() => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<void>((resolve) =>
        setImmediate(() => {
          inFlight--;
          resolve();
        })
      );
    });

    const result = await cleanupSoftDeleted(
      "locations",
      30,
      10,
      DOC_COUNT, // batchSize == DOC_COUNT → força 2ª iteração (consome o mockOnce vazio)
      true // recursive=true → aciona o caminho de recursiveDelete
    );

    // Todos os docs devem ter sido processados
    expect(result.totalDeleted).toBe(DOC_COUNT);
    expect(mockRecursiveDelete).toHaveBeenCalledTimes(DOC_COUNT);

    // Nunca devem ter mais de RECURSIVE_DELETE_CONCURRENCY=10 em voo
    expect(maxInFlight).toBeLessThanOrEqual(10);
  });
});

// ==========================================
// softDeleteGameCascade
// ==========================================

describe("softDeleteGameCascade", () => {
  const emptyQuerySnapshot = {empty: true, docs: [], size: 0};

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocGet.mockReset();
    mockQueryGet.mockReset();
    mockBatchUpdate.mockReset();
    mockBatchCommit.mockReset().mockResolvedValue(undefined);
    mockDocUpdate.mockReset().mockResolvedValue(undefined);
  });

  test("soft-deleta confirmações, caronas, chat, comentários e waitlist", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({status: "SCHEDULED"}),
    });
    const makeDoc = (id: string) => ({
      id,
      ref: {id},
      data: () => ({deleted_at: null}),
    });
    mockQueryGet
      .mockResolvedValueOnce({empty: false, docs: [makeDoc("confirmation-1")], size: 1})
      .mockResolvedValueOnce({empty: false, docs: [makeDoc("ride-1")], size: 1})
      .mockResolvedValueOnce({empty: false, docs: [makeDoc("chat-1")], size: 1})
      .mockResolvedValueOnce({empty: false, docs: [makeDoc("comment-1")], size: 1})
      .mockResolvedValueOnce({empty: false, docs: [makeDoc("waitlist-1")], size: 1});

    const result = await softDeleteGameCascade("game1", "user1", "Encerramento");

    expect(result).toMatchObject({success: true, dependentsDeleted: 5});
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "confirmation-1"}),
      expect.objectContaining({status: "CANCELLED", deleted_by: "user1"})
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "ride-1"}),
      expect.objectContaining({status: "CANCELLED", deleted_by: "user1"})
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "chat-1"}),
      expect.objectContaining({deleted_by: "user1"})
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "comment-1"}),
      expect.objectContaining({deleted_by: "user1"})
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({id: "waitlist-1"}),
      expect.objectContaining({status: "CANCELLED", deleted_by: "user1"})
    );
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({status: "DELETED", deleted_by: "user1"})
    );
  });

  test("respeita o limite de 450 operações por batch", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({status: "SCHEDULED"}),
    });
    const confirmationDocs = Array.from({length: 451}, (_, index) => ({
      id: `confirmation-${index}`,
      ref: {id: `confirmation-${index}`},
      data: () => ({deleted_at: null}),
    }));
    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: confirmationDocs,
        size: confirmationDocs.length,
      })
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot);

    const result = await softDeleteGameCascade("game1", "user1");

    expect(result).toMatchObject({success: true, dependentsDeleted: 451});
    expect(mockBatchCommit).toHaveBeenCalledTimes(2);
  });

  test("é idempotente quando o jogo já está deletado", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({deleted_at: {toDate: () => new Date()}}),
    });

    const result = await softDeleteGameCascade("game1", "user1");

    expect(result.success).toBe(true);
    expect(mockQueryGet).not.toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });
});

// ==========================================
// softDeleteGroupCascade
// ==========================================

describe("softDeleteGroupCascade", () => {
  const emptyQuerySnapshot = {
    empty: true,
    docs: [],
    size: 0,
  };

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

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            ref: { id: "game1", update: jest.fn() },
            data: () => ({ status: "SCHEDULED", group_id: "group1" }),
          },
          {
            ref: { id: "game2", update: jest.fn() },
            data: () => ({ status: "CONFIRMED", group_id: "group1" }),
          },
        ],
        size: 2,
      })
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "member-1",
            ref: { id: "member-1" },
            data: () => ({ user_id: "user-a", status: "ACTIVE" }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "post-1",
            ref: { id: "post-1" },
            data: () => ({ deleted_at: null }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "poll-1",
            ref: { id: "poll-1" },
            data: () => ({ status: "ACTIVE" }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "group-invite-1",
            ref: { id: "group-invite-1" },
            data: () => ({ status: "PENDING" }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "invite-1",
            ref: { id: "invite-1" },
            data: () => ({ used: false }),
          },
        ],
        size: 1,
      });

    const result = await softDeleteGroupCascade("group1", "user1", "Encerramento do grupo");

    expect(result.groupDeleted).toBe(true);
    expect(result.gamesDeleted).toBe(2);
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockBatchDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: "users/user-a/groups/group1" })
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "post-1" }),
      expect.objectContaining({ deleted_by: "user1" })
    );
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "poll-1" }),
      expect.objectContaining({ status: "CLOSED" })
    );
    const deletingCall = mockDocUpdate.mock.calls.find(
      ([fields]) => fields.status === "DELETING"
    );
    expect(deletingCall).toBeDefined();
    expect(
      mockDocUpdate.mock.invocationCallOrder[
        mockDocUpdate.mock.calls.indexOf(deletingCall!)
      ]
    ).toBeLessThan(mockQueryGet.mock.invocationCallOrder[1]);
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

    mockQueryGet
      .mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            ref: { id: "game1", update: jest.fn() },
            data: () => ({ status: "SCHEDULED", group_id: "group1" }),
          },
          {
            ref: { id: "game2", update: jest.fn() },
            data: () => ({
              status: "DELETED",
              group_id: "group1",
              deleted_at: { toDate: () => new Date() },
            }),
          },
        ],
        size: 2,
      })
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot)
      .mockResolvedValueOnce(emptyQuerySnapshot);

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
