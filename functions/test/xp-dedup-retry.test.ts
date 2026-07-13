/**
 * TESTS FOR #2548: XP DEDUP PER-PLAYER ON RETRY
 *
 * Verifies that when a partial failure occurs (some players' batches
 * commit, others fail), the retry correctly skips already-processed
 * players by checking the deterministic xp_log doc marker.
 */

import {
  generateTransactionId,
  processXpIdempotent,
  processXpBatch,
  XpTransactionData,
} from "../src/xp/processing";

jest.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: jest.fn(),
    runTransaction: jest.fn(),
    batch: jest.fn(),
  };

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    arrayUnion: jest.fn((...args: any[]) => ({ _type: "ArrayUnion", elements: args })),
  };

  const mockAdmin: any = {
    firestore: jest.fn(() => mockFirestore),
  };
  mockAdmin.firestore.FieldValue = mockFieldValue;

  return mockAdmin;
});

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

describe("XP Dedup on Retry (#2548)", () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const admin = require("firebase-admin");
    mockDb = admin.firestore();
  });

  describe("processXpIdempotent — retry-safe per-player", () => {
    /**
     * Verifies that on retry (second invocation for same game+user),
     * the already-processed marker (xp_log doc at deterministic ID)
     * is detected and the player is skipped without double-processing.
     */
    test("should skip already-processed player on retry (no double XP)", async () => {
      const gameId = "gameRetry";
      const userIdA = "userA";
      const userIdB = "userB";
      const txnIdA = generateTransactionId(gameId, userIdA);
      const txnIdB = generateTransactionId(gameId, userIdB);

      // Track xp_log existence across separate "invocations"
      const committedXpLogs = new Set<string>();

      // Mock collection().doc(id) to return references keyed by path
      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((docId?: string) => ({
          _collection: coll,
          _path: `${coll}/${docId ?? "auto"}`,
          _id: docId,
          id: docId,
          get: jest.fn().mockResolvedValue({
            exists: committedXpLogs.has(docId || ""),
            data: () => ({}),
          }),
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }));

      // runTransaction: succeeds and "commits" the xp_log marker
      let transactionFailNext = false;
      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          if (transactionFailNext) {
            transactionFailNext = false;
            throw new Error("Simulated transaction commit failure");
          }

          const tx = {
            get: jest.fn(async (ref: any) => {
              // xp_logs refs: check committedXpLogs for dedup
              if (ref._collection === "xp_logs") {
                return {
                  exists: committedXpLogs.has(ref._id),
                  data: () => ({}),
                };
              }
              // user refs: always exist (no user existence check for dedup tests)
              return {
                exists: true,
                id: ref._id,
                data: () => ({ experience_points: 500, level: 5 }),
              };
            }),
            update: jest.fn(),
            set: jest.fn((ref: any) => {
              // Simulate: after successful commit, mark as persisted
              committedXpLogs.add(ref._id);
            }),
          };
          const result = await callback(tx);
          return result;
        }
      );

      // --- FIRST RUN: process player A (succeeds), player B (fails) ---

      // Player A: should succeed
      const resultA1 = await processXpIdempotent(
        sampleTxn(gameId, userIdA)
      );
      expect(resultA1.success).toBe(true);
      expect(resultA1.alreadyProcessed).toBe(false);
      expect(resultA1.transactionId).toBe(txnIdA);
      expect(committedXpLogs.has(txnIdA)).toBe(true);

      // Player B: simulate failure
      transactionFailNext = true;
      const resultB1 = await processXpIdempotent(
        sampleTxn(gameId, userIdB)
      );
      expect(resultB1.success).toBe(false);
      expect(resultB1.alreadyProcessed).toBe(false);
      expect(committedXpLogs.has(txnIdB)).toBe(false);

      // --- SECOND RUN (retry): player A should be skipped, B should succeed ---

      // Player A retry: xp_log already exists → skip
      const resultA2 = await processXpIdempotent(
        sampleTxn(gameId, userIdA)
      );
      expect(resultA2.success).toBe(true);
      expect(resultA2.alreadyProcessed).toBe(true);
      expect(resultA2.transactionId).toBe(txnIdA);

      // Player B retry: xp_log still doesn't exist → process fresh
      const resultB2 = await processXpIdempotent(
        sampleTxn(gameId, userIdB)
      );
      expect(resultB2.success).toBe(true);
      expect(resultB2.alreadyProcessed).toBe(false);
      expect(resultB2.transactionId).toBe(txnIdB);
      expect(committedXpLogs.has(txnIdB)).toBe(true);

      // Sanity: A was processed exactly once (runTransaction called once for A)
      // runTransaction was called: A(success) + B(fail) + A(skip, no tx) + B(success)
      // Actually A retry goes through pre-check which returns early, no runTransaction
      // So: A(1) + B(fail=1) + B(success=1) = 3 transaction calls
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(3);
    });

    test("should process all players successfully in normal (no-failure) flow", async () => {
      const gameId = "gameNormal";
      const committedXpLogs = new Set<string>();

      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((docId?: string) => ({
          _collection: coll,
          _path: `${coll}/${docId ?? "auto"}`,
          _id: docId,
          id: docId,
          get: jest.fn().mockResolvedValue({
            exists: committedXpLogs.has(docId || ""),
            data: () => ({}),
          }),
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              if (ref._collection === "xp_logs") {
                return {
                  exists: committedXpLogs.has(ref._id),
                  data: () => ({}),
                };
              }
              return {
                exists: true,
                id: ref._id,
                data: () => ({ experience_points: 500, level: 5 }),
              };
            }),
            update: jest.fn(),
            set: jest.fn((ref: any) => {
              committedXpLogs.add(ref._id);
            }),
          };
          return callback(tx);
        }
      );

      const results = await processXpBatch([
        sampleTxn(gameId, "user1", 100),
        sampleTxn(gameId, "user2", 80),
        sampleTxn(gameId, "user3", 120),
      ]);

      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.success).toBe(true);
        expect(r.alreadyProcessed).toBe(false);
      });

      // All xp_log markers should exist
      expect(committedXpLogs.has(generateTransactionId(gameId, "user1"))).toBe(true);
      expect(committedXpLogs.has(generateTransactionId(gameId, "user2"))).toBe(true);
      expect(committedXpLogs.has(generateTransactionId(gameId, "user3"))).toBe(true);
    });

    test("should handle race condition: marker created between pre-check and transaction", async () => {
      const gameId = "gameRace";
      const userId = "userRace";
      const txnId = generateTransactionId(gameId, userId);

      // Simulate race: pre-check says "not processed", but by the time
      // the transaction runs, another instance already wrote the marker
      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((docId?: string) => ({
          _collection: coll,
          _path: `${coll}/${docId ?? "auto"}`,
          _id: docId,
          id: docId,
          get: jest.fn().mockResolvedValue({
            // Pre-check: not yet processed
            exists: false,
            data: () => ({}),
          }),
        })),
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }));

      const txUpdate = jest.fn();
      const txSet = jest.fn();
      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              // xp_logs ref: simulate race — another instance
              // wrote the marker after our pre-check
              if (ref._collection === "xp_logs") {
                return {
                  exists: true,
                  data: () => ({ transaction_id: txnId }),
                };
              }
              // user ref: exists
              return {
                exists: true,
                id: ref._id,
                data: () => ({ experience_points: 500, level: 5 }),
              };
            }),
            update: txUpdate,
            set: txSet,
          };
          return callback(tx);
        }
      );

      const result = await processXpIdempotent(
        sampleTxn(gameId, userId)
      );

      expect(result.success).toBe(true);
      expect(result.alreadyProcessed).toBe(true);
      // runTransaction was called, indicating the pre-check passed, but
      // the in-transaction check detected the race and aborted the write
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);

      expect(txUpdate).not.toHaveBeenCalled();
      expect(txSet).not.toHaveBeenCalled();
    });

    test("chains repeated-user state and awards a milestone once per batch", async () => {
      const userId = "sameUser";
      const writes: Array<{ ref: any; data: any }> = [];
      const updates: Array<{ ref: any; data: any }> = [];

      mockDb.collection.mockImplementation((coll: string) => ({
        doc: jest.fn((docId?: string) => ({
          _collection: coll,
          _id: docId,
          id: docId,
        })),
      }));

      mockDb.runTransaction.mockImplementation(
        async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            get: jest.fn(async (ref: any) => {
              if (ref._collection === "xp_logs") {
                return { exists: false, data: () => ({}) };
              }
              return {
                exists: true,
                id: ref._id,
                data: () => ({
                  experience_points: 700,
                  level: 2,
                  milestones_achieved: [],
                }),
              };
            }),
            update: jest.fn((ref: any, data: any) => {
              updates.push({ ref, data });
            }),
            set: jest.fn((ref: any, data: any) => {
              writes.push({ ref, data });
            }),
          };
          return callback(tx);
        }
      );

      const gameA = sampleTxn("gameA", userId, 150, ["GOALS_10"]);
      gameA.breakdown.milestones = 50;
      const gameB = sampleTxn("gameB", userId, 150, ["GOALS_10"]);
      gameB.breakdown.milestones = 50;

      const results = await processXpBatch([gameA, gameB]);

      expect(results).toHaveLength(2);
      const xpLogs = writes
        .filter(({ ref }) => ref._collection === "xp_logs")
        .map(({ data }) => data);
      expect(xpLogs).toHaveLength(2);
      expect(xpLogs[0].xp_before).toBe(700);
      expect(xpLogs[0].xp_after).toBe(850);
      expect(xpLogs[0].xp_milestones).toBe(50);
      expect(xpLogs[1].xp_before).toBe(850);
      expect(xpLogs[1].xp_after).toBe(950);
      expect(xpLogs[1].xp_milestones).toBe(0);
      expect(xpLogs[0].level_after).toBe(3);
      expect(xpLogs[1].level_after).toBe(3);

      const milestoneUpdates = updates.filter(
        ({ data }) => data.milestones_achieved
      );
      expect(milestoneUpdates).toHaveLength(1);
      const progressUpdates = updates.filter(
        ({ data }) => data.experience_points
      );
      expect(progressUpdates).toHaveLength(2);
      expect(progressUpdates[1].data.level)
        .toBe(xpLogs[1].level_after);
    });
  });

  describe("generateTransactionId determinism", () => {
    test("should produce the same ID for the same (gameId, userId) pair", () => {
      const id1 = generateTransactionId("game2548", "playerX");
      const id2 = generateTransactionId("game2548", "playerX");
      expect(id1).toBe(id2);
      expect(id1).toBe("game_game2548_user_playerX");
    });
  });
});
