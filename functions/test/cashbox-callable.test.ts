const mockRunTransaction = jest.fn();
const mockTxSet = jest.fn();
const mockTxUpdate = jest.fn();
const mockEntryRef = {id: "cashbox-request-0001", path: "groups/group-1/cashbox/cashbox-request-0001"};
const mockSummaryRef = {path: "groups/group-1/cashbox_summary/current"};
const mockMemberRef = {path: "groups/group-1/members/user-1", get: jest.fn()};
const mockUserRef = {path: "users/user-1"};
const operationRefs = new Map<string, {path: string}>();
const mockMonthlyPayerRef = {
  path: "groups/group-1/monthly_finance_periods/2026-07/payers/player-1",
};
const mockMonthlySettlementRef = {
  path: "groups/group-1/monthly_finance_periods/2026-07/settlements/monthly-payment-0001",
};
const mockActiveSettlementsQuery = {
  path: "groups/group-1/monthly_finance_periods/2026-07/settlements?active",
  where: jest.fn(() => mockActiveSettlementsQuery),
  orderBy: jest.fn(() => mockActiveSettlementsQuery),
  limit: jest.fn(() => mockActiveSettlementsQuery),
};
const mockMonthlyPeriodRef = {
  path: "groups/group-1/monthly_finance_periods/2026-07",
  collection: jest.fn((name: string) => {
    if (name === "payers") {
      return {doc: jest.fn(() => mockMonthlyPayerRef)};
    }
    if (name === "settlements") {
      return {
        doc: jest.fn(() => mockMonthlySettlementRef),
        where: mockActiveSettlementsQuery.where,
      };
    }
    throw new Error(`Unexpected monthly subcollection: ${name}`);
  }),
};
const mockCashboxRef = {doc: jest.fn(() => mockEntryRef)};
const mockGroupRef = {
  path: "groups/group-1",
  get: jest.fn(),
  collection: jest.fn((name: string) => {
    if (name === "members") return {doc: jest.fn(() => mockMemberRef)};
    if (name === "cashbox_summary") return {doc: jest.fn(() => mockSummaryRef)};
    if (name === "cashbox") return mockCashboxRef;
    if (name === "monthly_finance_periods") {
      return {doc: jest.fn(() => mockMonthlyPeriodRef)};
    }
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

const secureCallableOptions: unknown[] = [];
const mockSecureCallable = jest.fn((options: unknown, handler: unknown) => {
  secureCallableOptions.push(options);
  return handler;
});

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), error: jest.fn()},
  https: {
    onCall: jest.fn((_config: unknown, handler: unknown) => handler),
    HttpsError: MockHttpsError,
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => mockServerTimestamp),
    delete: jest.fn(() => ({_type: "DeleteField"})),
  },
  FieldPath: {documentId: jest.fn(() => "__name__")},
  Timestamp: class MockTimestamp {
    static fromMillis(millis: number) {
      return new MockTimestamp(millis);
    }
    constructor(private readonly millis: number = 0) {}
    toMillis() { return this.millis; }
  },
}));
jest.mock("../src/_db", () => ({db: jest.fn(() => mockDb)}));
jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: mockSecureCallable,
}));

const {
  createCashboxEntry,
  isActiveGroupManager,
  reconcileCashboxSummary,
  voidCashboxEntry,
} = require("../src/cashbox/callable");
const {RATE_LIMITS} = require("../src/middleware/rate-limiter");

const groupSnapshot = {
  exists: true,
  data: () => ({owner_id: "user-1", status: "ACTIVE"}),
};
const memberSnapshot = {
  exists: true,
  data: () => ({user_id: "user-1", role: "ADMIN", status: "ACTIVE"}),
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

  it("estorna mensalidade no caixa, pagador, período e settlement juntos", async () => {
    summaryData = {
      ...summaryData,
      balance: 10.01,
      total_income: 10.01,
      balance_cents: 1001,
      total_income_cents: 1001,
      entry_count: 2,
    };
    const entrySnapshot = {
      exists: true,
      data: () => ({
        type: "INCOME",
        amount: 4,
        amount_cents: 400,
        status: "ACTIVE",
        category: "MONTHLY_FEE",
        request_id: "monthly-payment-0001",
        monthly_period_key: "2026-07",
        monthly_payer_id: "player-1",
        monthly_settlement_path: mockMonthlySettlementRef.path,
        monthly_payment_sequence: 2,
      }),
    };
    const periodSnapshot = {
      exists: true,
      data: () => ({
        status: "CLOSED",
        total_court_cost_cents: 1001,
        received_cents: 1001,
        open_cents: 0,
        settlement_count: 2,
      }),
    };
    const payerSnapshot = {
      exists: true,
      data: () => ({
        user_id: "player-1",
        period_key: "2026-07",
        expected_cents: 1001,
        paid_cents: 1001,
        outstanding_cents: 0,
        payment_count: 2,
        payment_sequence: 2,
        last_payment_entry_id: mockEntryRef.id,
        last_payment_sequence: 2,
      }),
    };
    const settlementSnapshot = {
      exists: true,
      data: () => ({
        status: "ACTIVE",
        request_id: "monthly-payment-0001",
        payer_id: "player-1",
        period_key: "2026-07",
        cashbox_entry_id: mockEntryRef.id,
        amount_cents: 400,
        payment_sequence: 2,
      }),
    };
    const previousPaymentAt = {_type: "Timestamp", millis: 1000};
    const activeSettlementsSnapshot = {
      docs: [
        {
          id: "monthly-payment-0001",
          data: () => settlementSnapshot.data(),
        },
        {
          id: "monthly-payment-previous",
          data: () => ({
            status: "ACTIVE",
            payer_id: "player-1",
            payment_sequence: 1,
            cashbox_entry_id: "monthly_previous-entry",
            created_at: previousPaymentAt,
          }),
        },
      ],
    };
    mockRunTransaction.mockImplementation(async (
      callback: (tx: unknown) => Promise<unknown>
    ) => {
      const tx = {
        get: jest.fn(async (ref: {path: string}) => {
          if (ref === mockGroupRef) return groupSnapshot;
          if (ref === mockMemberRef) return memberSnapshot;
          if (ref === mockEntryRef) return entrySnapshot;
          if (ref === mockSummaryRef) return summarySnapshot;
          if (ref === mockMonthlyPeriodRef) return periodSnapshot;
          if (ref === mockMonthlyPayerRef) return payerSnapshot;
          if (ref === mockMonthlySettlementRef) return settlementSnapshot;
          if (ref === mockActiveSettlementsQuery) {
            return activeSettlementsSnapshot;
          }
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
      data: {groupId: "group-1", entryId: mockEntryRef.id},
    });

    expect(result).toMatchObject({
      balanceCents: 601,
      monthlyReversed: true,
      duplicate: false,
    });
    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockMonthlyPayerRef,
      expect.objectContaining({
        paid_cents: 601,
        outstanding_cents: 400,
        status: "PARTIAL",
        payment_count: 1,
        last_payment_entry_id: "monthly_previous-entry",
        last_payment_sequence: 1,
        last_payment_at: previousPaymentAt,
      })
    );
    const payerUpdate = mockTxUpdate.mock.calls.find(
      ([ref]) => ref === mockMonthlyPayerRef
    )?.[1];
    expect(payerUpdate).not.toHaveProperty("payment_sequence");
    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockMonthlyPeriodRef,
      expect.objectContaining({
        status: "FINALIZED",
        received_cents: 601,
        open_cents: 400,
        settlement_count: 1,
      })
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockMonthlySettlementRef,
      expect.objectContaining({
        status: "VOIDED",
        period_status_after_void: "FINALIZED",
        voided_by: "user-1",
      })
    );
    expect(mockTxSet).toHaveBeenCalledWith(
      mockSummaryRef,
      expect.objectContaining({
        total_income_cents: 601,
        balance_cents: 601,
        entry_count: 1,
      }),
      {merge: true}
    );
  });

  it("devolve o período a DRAFT ao estornar a última baixa ativa", async () => {
    summaryData = {
      ...summaryData,
      balance: 4,
      total_income: 4,
      balance_cents: 400,
      total_income_cents: 400,
      entry_count: 1,
    };
    const entrySnapshot = {
      exists: true,
      data: () => ({
        type: "INCOME",
        amount_cents: 400,
        status: "ACTIVE",
        category: "MONTHLY_FEE",
        request_id: "monthly-payment-0001",
        monthly_period_key: "2026-07",
        monthly_payer_id: "player-1",
        monthly_settlement_path: mockMonthlySettlementRef.path,
        monthly_payment_sequence: 1,
      }),
    };
    const periodSnapshot = {
      exists: true,
      data: () => ({
        status: "FINALIZED",
        total_court_cost_cents: 400,
        received_cents: 400,
        open_cents: 0,
        settlement_count: 1,
      }),
    };
    const payerSnapshot = {
      exists: true,
      data: () => ({
        user_id: "player-1",
        period_key: "2026-07",
        expected_cents: 400,
        paid_cents: 400,
        outstanding_cents: 0,
        payment_count: 1,
        payment_sequence: 1,
        last_payment_entry_id: mockEntryRef.id,
        last_payment_sequence: 1,
      }),
    };
    const settlementSnapshot = {
      exists: true,
      data: () => ({
        status: "ACTIVE",
        request_id: "monthly-payment-0001",
        payer_id: "player-1",
        period_key: "2026-07",
        cashbox_entry_id: mockEntryRef.id,
        amount_cents: 400,
        payment_sequence: 1,
      }),
    };
    const activeSettlementsSnapshot = {
      docs: [{
        id: "monthly-payment-0001",
        data: () => settlementSnapshot.data(),
      }],
    };
    mockRunTransaction.mockImplementation(async (
      callback: (tx: unknown) => Promise<unknown>
    ) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref === mockGroupRef) return groupSnapshot;
        if (ref === mockMemberRef) return memberSnapshot;
        if (ref === mockEntryRef) return entrySnapshot;
        if (ref === mockSummaryRef) return summarySnapshot;
        if (ref === mockMonthlyPeriodRef) return periodSnapshot;
        if (ref === mockMonthlyPayerRef) return payerSnapshot;
        if (ref === mockMonthlySettlementRef) return settlementSnapshot;
        if (ref === mockActiveSettlementsQuery) {
          return activeSettlementsSnapshot;
        }
        if (ref.path.includes("cashbox_summary_ops")) return {exists: false};
        throw new Error(`Unexpected read: ${ref.path}`);
      }),
      set: mockTxSet,
      update: mockTxUpdate,
    }));

    await expect(voidCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {groupId: "group-1", entryId: mockEntryRef.id},
    })).resolves.toMatchObject({monthlyReversed: true, balanceCents: 0});

    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockMonthlyPeriodRef,
      expect.objectContaining({
        status: "DRAFT",
        received_cents: 0,
        open_cents: 400,
        settlement_count: 0,
        finalized_by: {_type: "DeleteField"},
        finalized_at: {_type: "DeleteField"},
      })
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockMonthlySettlementRef,
      expect.objectContaining({
        status: "VOIDED",
        period_status_after_void: "DRAFT",
      })
    );
  });

  it("estorna baixa mensal antiga sem perder o ponteiro da baixa mais nova", async () => {
    summaryData = {
      ...summaryData,
      balance: 10.01,
      total_income: 10.01,
      balance_cents: 1001,
      total_income_cents: 1001,
      entry_count: 2,
    };
    const entrySnapshot = {
      exists: true,
      data: () => ({
        type: "INCOME",
        amount_cents: 400,
        status: "ACTIVE",
        category: "MONTHLY_FEE",
        request_id: "monthly-payment-0001",
        monthly_period_key: "2026-07",
        monthly_payer_id: "player-1",
        monthly_settlement_path: mockMonthlySettlementRef.path,
        monthly_payment_sequence: 1,
      }),
    };
    const periodSnapshot = {
      exists: true,
      data: () => ({
        total_court_cost_cents: 1001,
        received_cents: 1001,
        open_cents: 0,
        settlement_count: 2,
      }),
    };
    const payerSnapshot = {
      exists: true,
      data: () => ({
        user_id: "player-1",
        period_key: "2026-07",
        expected_cents: 1001,
        paid_cents: 1001,
        outstanding_cents: 0,
        payment_count: 2,
        payment_sequence: 2,
        last_payment_entry_id: "monthly_later-entry",
        last_payment_sequence: 2,
      }),
    };
    const settlementSnapshot = {
      exists: true,
      data: () => ({
        status: "ACTIVE",
        request_id: "monthly-payment-0001",
        payer_id: "player-1",
        period_key: "2026-07",
        cashbox_entry_id: mockEntryRef.id,
        amount_cents: 400,
        payment_sequence: 1,
      }),
    };
    const activeSettlementsSnapshot = {
      docs: [
        {
          id: "monthly-payment-0001",
          data: () => settlementSnapshot.data(),
        },
        {
          id: "monthly-payment-later",
          data: () => ({status: "ACTIVE"}),
        },
      ],
    };
    mockRunTransaction.mockImplementation(async (
      callback: (tx: unknown) => Promise<unknown>
    ) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref === mockGroupRef) return groupSnapshot;
        if (ref === mockMemberRef) return memberSnapshot;
        if (ref === mockEntryRef) return entrySnapshot;
        if (ref === mockSummaryRef) return summarySnapshot;
        if (ref === mockMonthlyPeriodRef) return periodSnapshot;
        if (ref === mockMonthlyPayerRef) return payerSnapshot;
        if (ref === mockMonthlySettlementRef) return settlementSnapshot;
        if (ref === mockActiveSettlementsQuery) {
          return activeSettlementsSnapshot;
        }
        if (ref.path.includes("cashbox_summary_ops")) return {exists: false};
        throw new Error(`Unexpected read: ${ref.path}`);
      }),
      set: mockTxSet,
      update: mockTxUpdate,
    }));

    await expect(voidCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {groupId: "group-1", entryId: mockEntryRef.id},
    })).resolves.toMatchObject({monthlyReversed: true, balanceCents: 601});

    const payerUpdate = mockTxUpdate.mock.calls.find(
      ([ref]) => ref === mockMonthlyPayerRef
    )?.[1] as Record<string, unknown>;
    expect(payerUpdate).toMatchObject({
      paid_cents: 601,
      outstanding_cents: 400,
      payment_count: 1,
    });
    expect(payerUpdate).not.toHaveProperty("last_payment_entry_id");
    expect(payerUpdate).not.toHaveProperty("last_payment_sequence");
    expect(payerUpdate).not.toHaveProperty("payment_sequence");
    expect(mockTxUpdate).toHaveBeenCalledWith(
      mockMonthlyPeriodRef,
      expect.objectContaining({status: "FINALIZED", settlement_count: 1})
    );
  });

  it("recusa estorno mensal se o settlement auditável estiver ausente", async () => {
    const entrySnapshot = {
      exists: true,
      data: () => ({
        type: "INCOME",
        amount_cents: 400,
        status: "ACTIVE",
        category: "MONTHLY_FEE",
        request_id: "monthly-payment-0001",
        monthly_period_key: "2026-07",
        monthly_payer_id: "player-1",
        monthly_settlement_path: mockMonthlySettlementRef.path,
      }),
    };
    mockRunTransaction.mockImplementation(async (
      callback: (tx: unknown) => Promise<unknown>
    ) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref === mockGroupRef) return groupSnapshot;
        if (ref === mockMemberRef) return memberSnapshot;
        if (ref === mockEntryRef) return entrySnapshot;
        if (ref === mockSummaryRef) return summarySnapshot;
        if (ref.path.includes("cashbox_summary_ops")) return {exists: false};
        return {exists: false};
      }),
      set: mockTxSet,
      update: mockTxUpdate,
    }));

    await expect(voidCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {groupId: "group-1", entryId: mockEntryRef.id},
    })).rejects.toMatchObject({code: "failed-precondition"});
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("rejeita reutilizar requestId com outra intenção financeira", async () => {
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref === mockGroupRef) return groupSnapshot;
        if (ref === mockMemberRef) return memberSnapshot;
        if (ref === mockUserRef) return userSnapshot;
        if (ref === mockEntryRef) {
          return {
            exists: true,
            data: () => ({
              created_by: "user-1",
              type: "INCOME",
              amount: 10,
              description: "Mensalidade",
              category: "OTHER",
            }),
          };
        }
        if (ref === mockSummaryRef) return summarySnapshot;
        return {exists: false};
      }),
      set: mockTxSet,
    }));

    await expect(createCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {
        requestId: "cashbox-request-0001",
        groupId: "group-1",
        type: "EXPENSE",
        amount: 10,
        description: "Mensalidade",
      },
    })).rejects.toMatchObject({code: "already-exists"});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("não aceita replay que troca jogador ou competência mantendo o mesmo valor", async () => {
    mockRunTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      get: jest.fn(async (ref: {path: string}) => {
        if (ref === mockGroupRef) return groupSnapshot;
        if (ref === mockMemberRef) return memberSnapshot;
        if (ref === mockUserRef) return userSnapshot;
        if (ref === mockEntryRef) {
          return {
            exists: true,
            data: () => ({
              created_by: "user-1",
              type: "INCOME",
              amount: 10,
              description: "Mensalidade",
              category: "MONTHLY_FEE",
              player_id: "player-old",
              player_name: "Jogador",
              reference_date: 1_788_153_600_000,
            }),
          };
        }
        if (ref === mockSummaryRef) return summarySnapshot;
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
        amount: 10,
        description: "Mensalidade",
        category: "MONTHLY_FEE",
        playerId: "player-new",
        playerName: "Jogador",
        referenceDate: 1_788_153_600_000,
      },
    })).rejects.toMatchObject({code: "already-exists"});
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("rejeita paths e metadados opcionais malformados antes da transação", async () => {
    await expect(createCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {
        requestId: "cashbox-request-0001",
        groupId: "group/nested/doc",
        type: "INCOME",
        amount: 10,
        description: "Mensalidade",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(createCashboxEntry({
      auth: {uid: "user-1", token: {verified: true}},
      data: {
        requestId: "cashbox-request-0001",
        groupId: "group-1",
        type: "INCOME",
        amount: 10,
        description: "Mensalidade",
        receiptUrl: "javascript:alert(1)",
      },
    })).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockRunTransaction).not.toHaveBeenCalled();
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

describe("reconcileCashboxSummary — SECFIX #3881", () => {
  it("é envolvida em secureCallable com rate limit dedicado e token não replayável", () => {
    const options = secureCallableOptions.find((option) =>
      (option as {rateLimit?: unknown}).rateLimit === RATE_LIMITS.CASHBOX_RECONCILE);
    expect(options).toMatchObject({
      consumeAppCheckToken: true,
      rateLimit: RATE_LIMITS.CASHBOX_RECONCILE,
    });
  });

  it("nega reconciliação para quem não é admin ativo do grupo, sem varrer o ledger", async () => {
    mockGroupRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({owner_id: "owner", status: "ACTIVE"}),
    });
    mockMemberRef.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({user_id: "user-1", role: "MEMBER", status: "ACTIVE"}),
    });

    await expect(reconcileCashboxSummary({
      auth: {uid: "user-1", token: {}},
      data: {groupId: "group-1"},
    })).rejects.toMatchObject({code: "permission-denied"});

    expect(mockCashboxRef).not.toHaveProperty("orderBy");
  });
});

describe("isActiveGroupManager", () => {
  test("aceita owner canônico mesmo sem membership íntegra", () => {
    expect(isActiveGroupManager(undefined, {owner_id: "user-1"}, "user-1"))
      .toBe(true);
  });

  test("aceita admin ativo somente quando user_id está vinculado ao caller", () => {
    expect(isActiveGroupManager(
      {user_id: "user-1", role: "ADMIN", status: "ACTIVE"},
      {owner_id: "other"},
      "user-1"
    )).toBe(true);
    expect(isActiveGroupManager(
      {user_id: "attacker", role: "ADMIN", status: "ACTIVE"},
      {owner_id: "other"},
      "user-1"
    )).toBe(false);
  });
});

// Cobertura complementar #3881: auditLogContext e mapeamento de erros do catch
// (linhas exigidas pelo diff-coverage gate do CI).
describe("reconcileCashboxSummary — auditLogContext e mapeamento de erros", () => {
  const summaryModule = require("../src/cashbox/summary");
  const {https} = require("firebase-functions/v2");

  const adminGroupSnapshot = {
    exists: true,
    data: () => ({owner_id: "user-1", status: "ACTIVE"}),
  };
  const adminMemberSnapshot = {
    exists: true,
    data: () => ({user_id: "user-1", role: "ADMIN", status: "ACTIVE"}),
  };

  const callAsAdmin = () => {
    mockGroupRef.get.mockResolvedValueOnce(adminGroupSnapshot);
    mockMemberRef.get.mockResolvedValueOnce(adminMemberSnapshot);
    return reconcileCashboxSummary({
      auth: {uid: "user-1", token: {}},
      data: {groupId: "group-1"},
    });
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("auditLogContext extrai group_id do payload e tolera payload invalido", async () => {
    const options = secureCallableOptions.find((option) =>
      (option as {rateLimit?: unknown}).rateLimit ===
        RATE_LIMITS.CASHBOX_RECONCILE) as {
      auditLogContext: (req: unknown) => Promise<Record<string, unknown>>;
    };
    await expect(options.auditLogContext({data: {groupId: "group-1"}}))
      .resolves.toEqual({
        action: "reconcile_cashbox_summary",
        group_id: "group-1",
      });
    await expect(options.auditLogContext({data: null}))
      .resolves.toEqual({
        action: "reconcile_cashbox_summary",
        group_id: null,
      });
  });

  it("mapeia ledger grande demais para resource-exhausted", async () => {
    jest.spyOn(summaryModule, "reconcileCashboxSummaryForGroup")
      .mockRejectedValueOnce(
        new Error(summaryModule.CASHBOX_LEDGER_SCAN_LIMIT_EXCEEDED));
    await expect(callAsAdmin())
      .rejects.toMatchObject({code: "resource-exhausted"});
  });

  it("mapeia conflito de CAS para aborted", async () => {
    jest.spyOn(summaryModule, "reconcileCashboxSummaryForGroup")
      .mockRejectedValueOnce(new Error("CASHBOX_RECONCILIATION_CONFLICT"));
    await expect(callAsAdmin())
      .rejects.toMatchObject({code: "aborted"});
  });

  it("mapeia erro desconhecido para internal", async () => {
    jest.spyOn(summaryModule, "reconcileCashboxSummaryForGroup")
      .mockRejectedValueOnce(new Error("boom"));
    await expect(callAsAdmin())
      .rejects.toMatchObject({code: "internal"});
  });

  it("re-lanca HttpsError interno sem mascarar o codigo", async () => {
    jest.spyOn(summaryModule, "reconcileCashboxSummaryForGroup")
      .mockRejectedValueOnce(
        new https.HttpsError("failed-precondition", "Grupo indisponível"));
    await expect(callAsAdmin())
      .rejects.toMatchObject({code: "failed-precondition"});
  });
});
