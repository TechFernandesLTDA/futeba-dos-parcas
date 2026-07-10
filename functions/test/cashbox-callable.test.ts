const mockRunTransaction = jest.fn();
const mockTxSet = jest.fn();
const mockTxUpdate = jest.fn();
const mockEntryRef = {id: "cashbox-request-0001", path: "groups/group-1/cashbox/cashbox-request-0001"};
const mockSummaryRef = {path: "groups/group-1/cashbox_summary/current"};
const mockMemberRef = {path: "groups/group-1/members/user-1"};
const mockUserRef = {path: "users/user-1"};
const operationRefs = new Map<string, {path: string}>();
const mockCashboxRef = {doc: jest.fn(() => mockEntryRef)};
const mockGroupRef = {
  path: "groups/group-1",
  collection: jest.fn((name: string) => {
    if (name === "members") return {doc: jest.fn(() => mockMemberRef)};
    if (name === "cashbox_summary") return {doc: jest.fn(() => mockSummaryRef)};
    if (name === "cashbox") return mockCashboxRef;
    if (name === "cashbox_summary_ops") {
      return {doc: jest.fn((id: string) => {
        const ref = {path: `groups/group-1/cashbox_summary_ops/${id}`};
        operationRefs.set(id, ref);
        return ref;
      })};
    }
    throw new Error(`Unexpected subcollection: ${name}`);
  }),
};
const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === "groups") return {doc: jest.fn(() => mockGroupRef)};
    if (name === "users") return {doc: jest.fn(() => mockUserRef)};
    throw new Error(`Unexpected collection: ${name}`);
  }),
  runTransaction: mockRunTransaction,
};
const mockServerTimestamp = {_type: "ServerTimestamp"};

class MockHttpsError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), error: jest.fn()},
  https: {
    onCall: jest.fn((_config: unknown, handler: unknown) => handler),
    HttpsError: MockHttpsError,
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: jest.fn(() => mockServerTimestamp)},
  FieldPath: {documentId: jest.fn(() => "__name__")},
  Timestamp: class MockTimestamp {},
}));
jest.mock("../src/_db", () => ({db: jest.fn(() => mockDb)}));

const {
  createCashboxEntry,
  voidCashboxEntry,
} = require("../src/cashbox/callable");

const groupSnapshot = {
  exists: true,
  data: () => ({owner_id: "user-1", status: "ACTIVE"}),
};
const memberSnapshot = {
  exists: true,
  data: () => ({role: "ADMIN", status: "ACTIVE"}),
};
const userSnapshot = {exists: true, data: () => ({name: "Renan"})};
let summaryData = {
  balance: 10,
  total_income: 10,
  total_expense: 0,
  balance_cents: 1000,
  total_income_cents: 1000,
  total_expense_cents: 0,
  entry_count: 1,
  ledger_version: 7,
  truncated: false,
  recomputed_by_server: true,
};
const summarySnapshot = {
  exists: true,
  data: () => summaryData,
};

describe("cashbox callables incrementais", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    operationRefs.clear();
    summaryData = {
      balance: 10,
      total_income: 10,
      total_expense: 0,
      balance_cents: 1000,
      total_income_cents: 1000,
      total_expense_cents: 0,
      entry_count: 1,
      ledger_version: 7,
      truncated: false,
      recomputed_by_server: true,
    };
  });

  it("cria entry e summary em O(1), sem consultar o ledger", async () => {
    const entrySnapshot = {exists: false, data: () => undefined};
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: {path: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockUserRef) return userSnapshot;
          if (ref === mockEntryRef) return entrySnapshot;
          if (ref === mockSummaryRef) return summarySnapshot;
          if (ref.path.includes("cashbox_summary_ops")) return {exists: false};
          throw new Error(`Unexpected read: ${ref.path}`);
        }),
        set: mockTxSet,
      };
      return callback(tx);
    });

    const result = await createCashboxEntry({
      auth: {uid: "user-1", token: {name: "Renan", verified: true}},
      data: {
        requestId: "cashbox-request-0001",
        groupId: "group-1",
        type: "EXPENSE",
        amount: 0.1 + 0.2,
        description: "Aluguel da bola",
      },
    });

    expect(result).toMatchObject({balanceCents: 970, duplicate: false});
    expect(mockCashboxRef).not.toHaveProperty("limit");
    expect(mockTxSet).toHaveBeenCalledTimes(3);
    expect(mockTxSet).toHaveBeenNthCalledWith(2, mockSummaryRef, expect.objectContaining({
      balance: 9.7,
      balance_cents: 970,
      total_expense_cents: 30,
      entry_count: 2,
      ledger_version: 8,
      summary_source: "create_callable",
    }), {merge: true});
  });

  it("estorna uma única vez e reverte o sinal da despesa", async () => {
    summaryData = {
      ...summaryData,
      balance: 8,
      total_expense: 2,
      balance_cents: 800,
      total_expense_cents: 200,
    };
    const entrySnapshot = {
      exists: true,
      data: () => ({type: "EXPENSE", amount: 2, status: "ACTIVE"}),
    };
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: {path: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockEntryRef) return entrySnapshot;
          if (ref === mockSummaryRef) return summarySnapshot;
          if (ref.path.includes("cashbox_summary_ops")) return {exists: false};
          throw new Error(`Unexpected read: ${ref.path}`);
        }),
        set: mockTxSet,
        update: mockTxUpdate,
      };
      return callback(tx);
    });

    const result = await voidCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {groupId: "group-1", entryId: "cashbox-request-0001"},
    });

    expect(result).toMatchObject({balanceCents: 1000, duplicate: false});
    expect(mockTxUpdate).toHaveBeenCalledWith(mockEntryRef, expect.objectContaining({
      status: "VOIDED",
      voided_by: "user-1",
    }));
    expect(mockTxSet).toHaveBeenCalledWith(mockSummaryRef, expect.objectContaining({
      balance_cents: 1000,
      total_expense_cents: 0,
      entry_count: 0,
      ledger_version: 8,
    }), {merge: true});
  });

  it("bloqueia create quando summary não é autoritativo", async () => {
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref === mockGroupRef) return groupSnapshot;
        if (ref === mockMemberRef) return memberSnapshot;
        if (ref === mockUserRef) return userSnapshot;
        if (ref === mockEntryRef) return {exists: false};
        if (ref === mockSummaryRef) return {exists: false, data: () => undefined};
        return {exists: false};
      }),
      set: mockTxSet,
    }));

    await expect(createCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {
        requestId: "cashbox-request-0001",
        groupId: "group-1",
        type: "INCOME",
        amount: 1,
        description: "Mensalidade",
      },
    })).rejects.toMatchObject({code: "failed-precondition"});
  });
});
