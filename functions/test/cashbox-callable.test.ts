const mockRunTransaction = jest.fn();
const mockEntryDoc = {id: "entry-1", exists: false, data: jest.fn(() => undefined)};
const mockCashboxDoc = jest.fn(() => mockEntryDoc);
const mockSummaryRef = {path: "groups/group-1/cashbox_summary/current"};
const mockMemberRef = {path: "groups/group-1/members/user-1"};
const mockUserRef = {path: "users/user-1"};
const mockLedgerQuery = {path: "groups/group-1/cashbox?limit=1001"};
const mockCashboxRef = {
  path: "groups/group-1/cashbox",
  doc: mockCashboxDoc,
  limit: jest.fn(() => mockLedgerQuery),
  startAfter: jest.fn(() => mockCashboxRef),
};
const mockGroupRef = {
  path: "groups/group-1",
  collection: jest.fn((name: string) => {
    if (name === "members") {
      return {doc: jest.fn(() => mockMemberRef)};
    }
    if (name === "cashbox_summary") {
      return {doc: jest.fn(() => mockSummaryRef)};
    }
    if (name === "cashbox") {
      return mockCashboxRef;
    }
    throw new Error(`Unexpected subcollection: ${name}`);
  }),
};
const mockGroupsCollection = {
  doc: jest.fn(() => mockGroupRef),
};
const mockUsersCollection = {
  doc: jest.fn(() => mockUserRef),
};
const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === "groups") return mockGroupsCollection;
    if (name === "users") return mockUsersCollection;
    throw new Error(`Unexpected collection: ${name}`);
  }),
  runTransaction: mockRunTransaction,
};
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockServerTimestampValue = {_type: "ServerTimestamp"};

class MockHttpsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
  https: {
    onCall: jest.fn((_config: unknown, handler: unknown) => handler),
    HttpsError: MockHttpsError,
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => mockServerTimestampValue),
  },
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => mockDb),
}));

const {createCashboxEntry} = require("../src/cashbox/callable");

describe("createCashboxEntry", () => {
  let defaultTxSet: jest.Mock;
  const groupSnapshot = {
    exists: true,
    data: () => ({owner_id: "user-1", status: "ACTIVE"}),
  };
  const memberSnapshot = {
    exists: true,
    data: () => ({role: "ADMIN", status: "ACTIVE"}),
  };
  const userSnapshot = {
    exists: true,
    data: () => ({name: "Renan"}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    defaultTxSet = jest.fn();
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: {path?: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockUserRef) return userSnapshot;
          if (ref === mockEntryDoc) return mockEntryDoc;
          if (ref === mockSummaryRef) {
            return {
              exists: true,
              data: () => ({
                balance: 10,
                total_income: 10,
                total_expense: 0,
                entry_count: 1,
                truncated: false,
              }),
            };
          }
          if (ref === mockLedgerQuery) {
            return {
              size: 1,
              docs: [{data: () => ({type: "INCOME", amount: 10, status: "ACTIVE"})}],
            };
          }
          throw new Error(`Unexpected tx.get ref: ${ref.path}`);
        }),
        set: defaultTxSet,
      };
      return callback(tx);
    });
  });

  it("cria transação com amount normalizado e atualiza summary em centavos", async () => {
    const result = await createCashboxEntry({
      auth: {
        uid: "user-1",
        token: {name: "Renan", verified: true},
      },
      data: {
        requestId: "cashbox-request-0001",
        groupId: "group-1",
        type: "EXPENSE",
        amount: 0.1 + 0.2,
        description: "Aluguel da bola",
        receiptUrl: "https://example.com/receipt.png",
      },
    });

    expect(result).toEqual({
      entryId: "entry-1",
      balance: 9.7,
      balanceCents: 970,
    });
    expect(defaultTxSet).toHaveBeenCalledTimes(2);
    expect(defaultTxSet).toHaveBeenNthCalledWith(1, mockEntryDoc, expect.objectContaining({
      group_id: "group-1",
      type: "EXPENSE",
      amount: 0.3,
      description: "Aluguel da bola",
      category: "OTHER",
      status: "ACTIVE",
      receipt_url: "https://example.com/receipt.png",
      created_by: "user-1",
      created_by_name: "Renan",
      created_at: mockServerTimestampValue,
    }));
    expect(defaultTxSet).toHaveBeenNthCalledWith(2, mockSummaryRef, expect.objectContaining({
      balance: 9.7,
      total_income: 10,
      total_expense: 0.3,
      entry_count: 2,
      truncated: false,
      recomputed_by_server: true,
      recomputed_at: mockServerTimestampValue,
    }), {merge: true});
  });

  it("rejeita despesa quando saldo disponível não cobre o valor", async () => {
    mockRunTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: {path?: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockUserRef) return userSnapshot;
          if (ref === mockEntryDoc) return mockEntryDoc;
          if (ref === mockSummaryRef) {
            return {
              exists: true,
              data: () => ({
                balance: 100,
                total_income: 100,
                total_expense: 0,
                entry_count: 1,
                truncated: false,
              }),
            };
          }
          if (ref === mockLedgerQuery) {
            return {
              size: 1,
              docs: [{data: () => ({type: "INCOME", amount: 0.2, status: "ACTIVE"})}],
            };
          }
          throw new Error(`Unexpected tx.get ref: ${ref.path}`);
        }),
        set: jest.fn(),
      };
      return callback(tx);
    });

    await expect(createCashboxEntry({
      auth: {
        uid: "user-1",
        token: {name: "Renan", verified: true},
      },
      data: {
        requestId: "cashbox-request-0002",
        groupId: "group-1",
        type: "EXPENSE",
        amount: 0.3,
        description: "Compra",
      },
    })).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Saldo insuficiente para registrar essa saída",
    });
  });

  it("recalcula do ledger completo quando summary antigo está truncado", async () => {
    const txSet = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: {path?: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockUserRef) return userSnapshot;
          if (ref === mockEntryDoc) return mockEntryDoc;
          if (ref === mockSummaryRef) {
            return {
              exists: true,
              data: () => ({
                balance: 1,
                total_income: 1,
                total_expense: 0,
                entry_count: 1,
                truncated: true,
              }),
            };
          }
          if (ref === mockLedgerQuery) {
            return {
              size: 2,
              docs: [
                {data: () => ({type: "INCOME", amount: 5, status: "ACTIVE"})},
                {data: () => ({type: "EXPENSE", amount: 1.25, status: "ACTIVE"})},
              ],
            };
          }
          throw new Error(`Unexpected tx.get ref: ${ref.path}`);
        }),
        set: txSet,
      };
      return callback(tx);
    });

    const result = await createCashboxEntry({
      auth: {
        uid: "user-1",
        token: {name: "Renan", verified: true},
      },
      data: {
        requestId: "cashbox-request-0003",
        groupId: "group-1",
        type: "EXPENSE",
        amount: 3.75,
        description: "Premiação",
      },
    });

    expect(result.balanceCents).toBe(0);
    expect(txSet).toHaveBeenCalledTimes(2);
    expect(txSet).toHaveBeenNthCalledWith(2, mockSummaryRef, expect.objectContaining({
      balance: 0,
      total_income: 5,
      total_expense: 5,
      entry_count: 3,
      truncated: false,
      recomputed_by_server: true,
      recomputed_at: mockServerTimestampValue,
    }), {merge: true});
  });

  it("pagina o ledger além de mil lançamentos sem bloquear o caixa", async () => {
    let ledgerPage = 0;
    mockRunTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        get: jest.fn(async (ref: {path?: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockUserRef) return userSnapshot;
          if (ref === mockEntryDoc) return mockEntryDoc;
          if (ref === mockLedgerQuery) {
            ledgerPage += 1;
            const size = ledgerPage <= 2 ? 500 : 1;
            return {
              size,
              docs: Array.from({length: size}, () => ({
                data: () => ({type: "INCOME", amount: 1, status: "ACTIVE"}),
              })),
            };
          }
          throw new Error(`Unexpected tx.get ref: ${ref.path}`);
        }),
        set: jest.fn(),
      };
      return callback(tx);
    });

    const result = await createCashboxEntry({
      auth: {uid: "user-1", token: {name: "Renan", verified: true}},
      data: {
        requestId: "cashbox-request-1001",
        groupId: "group-1",
        type: "EXPENSE",
        amount: 1,
        description: "Despesa após paginação",
      },
    });

    expect(result.balanceCents).toBe(100000);
    expect(mockCashboxRef.startAfter).toHaveBeenCalledTimes(2);
  });
});
