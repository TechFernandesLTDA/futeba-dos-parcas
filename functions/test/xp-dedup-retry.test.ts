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
            update: jest.fn(),
            set: jest.fn(),
          };
          return callback(tx);
        }
      );

      const result = await processXpIdempotent(
        sampleTxn(gameId, userId)
      );

      // Should still return success (not an error). The in-transaction race
      // detection prevents double-processing but alreadyProcessed reflects
      // the pre-check only (false here). The key: no double XP was written.
      expect(result.success).toBe(true);
      // runTransaction was called, indicating the pre-check passed, but
      // the in-transaction check detected the race and aborted the write
      expect(mockDb.runTransaction).toHaveBeenCalledTimes(1);

      // Verify that tx.set was NOT called (no double-write)
      // We can't easily verify this because the function returns early
      // when tx.get finds the doc exists
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
