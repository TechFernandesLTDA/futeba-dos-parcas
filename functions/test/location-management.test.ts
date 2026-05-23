/**
 * REGRESSAO #1684 — deleteLocation cascade paginado.
 *
 * Garante que subcolecoes com mais de 500 docs sao deletadas em batches
 * separados, respeitando o limite do Firestore WriteBatch.
 */

function makeBatchInstance() {
  return {
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };
}

const batchInstances: ReturnType<typeof makeBatchInstance>[] = [];
const mockBatch = jest.fn().mockImplementation(() => {
  const batch = makeBatchInstance();
  batchInstances.push(batch);
  return batch;
});

const mockGet = jest.fn();
const mockLimit = jest.fn().mockReturnValue({get: mockGet});
const mockSubcollection = jest.fn().mockReturnValue({limit: mockLimit});
const mockDoc = jest.fn().mockReturnValue({collection: mockSubcollection});
const mockCollection = jest.fn().mockReturnValue({doc: mockDoc});

jest.mock("../src/_db", () => ({
  db: () => ({
    collection: mockCollection,
    batch: mockBatch,
  }),
}));

jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: jest.fn((_options, handler) => handler),
}));

jest.mock("firebase-admin", () => ({
  firestore: {
    FieldValue: {
      serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    },
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {deleteLocationSubcollection} = require(
  "../src/locations/location-management"
);

describe("deleteLocationSubcollection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    batchInstances.length = 0;
  });

  it("deleta subcolecao em paginas de ate 500 docs", async () => {
    mockGet
      .mockResolvedValueOnce(makeSnapshot(500, "page1"))
      .mockResolvedValueOnce(makeSnapshot(500, "page2"))
      .mockResolvedValueOnce(makeSnapshot(200, "page3"));

    await expect(
      deleteLocationSubcollection("location-1", "reviews")
    ).resolves.toBe(1200);

    expect(mockLimit).toHaveBeenCalledWith(500);
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(batchInstances).toHaveLength(3);
    expect(totalDeleteCalls()).toBe(1200);
    expect(batchInstances.every((batch) => batch.commit.mock.calls.length === 1))
      .toBe(true);
  });
});

function makeSnapshot(size: number, prefix: string) {
  const docs = Array.from({length: size}, (_, index) => ({
    ref: {id: `${prefix}-${index}`},
  }));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
  };
}

function totalDeleteCalls() {
  return batchInstances.reduce(
    (total, batch) => total + batch.delete.mock.calls.length,
    0
  );
}
