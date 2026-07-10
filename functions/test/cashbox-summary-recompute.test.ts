const mockSummarySet = jest.fn();
const mockOperationSet = jest.fn();
const mockRunTransaction = jest.fn();
const mockCashboxOrderBy = jest.fn();
const mockSummaryGet = jest.fn();
const mockSummaryRef = {
  path: "groups/group1/cashbox_summary/current",
  get: mockSummaryGet,
};
const mockOperationRef = {path: "groups/group1/cashbox_summary_ops/create_entry-1"};
const mockPageGet = jest.fn();
const mockPageStartAfter = jest.fn();
const mockPageLimit = jest.fn();
const mockPageQuery = {
  get: mockPageGet,
  startAfter: mockPageStartAfter,
  limit: mockPageLimit,
};
const mockCashboxRef = {orderBy: mockCashboxOrderBy};
const mockGroupRef = {
  collection: jest.fn((name: string) => {
    if (name === "cashbox_summary") return {doc: jest.fn(() => mockSummaryRef)};
    if (name === "cashbox_summary_ops") return {doc: jest.fn(() => mockOperationRef)};
    if (name === "cashbox") return mockCashboxRef;
    throw new Error(`Unexpected collection ${name}`);
  }),
};
const mockDb = {
  collection: jest.fn(() => ({doc: jest.fn(() => mockGroupRef)})),
  runTransaction: mockRunTransaction,
};
const mockServerTimestamp = {_type: "ServerTimestamp"};

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_config: unknown, handler: unknown) => handler),
}));
jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), error: jest.fn()},
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: jest.fn(() => mockServerTimestamp)},
  FieldPath: {documentId: jest.fn(() => "__name__")},
  Timestamp: class MockTimestamp {
    constructor(private readonly millis: number) {}
    toMillis() { return this.millis; }
    static fromMillis(millis: number) { return new this(millis); }
  },
}));
jest.mock("../src/_db", () => ({db: jest.fn(() => mockDb)}));

const {onCashboxEntryWritten} = require("../src/cashbox/summary-recompute");
const {reconcileCashboxSummaryForGroup} = require("../src/cashbox/summary");

function snapshot(exists: boolean, data?: Record<string, unknown>) {
  return {exists, data: () => data};
}

describe("onCashboxEntryWritten incremental", () => {
  let markerExists = false;
  let summaryData: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    markerExists = false;
    mockCashboxOrderBy.mockReturnValue(mockPageQuery);
    mockPageLimit.mockReturnValue(mockPageQuery);
    mockPageStartAfter.mockReturnValue(mockPageQuery);
    summaryData = {
      balance: 10,
      total_income: 10,
      total_expense: 0,
      balance_cents: 1000,
      total_income_cents: 1000,
      total_expense_cents: 0,
      entry_count: 1,
      ledger_version: 4,
      recomputed_by_server: true,
      truncated: false,
    };
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: jest.fn(async (ref: unknown) => ref === mockSummaryRef ?
        snapshot(true, summaryData) : snapshot(markerExists)),
      set: jest.fn((ref: unknown, data: Record<string, unknown>, options?: unknown) => {
        if (ref === mockSummaryRef) mockSummarySet(ref, data, options);
        if (ref === mockOperationRef) {
          markerExists = true;
          mockOperationSet(ref, data, options);
        }
      }),
    }));
  });

  it("aplica create por delta e ignora a reentrega do mesmo evento", async () => {
    const event = {
      id: "evt-1",
      time: "2026-07-10T12:00:00.000Z",
      params: {groupId: "group1", entryId: "entry-1"},
      data: {
        before: snapshot(false),
        after: snapshot(true, {
          status: "ACTIVE",
          type: "INCOME",
          amount: 2.5,
          created_by: "user-1",
        }),
      },
    };

    await onCashboxEntryWritten(event);
    await onCashboxEntryWritten(event);

    expect(mockSummarySet).toHaveBeenCalledTimes(1);
    expect(mockSummarySet).toHaveBeenCalledWith(mockSummaryRef, expect.objectContaining({
      balance_cents: 1250,
      total_income_cents: 1250,
      entry_count: 2,
      ledger_version: 5,
      summary_source: "legacy_trigger",
    }), {merge: true});
    expect(mockOperationSet).toHaveBeenCalledTimes(1);
    expect(mockCashboxOrderBy).not.toHaveBeenCalled();
  });

  it("estorno reverte receita sem full scan", async () => {
    const event = {
      id: "evt-void",
      time: "2026-07-10T12:01:00.000Z",
      params: {groupId: "group1", entryId: "entry-1"},
      data: {
        before: snapshot(true, {status: "ACTIVE", type: "INCOME", amount: 4}),
        after: snapshot(true, {
          status: "VOIDED",
          type: "INCOME",
          amount: 4,
          created_by: "user-1",
          updated_at: mockServerTimestamp,
        }),
      },
    };

    await onCashboxEntryWritten(event);

    expect(mockSummarySet).toHaveBeenCalledWith(mockSummaryRef, expect.objectContaining({
      balance_cents: 600,
      total_income_cents: 600,
      entry_count: 0,
      ledger_version: 5,
    }), {merge: true});
    expect(mockCashboxOrderBy).not.toHaveBeenCalled();
  });

  it("reconcilia páginas e repete quando ledger_version muda", async () => {
    const docs = Array.from({length: 500}, (_, index) => ({
      id: `entry-${index}`,
      data: () => ({status: "ACTIVE", type: "INCOME", amount: 1}),
    }));
    mockSummaryGet
      .mockResolvedValueOnce(snapshot(true, {...summaryData, ledger_version: 4}))
      .mockResolvedValueOnce(snapshot(true, {...summaryData, ledger_version: 5}));
    mockPageGet
      .mockResolvedValueOnce({size: 500, docs})
      .mockResolvedValueOnce({size: 1, docs: [{
        id: "entry-500",
        data: () => ({status: "ACTIVE", type: "EXPENSE", amount: 0.5}),
      }]})
      .mockResolvedValueOnce({size: 1, docs: [{
        id: "entry-final",
        data: () => ({status: "ACTIVE", type: "INCOME", amount: 3}),
      }]});

    let commitAttempt = 0;
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      commitAttempt += 1;
      return callback({
        get: jest.fn(async () => snapshot(true, {
          ...summaryData,
          ledger_version: commitAttempt === 1 ? 5 : 5,
        })),
        set: jest.fn((ref: unknown, data: Record<string, unknown>, options?: unknown) => {
          if (ref === mockSummaryRef) mockSummarySet(ref, data, options);
        }),
      });
    });

    const result = await reconcileCashboxSummaryForGroup("group1", {source: "test"});

    expect(commitAttempt).toBe(2);
    expect(mockPageStartAfter).toHaveBeenCalledWith(docs[docs.length - 1]);
    expect(result).toMatchObject({
      incomeCents: 300,
      expenseCents: 0,
      balanceCents: 300,
      entryCount: 1,
      ledgerVersion: 5,
    });
    expect(mockSummarySet).toHaveBeenCalledTimes(1);
    expect(mockSummarySet).toHaveBeenCalledWith(mockSummaryRef, expect.objectContaining({
      ledger_version: 5,
      summary_version: 5,
      summary_source: "test",
    }), {merge: true});
  });
});
