const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockSummaryDoc = {path: "groups/group1/cashbox_summary/current"};
const mockSummaryCollection = {
  doc: jest.fn(() => mockSummaryDoc),
};
const mockCashboxQuery = {
  orderBy: mockOrderBy,
  limit: mockLimit,
};
const mockGroupDoc = {
  collection: jest.fn((name: string) => {
    if (name === "cashbox") return mockCashboxQuery;
    if (name === "cashbox_summary") return mockSummaryCollection;
    throw new Error(`Unexpected subcollection: ${name}`);
  }),
};
const mockGroupsCollection = {
  doc: jest.fn(() => mockGroupDoc),
};
const mockRunTransaction = jest.fn();
const mockDb = {
  collection: jest.fn(() => mockGroupsCollection),
  runTransaction: mockRunTransaction,
};
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
const mockServerTimestampValue = {_type: "ServerTimestamp"};

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

jest.mock("firebase-admin/firestore", () => {
  class MockTimestamp {
    private readonly millis: number;
    constructor(millis: number) {
      this.millis = millis;
    }
    toMillis() {
      return this.millis;
    }
    static fromMillis(millis: number) {
      return new MockTimestamp(millis);
    }
  }

  return {
    FieldValue: {
      serverTimestamp: jest.fn(() => mockServerTimestampValue),
    },
    Timestamp: MockTimestamp,
  };
});

jest.mock("../src/_db", () => ({
  db: jest.fn(() => mockDb),
}));

const {Timestamp} = require("firebase-admin/firestore");
const {onCashboxEntryWritten} = require("../src/cashbox/summary-recompute");

describe("onCashboxEntryWritten", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrderBy.mockReturnValue(mockCashboxQuery);
    mockLimit.mockReturnValue(mockCashboxQuery);
  });

  it("recalcula com orderBy deterministico e sinaliza truncamento parcial", async () => {
    const newestMillis = Date.UTC(2026, 5, 26, 12, 0, 0);
    const docs = Array.from({length: 1000}, (_, index) => ({
      data: () => ({
        status: "OPEN",
        type: "INCOME",
        amount: 1,
        created_at: new Timestamp(newestMillis - index),
      }),
    }));
    docs.push({
      data: () => ({
        status: "OPEN",
        type: "EXPENSE",
        amount: 9999,
        created_at: new Timestamp(newestMillis - 5000),
      }),
    });

    const tx = {
      get: jest.fn().mockResolvedValue({
        size: docs.length,
        docs,
      }),
      set: jest.fn(),
    };

    mockRunTransaction.mockImplementation(async (callback: (arg0: typeof tx) => Promise<void>) => {
      await callback(tx);
    });

    await onCashboxEntryWritten({
      params: {groupId: "group1"},
    });

    expect(mockOrderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(mockLimit).toHaveBeenCalledWith(1001);
    expect(tx.set).toHaveBeenCalledTimes(1);

    const [, summary, options] = tx.set.mock.calls[0];
    expect(summary).toMatchObject({
      balance: 1000,
      total_income: 1000,
      total_expense: 0,
      entry_count: 1000,
      truncated: true,
      recomputed_at: mockServerTimestampValue,
    });
    expect(summary.last_entry_at.toMillis()).toBe(newestMillis);
    expect(options).toEqual({merge: true});
    expect(mockLoggerWarn).toHaveBeenCalled();
  });
});
