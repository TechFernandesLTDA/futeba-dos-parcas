const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    batch: jest.fn(() => ({
      delete: mockBatchDelete,
      commit: mockBatchCommit,
    })),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
  Timestamp: class Timestamp {},
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {},
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 1,
    resetAt: new Date(),
  }),
}));

jest.mock("../src/validation/index", () => ({
  sanitizeText: jest.fn((value: string) => value),
}));

jest.mock("../src/error-messages", () => ({
  ERROR_MSGS: {},
}));

jest.mock("../src/constants", () => ({
  FIRESTORE_BATCH_SAFE_LIMIT: 450,
  FIRESTORE_WHERE_IN_LIMIT: 10,
  FUNCTION_REGION: "southamerica-east1",
  GAME_GENDERS: ["MALE", "FEMALE", "MIXED"],
}));

import {__testing} from "../src/cache/leaderboard-cache";

describe("leaderboard-cache batching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deleteDocsInBatches divide deletes acima de 500 em batches seguros", async () => {
    const fakeDb: any = {
      batch: jest.fn(() => ({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
    };

    const docs = Array.from({length: 905}, (_, index) => ({
      ref: {path: `cache_leaderboard/doc-${index}`},
    })) as any[];

    const committedBatches =
      await __testing.deleteDocsInBatches(fakeDb, docs as any);

    expect(committedBatches).toBe(3);
    expect(fakeDb.batch).toHaveBeenCalledTimes(3);
    expect(mockBatchDelete).toHaveBeenCalledTimes(905);
    expect(mockBatchCommit).toHaveBeenCalledTimes(3);
  });
});
