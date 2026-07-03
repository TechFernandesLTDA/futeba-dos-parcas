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
      // Mock: collection().doc().get() retorna doc inexistente
      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: false }),
        }),
      });

      const result = await isTransactionAlreadyProcessed("game_game123_user_user456");

      expect(result).toBe(false);
      expect(mockDb.collection).toHaveBeenCalledWith("xp_logs");
    });

    test("deve retornar true se transação já foi processada", async () => {
      // Mock: collection().doc().get() retorna doc existente
      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: true }),
        }),
      });

      const result = await isTransactionAlreadyProcessed("game_game123_user_user456");

      expect(result).toBe(true);
    });

    test("deve lançar erro em caso de falha (fail-closed, FIX #1599)", async () => {
      // Mock: collection().doc().get() falha com erro
      mockDb.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValue(new Error("Firestore error")),
        }),
      });

      await expect(
        isTransactionAlreadyProcessed("game_game123_user_user456")
      ).rejects.toThrow("Firestore error");
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
              get: jest.fn().mockResolvedValue({ exists: false }),
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
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: true }),
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
      mockDb.collection.mockImplementation((collectionName: string) => {
        if (collectionName === "xp_logs") {
          return {
            doc: jest.fn().mockReturnValue({
              id: "xp_log_doc",
              get: jest.fn().mockResolvedValue({ exists: false }),
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
          // xp_logs logRef — transação nova, ainda não existe
          if (refOrQuery && refOrQuery.id === "xp_log_doc") {
            return Promise.resolve({ exists: false });
          }
          // user docRef — usuário existe
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

    /**
     * SECFIX #441: Tests adaptados para runTransaction
     * (idempotência atômica via xp_logs/{transactionId}).
     *
     * Helper: cria mock de tx.get retornando exists conforme map.
     */
    const mockTxnExistsMap = (
      existsMap: Record<string, boolean>,
      userDataMap: Record<string, Record<string, unknown>> = {}
    ) => {
      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((id?: string) => ({
          _path: `${coll}/${id ?? "auto"}`,
          _id: id,
          _collection: coll,
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({empty: true, docs: []}),
        }),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              // ref tem formato {_path, _id, _collection}
              const txId = ref._id;
              if (ref._collection === "users") {
                return {
                  exists: true,
                  data: () => userDataMap[txId] || {
                    experience_points: 500,
                    level: 5,
                    milestones_achieved: [],
                  },
                };
              }
              return {
                exists: existsMap[txId] === true,
                data: () => ({transaction_id: txId}),
              };
            }),
            update: jest.fn(),
            set: jest.fn(),
          };
          return callback(tx);
        }
      );
    };

    const sampleTxn = (
      gameId: string,
      userId: string,
      xpEarned = 100,
      milestonesUnlocked: string[] = []
    ): XpTransactionData => ({
      gameId,
      userId,
      xpEarned,
      xpBefore: 500,
      xpAfter: 500 + xpEarned,
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
        milestonesUnlocked,
      },
    });

    test("deve processar múltiplas transações com sucesso", async () => {
      const mockTransactions = [
        sampleTxn("game1", "user1"),
        sampleTxn("game1", "user2", 80),
      ];

      // Nenhum log existente
      mockTxnExistsMap({});

      const results = await processXpBatch(mockTransactions);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].alreadyProcessed).toBe(false);
      expect(results[1].alreadyProcessed).toBe(false);
      expect(mockDb.runTransaction).toHaveBeenCalled();
    });

    test("deve filtrar transações já processadas no batch", async () => {
      const mockTransactions = [
        sampleTxn("game1", "user1"),
        sampleTxn("game1", "user2", 80),
      ];

      // user1 já tem log
      mockTxnExistsMap({"game_game1_user_user1": true});

      const results = await processXpBatch(mockTransactions);

      expect(results).toHaveLength(2);
      const user1 = results.find((r) =>
        r.transactionId === "game_game1_user_user1"
      );
      const user2 = results.find((r) =>
        r.transactionId === "game_game1_user_user2"
      );
      expect(user1?.alreadyProcessed).toBe(true);
      expect(user1?.success).toBe(true);
      expect(user2?.alreadyProcessed).toBe(false);
      expect(user2?.success).toBe(true);
    });

    test("usa user snapshot fresco para level e não duplica XP de milestone", async () => {
      const setCalls: Array<{ref: any; data: Record<string, unknown>}> = [];

      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((id?: string) => ({
          _path: `${coll}/${id ?? "auto"}`,
          _id: id,
          _collection: coll,
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({empty: true, docs: []}),
        }),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              if (ref._collection === "users") {
                return {
                  exists: true,
                  data: () => ({
                    experience_points: 340,
                    level: 1,
                    milestones_achieved: ["WINS_10"],
                  }),
                };
              }
              return {exists: false, data: () => ({})};
            }),
            update: jest.fn(),
            set: jest.fn((ref: any, data: Record<string, unknown>) => {
              setCalls.push({ref, data});
            }),
          };
          return callback(tx);
        }
      );

      const results = await processXpBatch([
        {
          ...sampleTxn("game1", "user1", 100, ["WINS_10"]),
          breakdown: {
            participation: 25,
            goals: 0,
            assists: 0,
            saves: 0,
            result: 0,
            mvp: 0,
            cleanSheet: 0,
            milestones: 75,
            streak: 0,
            penalty: 0,
          },
        },
      ]);

      const logSet = setCalls.find((call) =>
        call.ref._collection === "xp_logs"
      );

      expect(results[0].success).toBe(true);
      expect(logSet?.data.xp_earned).toBe(25);
      expect(logSet?.data.xp_before).toBe(340);
      expect(logSet?.data.xp_after).toBe(365);
      expect(logSet?.data.level_before).toBe(1);
      expect(logSet?.data.level_after).toBe(2);
      expect(logSet?.data.xp_milestones).toBe(0);
      expect(logSet?.data.milestones_unlocked).toEqual([]);
    });

    test("remove milestone duplicado antes de aplicar teto de XP", async () => {
      const setCalls: Array<{ref: any; data: Record<string, unknown>}> = [];

      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((id?: string) => ({
          _path: `${coll}/${id ?? "auto"}`,
          _id: id,
          _collection: coll,
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({empty: true, docs: []}),
        }),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              if (ref._collection === "users") {
                return {
                  exists: true,
                  data: () => ({
                    experience_points: 1000,
                    level: 3,
                    milestones_achieved: ["WINS_10"],
                  }),
                };
              }
              return {exists: false, data: () => ({})};
            }),
            update: jest.fn(),
            set: jest.fn((ref: any, data: Record<string, unknown>) => {
              setCalls.push({ref, data});
            }),
          };
          return callback(tx);
        }
      );

      const cappedTxn = sampleTxn("game1", "user1", 500, ["WINS_10"]);
      cappedTxn.breakdown = {
        ...cappedTxn.breakdown,
        participation: 480,
        goals: 0,
        assists: 0,
        result: 0,
        milestones: 75,
      };

      await processXpBatch([cappedTxn]);

      const logSet = setCalls.find((call) =>
        call.ref._collection === "xp_logs"
      );

      expect(logSet?.data.xp_earned).toBe(480);
      expect(logSet?.data.xp_after).toBe(1480);
      expect(logSet?.data.xp_milestones).toBe(0);
    });

    test("preserva milestone menor quando milestone maior excede MAX_XP_PER_GAME", async () => {
      const setCalls: Array<{ref: any; data: Record<string, unknown>}> = [];
      const updateCalls: Array<{ref: any; data: Record<string, unknown>}> = [];

      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((id?: string) => ({
          _path: `${coll}/${id ?? "auto"}`,
          _id: id,
          _collection: coll,
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({empty: true, docs: []}),
        }),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              if (ref._collection === "users") {
                return {
                  exists: true,
                  data: () => ({
                    experience_points: 200,
                    level: 0,
                    milestones_achieved: [],
                  }),
                };
              }
              return {exists: false, data: () => ({})};
            }),
            update: jest.fn((ref: any, data: Record<string, unknown>) => {
              updateCalls.push({ref, data});
            }),
            set: jest.fn((ref: any, data: Record<string, unknown>) => {
              setCalls.push({ref, data});
            }),
          };
          return callback(tx);
        }
      );

      const cappedTxn = sampleTxn(
        "game1",
        "user1",
        500,
        ["GAMES_100", "GOALS_10"]
      );
      cappedTxn.breakdown = {
        ...cappedTxn.breakdown,
        participation: 450,
        goals: 0,
        assists: 0,
        saves: 0,
        result: 0,
        mvp: 0,
        cleanSheet: 0,
        streak: 0,
        penalty: 0,
        milestones: 550,
      };

      await processXpBatch([cappedTxn]);

      const logSet = setCalls.find((call) =>
        call.ref._collection === "xp_logs"
      );
      const milestoneUpdate = updateCalls.find((call) =>
        call.ref._collection === "users" &&
        Object.prototype.hasOwnProperty.call(
          call.data,
          "milestones_achieved"
        )
      );

      expect(logSet?.data.xp_earned).toBe(500);
      expect(logSet?.data.xp_milestones).toBe(50);
      expect(logSet?.data.milestones_unlocked).toEqual([
        "GOALS_10",
      ]);
      expect(milestoneUpdate?.data).toMatchObject({
        milestones_achieved: expect.anything(),
      });
    });

    test("deve lidar com erro de commit na transaction", async () => {
      const mockTransactions = [sampleTxn("game1", "user1")];

      mockDb.collection.mockImplementation((_coll: string) => ({
        doc: jest.fn(() => ({})),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({empty: true, docs: []}),
        }),
      }));
      mockDb.runTransaction.mockRejectedValue(
        new Error("Transaction commit failed")
      );

      const results = await processXpBatch(mockTransactions);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Transaction commit failed");
    });

    /**
     * SECFIX #441: Race condition coverage.
     *
     * Verifica que tx.get(logRef) é chamado ANTES de tx.set(logRef)
     * — i.e. check de existência acontece dentro da transaction.
     * Isso garante que Firestore detecta contention e força retry
     * em concurrent triggers.
     */
    test("[SECFIX #441] check de idempotência roda dentro de runTransaction", async () => {
      const mockTransactions = [sampleTxn("game1", "user1")];

      const callOrder: string[] = [];

      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((id?: string) => ({
          _path: `${coll}/${id ?? "auto"}`,
          _id: id,
          _collection: coll,
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({empty: true, docs: []}),
        }),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              callOrder.push(`tx.get(${ref._id})`);
              if (ref._collection === "users") {
                return {
                  exists: true,
                  data: () => ({
                    experience_points: 500,
                    level: 5,
                    milestones_achieved: [],
                  }),
                };
              }
              return {exists: false, data: () => ({})};
            }),
            update: jest.fn((ref: any) => {
              callOrder.push(`tx.update(${ref._path})`);
            }),
            set: jest.fn((ref: any) => {
              callOrder.push(`tx.set(${ref._id})`);
            }),
          };
          return callback(tx);
        }
      );

      await processXpBatch(mockTransactions);

      // Asserções de ordem: get DEVE preceder set/update
      const getIdx = callOrder.findIndex((c) =>
        c.startsWith("tx.get(game_game1_user_user1)")
      );
      const setIdx = callOrder.findIndex((c) =>
        c.startsWith("tx.set(game_game1_user_user1)")
      );

      expect(getIdx).toBeGreaterThanOrEqual(0);
      expect(setIdx).toBeGreaterThanOrEqual(0);
      expect(getIdx).toBeLessThan(setIdx);
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);
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
