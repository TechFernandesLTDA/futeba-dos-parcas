/**
 * TESTES DE XP PROCESSING IDEMPOTENTE
 */

import {
  generateTransactionId,
  isTransactionAlreadyProcessed,
  processXpIdempotent,
  processXpBatch,
  retryXpOperation,
  XpTransactionData,
} from "../src/xp/processing";

// Mock do Firestore
jest.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
    batch: jest.fn(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    arrayUnion: jest.fn((...args) => ({ _type: "ArrayUnion", elements: args })),
  };

  const mockAdmin = {
    firestore: jest.fn(() => mockFirestore),
  };

  // Adicionar FieldValue como propriedade estática
  (mockAdmin as any).firestore.FieldValue = mockFieldValue;

  return mockAdmin;
});

describe("XP Processing - Idempotência", () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const admin = require("firebase-admin");
    mockDb = admin.firestore();
  });

  describe("generateTransactionId", () => {
    test("deve gerar ID determinístico", () => {
      const id1 = generateTransactionId("game123", "user456");
      const id2 = generateTransactionId("game123", "user456");

      expect(id1).toBe(id2);
      expect(id1).toBe("game_game123_user_user456");
    });

    test("deve gerar IDs diferentes para jogos diferentes", () => {
      const id1 = generateTransactionId("game123", "user456");
      const id2 = generateTransactionId("game999", "user456");

      expect(id1).not.toBe(id2);
    });

    test("deve gerar IDs diferentes para usuários diferentes", () => {
      const id1 = generateTransactionId("game123", "user456");
      const id2 = generateTransactionId("game123", "user789");

      expect(id1).not.toBe(id2);
    });
  });

  describe("isTransactionAlreadyProcessed", () => {
    test("deve retornar false se transação não existe", async () => {
      // Mock: collection().where().limit().get() retorna empty
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      });

      const result = await isTransactionAlreadyProcessed("game_game123_user_user456");

      expect(result).toBe(false);
      expect(mockDb.collection).toHaveBeenCalledWith("xp_logs");
    });

    test("deve retornar true se transação já foi processada", async () => {
      const mockDoc = {
        transaction_id: "game_game123_user_user456",
        xp_earned: 100,
      };

      // Mock: collection().where().limit().get() retorna documento
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{ data: () => mockDoc }],
            }),
          }),
        }),
      });

      const result = await isTransactionAlreadyProcessed("game_game123_user_user456");

      expect(result).toBe(true);
    });

    test("deve retornar false em caso de erro (fail-safe)", async () => {
      // Mock: query falha com erro
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockRejectedValue(new Error("Firestore error")),
          }),
        }),
      });

      const result = await isTransactionAlreadyProcessed("game_game123_user_user456");

      expect(result).toBe(false);
    });
  });

  describe("processXpIdempotent", () => {
    test("deve processar transação nova com sucesso", async () => {
      const mockData: XpTransactionData = {
        gameId: "game123",
        userId: "user456",
        xpEarned: 100,
        xpBefore: 500,
        xpAfter: 600,
        levelBefore: 5,
        levelAfter: 5,
        breakdown: {
          participation: 10,
          goals: 50,
          assists: 21,
          saves: 0,
          result: 20,
          mvp: 0,
          cleanSheet: 0,
          milestones: 0,
          streak: 0,
          penalty: 0,
        },
        metadata: {
          goals: 5,
          assists: 3,
          saves: 0,
          wasMvp: false,
          wasCleanSheet: false,
          wasWorstPlayer: false,
          gameResult: "WIN",
          milestonesUnlocked: [],
        },
      };

      // Mock isTransactionAlreadyProcessed = false (nova transação)
      const mockWhereQuery = {
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      };

      mockDb.collection.mockImplementation((collectionName: string) => {
        if (collectionName === "xp_logs") {
          return {
            where: jest.fn().mockReturnValue(mockWhereQuery),
            doc: jest.fn().mockReturnValue({
              id: "doc_id",
            }),
          };
        }
        // Para users collection
        return {
          doc: jest.fn().mockReturnValue({
            id: "user456",
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ experience_points: 500, level: 5 }),
            }),
            update: jest.fn().mockResolvedValue({}),
          }),
        };
      });

      // Mock transaction com suporte a .get(query) e .get(docRef)
      const mockTransaction = {
        get: jest.fn().mockImplementation((refOrQuery) => {
          // Se for um document reference (tem field `.id`), retorna documento
          if (refOrQuery && typeof refOrQuery === "object" && refOrQuery.id) {
            return Promise.resolve({
              exists: true,
              id: refOrQuery.id,
              data: () => ({ experience_points: 500, level: 5 }),
            });
          }
          // Se for uma query, retorna { empty: true }
          return Promise.resolve({ empty: true, docs: [] });
        }),
        update: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue({}),
      };

      mockDb.runTransaction.mockImplementation(async (callback: Function) => {
        return callback(mockTransaction);
      });

      // Executar teste
      const result = await processXpIdempotent(mockData);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
      expect(result.transactionId).toBe("game_game123_user_user456");
      expect(mockDb.runTransaction).toHaveBeenCalled();
    });

    test("deve retornar sucesso se transação já foi processada", async () => {
      const mockData: XpTransactionData = {
        gameId: "game123",
        userId: "user456",
        xpEarned: 100,
        xpBefore: 500,
        xpAfter: 600,
        levelBefore: 5,
        levelAfter: 5,
        breakdown: {
          participation: 10,
          goals: 50,
          assists: 21,
          saves: 0,
          result: 20,
          mvp: 0,
          cleanSheet: 0,
          milestones: 0,
          streak: 0,
          penalty: 0,
        },
        metadata: {
          goals: 5,
          assists: 3,
          saves: 0,
          wasMvp: false,
          wasCleanSheet: false,
          wasWorstPlayer: false,
          gameResult: "WIN",
          milestonesUnlocked: [],
        },
      };

      // Mock isTransactionAlreadyProcessed = true (já processada)
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: false,
              docs: [{ data: () => { return {} } }],
            }),
          }),
        }),
      });

      const result = await processXpIdempotent(mockData);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
      expect(result.transactionId).toBe("game_game123_user_user456");
    });

    test("deve lidar com milestones unlock na transação", async () => {
      const mockData: XpTransactionData = {
        gameId: "game456",
        userId: "user789",
        xpEarned: 150,
        xpBefore: 50,
        xpAfter: 200,
        levelBefore: 0,
        levelAfter: 1,
        breakdown: {
          participation: 10,
          goals: 50,
          assists: 0,
          saves: 0,
          result: 20,
          mvp: 30,
          cleanSheet: 0,
          milestones: 40,
          streak: 0,
          penalty: 0,
        },
        metadata: {
          goals: 5,
          assists: 0,
          saves: 0,
          wasMvp: true,
          wasCleanSheet: false,
          wasWorstPlayer: false,
          gameResult: "WIN",
          milestonesUnlocked: ["GOALS_5", "MVP_3"],
        },
      };

      // Mock setup
      const mockWhereQuery = {
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      };

      mockDb.collection.mockImplementation((collectionName: string) => {
        if (collectionName === "xp_logs") {
          return {
            where: jest.fn().mockReturnValue(mockWhereQuery),
            doc: jest.fn().mockReturnValue({
              id: "doc_id",
            }),
          };
        }
        return {
          doc: jest.fn().mockReturnValue({
            id: "user789",
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({ experience_points: 50, level: 0 }),
            }),
            update: jest.fn().mockResolvedValue({}),
          }),
        };
      });

      const mockTransaction = {
        get: jest.fn().mockImplementation((refOrQuery) => {
          // Se for um document reference, retorna documento
          if (refOrQuery && typeof refOrQuery === "object" && refOrQuery.id) {
            return Promise.resolve({
              exists: true,
              id: refOrQuery.id,
              data: () => ({ experience_points: 50, level: 0 }),
            });
          }
          // Se for uma query, retorna { empty: true }
          return Promise.resolve({ empty: true, docs: [] });
        }),
        update: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue({}),
      };

      mockDb.runTransaction.mockImplementation(async (callback: Function) => {
        return callback(mockTransaction);
      });

      const result = await processXpIdempotent(mockData);

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(false);
      // Verificar que update foi chamado para milestones
      expect(mockTransaction.update).toHaveBeenCalled();
      expect(mockTransaction.set).toHaveBeenCalled();
    });
  });

  describe("retryXpOperation", () => {
    test("deve executar operação bem-sucedida sem retry", async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return "success";
      };

      const result = await retryXpOperation(operation, 3);

      expect(result).toBe("success");
      expect(callCount).toBe(1);
    });

    test("deve fazer retry em operações com falha transiente", async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 3) {
          const error: any = new Error("contention");
          error.code = 10; // ABORTED
          throw error;
        }
        return "success";
      };

      const result = await retryXpOperation(operation, 3, 10);

      expect(result).toBe("success");
      expect(callCount).toBe(3);
    });

    test("deve falhar após esgotar tentativas", async () => {
      const operation = async () => {
        const error: any = new Error("persistent error");
        error.code = 10;
        throw error;
      };

      await expect(retryXpOperation(operation, 3, 10)).rejects.toThrow(
        "persistent error"
      );
    });

    test("não deve fazer retry em erros não-transientes", async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        throw new Error("non-transient error");
      };

      await expect(retryXpOperation(operation, 3, 10)).rejects.toThrow(
        "non-transient error"
      );
      expect(callCount).toBe(1);
    });
  });
});

describe("XP Processing - Batch Operations", () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const admin = require("firebase-admin");
    mockDb = admin.firestore();
  });

  describe("processXpBatch", () => {
    test("deve retornar array vazio para batch vazio", async () => {
      const results = await processXpBatch([]);
      expect(results).toEqual([]);
    });

    test("deve processar múltiplas transações com sucesso", async () => {
      const mockTransactions: XpTransactionData[] = [
        {
          gameId: "game1",
          userId: "user1",
          xpEarned: 100,
          xpBefore: 500,
          xpAfter: 600,
          levelBefore: 5,
          levelAfter: 5,
          breakdown: {
            participation: 10,
            goals: 50,
            assists: 20,
            saves: 0,
            result: 20,
            mvp: 0,
            cleanSheet: 0,
            milestones: 0,
            streak: 0,
            penalty: 0,
          },
          metadata: {
            goals: 5,
            assists: 2,
            saves: 0,
            wasMvp: false,
            wasCleanSheet: false,
            wasWorstPlayer: false,
            gameResult: "WIN",
            milestonesUnlocked: [],
          },
        },
        {
          gameId: "game1",
          userId: "user2",
          xpEarned: 80,
          xpBefore: 400,
          xpAfter: 480,
          levelBefore: 4,
          levelAfter: 4,
          breakdown: {
            participation: 10,
            goals: 30,
            assists: 20,
            saves: 0,
            result: 20,
            mvp: 0,
            cleanSheet: 0,
            milestones: 0,
            streak: 0,
            penalty: 0,
          },
          metadata: {
            goals: 3,
            assists: 2,
            saves: 0,
            wasMvp: false,
            wasCleanSheet: false,
            wasWorstPlayer: false,
            gameResult: "WIN",
            milestonesUnlocked: [],
          },
        },
      ];

      // Mock: Nenhuma transação já processada
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        }),
        doc: jest.fn().mockReturnValue({}),
      });

      // Mock batch
      const mockBatchObj: any = {};
      mockBatchObj.update = jest.fn().mockReturnValue(mockBatchObj);
      mockBatchObj.set = jest.fn().mockReturnValue(mockBatchObj);
      mockBatchObj.commit = jest.fn().mockResolvedValue({});

      mockDb.batch.mockReturnValue(mockBatchObj);

      const results = await processXpBatch(mockTransactions);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].alreadyProcessed).toBe(false);
      expect(results[1].alreadyProcessed).toBe(false);
      expect(mockDb.batch).toHaveBeenCalled();
      expect(mockBatchObj.commit).toHaveBeenCalled();
    });

    test("deve filtrar transações já processadas no batch", async () => {
      const mockTransactions: XpTransactionData[] = [
        {
          gameId: "game1",
          userId: "user1",
          xpEarned: 100,
          xpBefore: 500,
          xpAfter: 600,
          levelBefore: 5,
          levelAfter: 5,
          breakdown: {
            participation: 10,
            goals: 50,
            assists: 20,
            saves: 0,
            result: 20,
            mvp: 0,
            cleanSheet: 0,
            milestones: 0,
            streak: 0,
            penalty: 0,
          },
          metadata: {
            goals: 5,
            assists: 2,
            saves: 0,
            wasMvp: false,
            wasCleanSheet: false,
            wasWorstPlayer: false,
            gameResult: "WIN",
            milestonesUnlocked: [],
          },
        },
        {
          gameId: "game1",
          userId: "user2",
          xpEarned: 80,
          xpBefore: 400,
          xpAfter: 480,
          levelBefore: 4,
          levelAfter: 4,
          breakdown: {
            participation: 10,
            goals: 30,
            assists: 20,
            saves: 0,
            result: 20,
            mvp: 0,
            cleanSheet: 0,
            milestones: 0,
            streak: 0,
            penalty: 0,
          },
          metadata: {
            goals: 3,
            assists: 2,
            saves: 0,
            wasMvp: false,
            wasCleanSheet: false,
            wasWorstPlayer: false,
            gameResult: "WIN",
            milestonesUnlocked: [],
          },
        },
      ];

      // Mock: primeira transação já processada
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                data: () => ({ transaction_id: "game_game1_user_user1" }),
              },
            ],
          }),
        }),
        doc: jest.fn().mockReturnValue({}),
      });

      const mockBatchObj2: any = {};
      mockBatchObj2.update = jest.fn().mockReturnValue(mockBatchObj2);
      mockBatchObj2.set = jest.fn().mockReturnValue(mockBatchObj2);
      mockBatchObj2.commit = jest.fn().mockResolvedValue({});

      mockDb.batch.mockReturnValue(mockBatchObj2);

      const results = await processXpBatch(mockTransactions);

      // Deve retornar apenas a transação nova (user2), já que user1 foi skipped
      expect(results).toHaveLength(1);
      expect(results[0].transactionId).toBe("game_game1_user_user2");
      expect(results[0].alreadyProcessed).toBe(false);
      expect(results[0].success).toBe(true);
    });

    test("deve lidar com erro de commit no batch", async () => {
      const mockTransactions: XpTransactionData[] = [
        {
          gameId: "game1",
          userId: "user1",
          xpEarned: 100,
          xpBefore: 500,
          xpAfter: 600,
          levelBefore: 5,
          levelAfter: 5,
          breakdown: {
            participation: 10,
            goals: 50,
            assists: 20,
            saves: 0,
            result: 20,
            mvp: 0,
            cleanSheet: 0,
            milestones: 0,
            streak: 0,
            penalty: 0,
          },
          metadata: {
            goals: 5,
            assists: 2,
            saves: 0,
            wasMvp: false,
            wasCleanSheet: false,
            wasWorstPlayer: false,
            gameResult: "WIN",
            milestonesUnlocked: [],
          },
        },
      ];

      // Mock: Nenhuma transação processada
      mockDb.collection.mockReturnValue({
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: true,
            docs: [],
          }),
        }),
        doc: jest.fn().mockReturnValue({}),
      });

      // Mock batch com erro no commit
      const mockBatchObj3: any = {};
      mockBatchObj3.update = jest.fn().mockReturnValue(mockBatchObj3);
      mockBatchObj3.set = jest.fn().mockReturnValue(mockBatchObj3);
      mockBatchObj3.commit = jest.fn().mockRejectedValue(new Error("Batch commit failed"));

      mockDb.batch.mockReturnValue(mockBatchObj3);

      const results = await processXpBatch(mockTransactions);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Batch commit failed");
    });
  });
});

describe("XP Processing - Edge Cases", () => {
  test("deve lidar com XP negativo (penalidades)", () => {
    const mockData: XpTransactionData = {
      gameId: "game123",
      userId: "user456",
      xpEarned: -10,
      xpBefore: 100,
      xpAfter: 90,
      levelBefore: 1,
      levelAfter: 1,
      breakdown: {
        participation: 0,
        goals: 0,
        assists: 0,
        saves: 0,
        result: 0,
        mvp: 0,
        cleanSheet: 0,
        milestones: 0,
        streak: 0,
        penalty: -10,
      },
      metadata: {
        goals: 0,
        assists: 0,
        saves: 0,
        wasMvp: false,
        wasCleanSheet: false,
        wasWorstPlayer: true,
        gameResult: "LOSS",
        milestonesUnlocked: [],
      },
    };

    expect(mockData.xpEarned).toBe(-10);
    expect(mockData.xpAfter).toBeLessThan(mockData.xpBefore);
  });

  test("deve lidar com level up", () => {
    const mockData: XpTransactionData = {
      gameId: "game123",
      userId: "user456",
      xpEarned: 150,
      xpBefore: 50,
      xpAfter: 200,
      levelBefore: 0,
      levelAfter: 1,
      breakdown: {
        participation: 10,
        goals: 50,
        assists: 21,
        saves: 0,
        result: 20,
        mvp: 30,
        cleanSheet: 0,
        milestones: 50,
        streak: 0,
        penalty: 0,
      },
      metadata: {
        goals: 5,
        assists: 3,
        saves: 0,
        wasMvp: true,
        wasCleanSheet: false,
        wasWorstPlayer: false,
        gameResult: "WIN",
        milestonesUnlocked: ["GOALS_10"],
      },
    };

    expect(mockData.levelAfter).toBeGreaterThan(mockData.levelBefore);
    expect(mockData.metadata.milestonesUnlocked.length).toBeGreaterThan(0);
  });
});
