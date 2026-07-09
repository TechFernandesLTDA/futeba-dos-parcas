const mockLimit = jest.fn();
const mockStartAfter = jest.fn();
const mockCashboxGet = jest.fn();
const mockSummarySet = jest.fn();
const mockRunTransaction = jest.fn();
const mockSummaryDoc = {
  path: "groups/group1/cashbox_summary/current",
  set: mockSummarySet,
};
const mockSummaryCollection = {
  doc: jest.fn(() => mockSummaryDoc),
};
const mockCashboxQuery = {
  startAfter: mockStartAfter,
  get: mockCashboxGet,
};
const mockCashboxCollection = {
  limit: mockLimit,
};
const mockGroupDoc = {
  collection: jest.fn((name: string) => {
    if (name === "cashbox") return mockCashboxCollection;
    if (name === "cashbox_summary") return mockSummaryCollection;
    throw new Error(`Unexpected subcollection: ${name}`);
  }),
};
const mockGroupsCollection = {
  doc: jest.fn(() => mockGroupDoc),
};
const mockDb = {
  collection: jest.fn(() => mockGroupsCollection),
  runTransaction: mockRunTransaction,
};
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockServerTimestampValue = {_type: "ServerTimestamp"};

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: mockLoggerInfo,
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
    mockLimit.mockReturnValue(mockCashboxQuery);
    mockStartAfter.mockReturnValue(mockCashboxQuery);
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: jest.fn(async () => ({exists: false, data: () => undefined})),
      set: mockSummarySet,
    }));
  });

  it("pagina todo o ledger e soma em centavos sem truncar o saldo", async () => {
    const newestMillis = Date.UTC(2026, 6, 9, 12, 0, 0);
    const firstPageDocs = Array.from({length: 500}, (_, index) => ({
      id: `doc-${index}`,
      data: () => ({
        status: "ACTIVE",
        type: "INCOME",
        amount: 1,
        created_at: new Timestamp(newestMillis - index),
      }),
    }));
    const secondPageDocs = [
      {
        id: "doc-500",
        data: () => ({
          status: "ACTIVE",
          type: "EXPENSE",
          amount: 0.1,
          created_at: new Timestamp(newestMillis - 1000),
        }),
      },
      {
        id: "doc-501",
        data: () => ({
          status: "ACTIVE",
          type: "EXPENSE",
          amount: 0.2,
          created_at: new Timestamp(newestMillis - 1001),
        }),
      },
    ];

    mockCashboxGet
      .mockResolvedValueOnce({
        empty: false,
        size: firstPageDocs.length,
        docs: firstPageDocs,
      })
      .mockResolvedValueOnce({
        empty: false,
        size: secondPageDocs.length,
        docs: secondPageDocs,
      });

    await onCashboxEntryWritten({
      params: {groupId: "group1"},
      time: "2026-07-09T12:00:00.000Z",
    });

    expect(mockLimit).toHaveBeenCalledWith(500);
    expect(mockStartAfter).toHaveBeenCalledWith(firstPageDocs[firstPageDocs.length - 1]);
    expect(mockSummarySet).toHaveBeenCalledTimes(1);

    const [, summary, options] = mockSummarySet.mock.calls[0];
    expect(summary).toMatchObject({
      balance: 499.7,
      total_income: 500,
      total_expense: 0.3,
      entry_count: 502,
      truncated: false,
      recomputed_at: mockServerTimestampValue,
      source_event_version: "2026-07-09T12:00:00.000Z",
    });
    expect(summary.last_entry_at.toMillis()).toBe(newestMillis);
    expect(options).toEqual({merge: true});
  });

  it("ignora recompute que termina depois de um evento mais novo", async () => {
    mockCashboxGet.mockResolvedValueOnce({empty: true, size: 0, docs: []});
    mockRunTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: jest.fn(async () => ({
        exists: true,
        data: () => ({source_event_version: "2026-07-09T12:00:01.000Z"}),
      })),
      set: mockSummarySet,
    }));

    await onCashboxEntryWritten({
      params: {groupId: "group1"},
      time: "2026-07-09T12:00:00.000Z",
    });

    expect(mockSummarySet).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining("obsoleto ignorado"));
  });
});
