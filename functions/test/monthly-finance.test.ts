const mockServerTimestamp = {_type: "ServerTimestamp"};
const mockRunTransaction = jest.fn();
const secureCallableOptions: unknown[] = [];
const mockSecureCallable = jest.fn((options: unknown, handler: unknown) => {
  secureCallableOptions.push(options);
  return handler;
});
const mockDb = {
  collection: jest.fn(),
  runTransaction: mockRunTransaction,
};
const mockIsActiveGroupManager = jest.fn((
  member: Record<string, unknown> | undefined,
  group: Record<string, unknown> | undefined,
  userId: string
) => group?.owner_id === userId || (
  member?.user_id === userId &&
  member?.status === "ACTIVE" &&
  (member?.role === "OWNER" || member?.role === "ADMIN")
));

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
  FieldPath: {documentId: jest.fn(() => "__name__")},
  FieldValue: {serverTimestamp: jest.fn(() => mockServerTimestamp)},
  Timestamp: class MockTimestamp {
    constructor(private readonly millis: number) {}
    toMillis() { return this.millis; }
  },
}));
jest.mock("../src/_db", () => ({db: jest.fn(() => mockDb)}));
jest.mock("../src/cashbox/callable", () => ({
  isActiveGroupManager: mockIsActiveGroupManager,
}));
jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: mockSecureCallable,
}));

const {
  allocateMonthlyCents,
  assessMonthlyCycleRebuild,
  buildMonthlyCalendar,
  calculateMonthlyPeriod,
  calculateMonthlySettlement,
  configureMonthlyFinance,
  currentPeriodInSaoPaulo,
  expandScheduleDates,
  isMonthlyRosterEligible,
  isSameMonthlySettlementOperation,
  rebuildMonthlyCycle,
  setMonthlyGameOverride,
  setMonthlyMember,
  settleMonthlyCharge,
} = require("../src/cashbox/monthly");

interface FakeRef {
  id: string;
  path: string;
  collection: (name: string) => FakeCollection;
}

interface FakeCollection {
  kind: "query";
  path: string;
  doc: (id: string) => FakeRef;
  filters: Array<{field: string; op: string; value: unknown}>;
  orders: Array<{field: string; direction: string}>;
  limitCount: number | null;
  where: (field: string, op: string, value: unknown) => FakeCollection;
  orderBy: (field: string, direction?: string) => FakeCollection;
  limit: (count: number) => FakeCollection;
}

const fakeCollection = (
  path: string,
  filters: FakeCollection["filters"] = [],
  orders: FakeCollection["orders"] = [],
  limitCount: number | null = null
): FakeCollection => ({
  kind: "query",
  path,
  filters,
  orders,
  limitCount,
  doc: (id: string) => fakeRef(`${path}/${id}`),
  where: (field: string, op: string, value: unknown) =>
    fakeCollection(path, [...filters, {field, op, value}], orders, limitCount),
  orderBy: (field: string, direction = "asc") =>
    fakeCollection(path, filters, [...orders, {field, direction}], limitCount),
  limit: (count: number) => fakeCollection(path, filters, orders, count),
});

const fakeRef = (path: string): FakeRef => ({
  id: path.split("/").pop() || "",
  path,
  collection: (name: string) => fakeCollection(`${path}/${name}`),
});

const gamesForMonth = (count: number, cost = 30000) =>
  Array.from({length: count}, (_value, index) => ({
    id: `game-${index + 1}`,
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    status: "SCHEDULED",
    courtCostCents: cost,
  }));

describe("segurança dos callables financeiros mensais", () => {
  it("usa secureCallable, App Check anti-replay, rate limit e audit context", async () => {
    expect(secureCallableOptions).toHaveLength(5);
    const options = secureCallableOptions.map((config) =>
      config as {
        consumeAppCheckToken?: boolean;
        rateLimit?: {keyPrefix?: string};
        auditLogContext?: (request: unknown) => Promise<Record<string, unknown>>;
      }
    );

    expect(options.every((config) =>
      config.consumeAppCheckToken === true &&
      typeof config.auditLogContext === "function"
    )).toBe(true);
    expect(options.map((config) => config.rateLimit?.keyPrefix)).toEqual([
      "finance_manage",
      "finance_manage",
      "finance_rebuild",
      "finance_manage",
      "finance_settle",
    ]);
    await expect(options[4].auditLogContext?.({
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        targetUserId: "payer-1",
        requestId: "request-12345678",
      },
    })).resolves.toMatchObject({
      action: "settle_monthly_charge",
      group_id: "group-1",
      period_key: "2026-07",
      target_user_id: "payer-1",
      client_request_id: "request-12345678",
    });
  });
});

describe("calculadora financeira mensal", () => {
  test.each([3, 4, 5])(
    "FIXED_MONTHLY mantém o total com %i jogos",
    (gameCount: number) => {
      const result = calculateMonthlyPeriod({
        periodKey: "2026-07",
        pricingMode: "FIXED_MONTHLY",
        fixedMonthlyCostCents: 120001,
        monthlyMemberIds: ["user-c", "user-a", "user-b"],
        groupMemberCount: 9,
        games: gamesForMonth(gameCount),
      });

      expect(result.totalCourtCostCents).toBe(120001);
      expect(result.gameCount).toBe(gameCount);
      expect(result.groupMemberCount).toBe(9);
      expect(result.monthlyMemberCount).toBe(3);
      expect(result.charges).toEqual([
        {userId: "user-a", expectedCents: 40001},
        {userId: "user-b", expectedCents: 40000},
        {userId: "user-c", expectedCents: 40000},
      ]);
      expect(result.charges.reduce(
        (sum: number, charge: {expectedCents: number}) =>
          sum + charge.expectedCents,
        0
      )).toBe(120001);
    }
  );

  it("PER_GAME exclui cancelado e exceção explícita sem inferir feriados", () => {
    const result = calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "PER_GAME",
      defaultGameCostCents: 10000,
      monthlyMemberIds: ["monthly-1", "monthly-2"],
      groupMemberCount: 8,
      games: [
        ...gamesForMonth(3, 10000),
        {
          id: "cancelled",
          date: "2026-07-10",
          status: "CANCELLED",
          courtCostCents: 90000,
        },
        {
          id: "holiday-exception",
          date: "2026-07-11",
          status: "SCHEDULED",
          courtCostCents: 80000,
          explicitlyExcluded: true,
        },
      ],
    });

    expect(result.totalCourtCostCents).toBe(30000);
    expect(result.gameCount).toBe(3);
    expect(result.excludedGameCount).toBe(2);
    expect(result.games.find(
      (game: {id: string}) => game.id === "cancelled"
    )?.exclusionReason).toBe("CANCELLED_OR_DELETED");
    expect(result.games.find(
      (game: {id: string}) => game.id === "holiday-exception"
    )?.exclusionReason).toBe("EXPLICIT_EXCLUSION");
  });

  it("PER_GAME aceita custos explícitos sem exigir custo padrão", () => {
    const result = calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "PER_GAME",
      monthlyMemberIds: ["m1"],
      groupMemberCount: 1,
      games: gamesForMonth(3, 1234),
    });
    expect(result.totalCourtCostCents).toBe(3702);
  });

  it("usa a competência civil de São Paulo na virada UTC", () => {
    expect(currentPeriodInSaoPaulo(new Date("2026-08-01T01:30:00.000Z")))
      .toBe("2026-07");
  });

  test.each([
    {periodKey: "2026-07", anchorDate: "2026-07-15", dayOfWeek: 3, expected: 3},
    {periodKey: "2026-02", anchorDate: "2026-02-01", dayOfWeek: 0, expected: 4},
    {periodKey: "2026-03", anchorDate: "2026-03-01", dayOfWeek: 0, expected: 5},
  ])(
    "expande schedule semanal em $expected semanas do mês",
    ({periodKey, anchorDate, dayOfWeek, expected}: {
      periodKey: string;
      anchorDate: string;
      dayOfWeek: number;
      expected: number;
    }) => {
      expect(expandScheduleDates({
        id: "schedule-1",
        active: true,
        recurrenceType: "weekly",
        dayOfWeek,
        anchorDate,
        exceptions: [],
      }, periodKey)).toHaveLength(expected);
    }
  );

  it("respeita cadências quinzenal e mensal ancoradas", () => {
    expect(expandScheduleDates({
      id: "schedule-biweekly",
      active: true,
      recurrenceType: "biweekly",
      dayOfWeek: 3,
      anchorDate: "2026-07-01",
      exceptions: [],
    }, "2026-07")).toEqual([
      "2026-07-01",
      "2026-07-15",
      "2026-07-29",
    ]);
    expect(expandScheduleDates({
      id: "schedule-monthly",
      active: true,
      recurrenceType: "monthly",
      dayOfWeek: 3,
      anchorDate: "2026-06-10",
      exceptions: [],
    }, "2026-07")).toEqual(["2026-07-08"]);
  });

  it("mantém feriado no calendário, mas o exclui do rateio", () => {
    const games = buildMonthlyCalendar({
      periodKey: "2026-03",
      games: [],
      schedules: [{
        id: "schedule-1",
        active: true,
        recurrenceType: "weekly",
        dayOfWeek: 0,
        anchorDate: "2026-03-01",
        exceptions: ["2026-03-15"],
        courtCostCents: 10000,
        label: "Domingo",
      }],
    });
    const result = calculateMonthlyPeriod({
      periodKey: "2026-03",
      pricingMode: "PER_GAME",
      monthlyMemberIds: ["payer"],
      groupMemberCount: 1,
      games,
    });
    expect(result.games).toHaveLength(5);
    expect(result.gameCount).toBe(4);
    expect(result.totalCourtCostCents).toBe(40000);
    expect(result.games.find((game: {date: string}) =>
      game.date === "2026-03-15"
    )).toMatchObject({included: false, source: "SCHEDULE"});

    const holidayId = games.find((game: {date: string}) =>
      game.date === "2026-03-15"
    )?.id as string;
    const manuallyIncluded = buildMonthlyCalendar({
      periodKey: "2026-03",
      games: [],
      schedules: [{
        id: "schedule-1",
        active: true,
        recurrenceType: "weekly",
        dayOfWeek: 0,
        anchorDate: "2026-03-01",
        exceptions: ["2026-03-15"],
        courtCostCents: 10000,
      }],
      overrides: new Map([[holidayId, {
        excluded: false,
        costCents: null,
        reason: "Haverá jogo",
      }]]),
    });
    expect(calculateMonthlyPeriod({
      periodKey: "2026-03",
      pricingMode: "PER_GAME",
      monthlyMemberIds: ["payer"],
      groupMemberCount: 1,
      games: manuallyIncluded,
    }).gameCount).toBe(5);
  });

  it("projeta série semanal ainda não materializada e deduplica o jogo real", () => {
    const source = {
      id: "root-game",
      gameId: "root-game",
      date: "2026-06-24",
      status: "FINISHED",
      courtCostCents: 12000,
      recurrence: "weekly",
      recurrenceIndex: 1,
      recurrenceCount: 10,
      seriesId: "root-game",
      label: "Série quarta",
    };
    const planned = buildMonthlyCalendar({
      periodKey: "2026-07",
      games: [source],
      schedules: [],
    });
    expect(planned.map((game: {date: string}) => game.date)).toEqual([
      "2026-07-01",
      "2026-07-08",
      "2026-07-15",
      "2026-07-22",
      "2026-07-29",
    ]);

    const withMaterialized = buildMonthlyCalendar({
      periodKey: "2026-07",
      games: [source, {
        ...source,
        id: "child-game",
        gameId: "child-game",
        date: "2026-07-08",
        status: "SCHEDULED",
        recurrenceIndex: 3,
      }],
      schedules: [],
    });
    expect(withMaterialized).toHaveLength(5);
    expect(withMaterialized.find((game: {date: string}) =>
      game.date === "2026-07-08"
    )).toMatchObject({gameId: "child-game", source: "RECURRENCE"});
  });

  it("aplica custo por ocorrência sem perder o total em centavos", () => {
    const base = buildMonthlyCalendar({
      periodKey: "2026-02",
      games: [],
      schedules: [{
        id: "schedule-cost",
        active: true,
        recurrenceType: "weekly",
        dayOfWeek: 0,
        anchorDate: "2026-02-01",
        exceptions: [],
        courtCostCents: 10000,
      }],
    });
    const occurrenceId = base[0].id;
    const overridden = buildMonthlyCalendar({
      periodKey: "2026-02",
      games: [],
      schedules: [{
        id: "schedule-cost",
        active: true,
        recurrenceType: "weekly",
        dayOfWeek: 0,
        anchorDate: "2026-02-01",
        exceptions: [],
        courtCostCents: 10000,
      }],
      overrides: new Map([[occurrenceId, {
        excluded: false,
        costCents: 15001,
        reason: "Preço especial",
      }]]),
    });
    const result = calculateMonthlyPeriod({
      periodKey: "2026-02",
      pricingMode: "PER_GAME",
      monthlyMemberIds: ["payer-a", "payer-b"],
      groupMemberCount: 2,
      games: overridden,
    });
    expect(result.totalCourtCostCents).toBe(45001);
    expect(result.charges.reduce((sum: number, charge: {expectedCents: number}) =>
      sum + charge.expectedCents, 0
    )).toBe(45001);
    expect(result.games[0].manualOverride).toMatchObject({costCents: 15001});
  });

  it("rateia o resto em centavos por UIDs ordenados", () => {
    expect([...allocateMonthlyCents(100, ["c", "a", "b"]).entries()])
      .toEqual([["a", 34], ["b", 33], ["c", 33]]);
  });

  it("preserva a soma e diferença máxima de um centavo para 1..200 mensalistas", () => {
    for (let memberCount = 1; memberCount <= 200; memberCount += 1) {
      const totalCents = (memberCount * 7919) + 137;
      const ids = Array.from(
        {length: memberCount},
        (_value, index) => `payer-${String(index).padStart(3, "0")}`
      );
      const shares = [...allocateMonthlyCents(totalCents, ids).values()];
      expect(shares.reduce((sum, share) => sum + share, 0)).toBe(totalCents);
      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1);
    }
  });

  it("permite mais membros no grupo do que mensalistas", () => {
    const result = calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "FIXED_MONTHLY",
      fixedMonthlyCostCents: 90000,
      monthlyMemberIds: ["m1", "m2", "m3"],
      groupMemberCount: 12,
      games: gamesForMonth(4),
    });
    expect(result.groupMemberCount).toBe(12);
    expect(result.monthlyMemberCount).toBe(3);
    expect(result.charges.map(
      (charge: {expectedCents: number}) => charge.expectedCents
    )).toEqual([30000, 30000, 30000]);
  });

  it("rejeita período com custo e zero mensalistas", () => {
    expect(() => calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "FIXED_MONTHLY",
      fixedMonthlyCostCents: 90000,
      monthlyMemberIds: [],
      groupMemberCount: 10,
      games: gamesForMonth(4),
    })).toThrow(/Não há mensalistas ativos/);
  });

  it("não cobra contrato positivo sem nenhum jogo incluído", () => {
    expect(() => calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "FIXED_MONTHLY",
      fixedMonthlyCostCents: 90000,
      monthlyMemberIds: ["m1"],
      groupMemberCount: 1,
      games: [],
    })).toThrow(/Não há jogos incluídos/);
  });

  it("rejeita dinheiro fracionário, IDs duplicados, data e custo ausente", () => {
    expect(() => calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "FIXED_MONTHLY",
      fixedMonthlyCostCents: 10.5,
      monthlyMemberIds: ["m1"],
      groupMemberCount: 1,
      games: [],
    })).toThrow(/inteiro/);
    expect(() => allocateMonthlyCents(10, ["m1", "m1"]))
      .toThrow(/únicos/);
    expect(() => calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "PER_GAME",
      monthlyMemberIds: ["m1"],
      groupMemberCount: 1,
      games: [{
        id: "g1",
        date: "2026-07-32",
        status: "SCHEDULED",
      }],
    })).toThrow(/Data/);
    expect(() => calculateMonthlyPeriod({
      periodKey: "2026-07",
      pricingMode: "PER_GAME",
      monthlyMemberIds: ["m1"],
      groupMemberCount: 1,
      games: [{id: "g1", date: "2026-07-10", status: "SCHEDULED"}],
    })).toThrow(/não tem courtCostCents/);
  });

  it("respeita effective_from/effective_to do roster", () => {
    expect(isMonthlyRosterEligible({
      active: true,
      effective_from: "2026-07-02",
      effective_to: null,
    }, "2026-07")).toBe(true);
    expect(isMonthlyRosterEligible({
      active: true,
      effective_from: "2026-08-01",
      effective_to: null,
    }, "2026-07")).toBe(false);
    expect(isMonthlyRosterEligible({
      active: false,
      effective_from: "2026-05-01",
      effective_to: "2026-07-15",
    }, "2026-07")).toBe(false);
    expect(isMonthlyRosterEligible({
      active: false,
      effective_from: "2026-05-01",
      effective_to: "2026-08-01",
    }, "2026-07")).toBe(true);
    expect(isMonthlyRosterEligible({
      active: false,
      effective_from: "2026-05-01",
      effective_to: "2026-06-30",
    }, "2026-07")).toBe(false);
  });
});

describe("lock, replay e baixa mensal", () => {
  it("só altera DRAFT sem baixas e aceita replay idêntico", () => {
    expect(assessMonthlyCycleRebuild(undefined, "hash-1", false))
      .toBe("CREATE");
    expect(assessMonthlyCycleRebuild({
      status: "DRAFT",
      calculation_hash: "hash-1",
    }, "hash-1", true)).toBe("REPLAY");
    expect(assessMonthlyCycleRebuild({
      status: "DRAFT",
      calculation_hash: "hash-old",
    }, "hash-new", false)).toBe("REBUILD");
    expect(assessMonthlyCycleRebuild({
      status: "DRAFT",
      calculation_hash: "hash-old",
    }, "hash-new", true)).toBe("LOCKED");
    expect(assessMonthlyCycleRebuild({
      status: "FINALIZED",
      calculation_hash: "hash-old",
    }, "hash-new", false)).toBe("LOCKED");
  });

  it("calcula baixa parcial e depois quitação integral", () => {
    expect(calculateMonthlySettlement(1001, 0, 400)).toEqual({
      amountCents: 400,
      paidCents: 400,
      outstandingCents: 601,
      status: "PARTIAL",
    });
    expect(calculateMonthlySettlement(1001, 400)).toEqual({
      amountCents: 601,
      paidCents: 1001,
      outstandingCents: 0,
      status: "PAID",
    });
    expect(() => calculateMonthlySettlement(1001, 400, 602))
      .toThrow(/saldo/);
  });

  it("compara a intenção completa do marcador idempotente", () => {
    const operation = {
      created_by: "owner",
      target_user_id: "payer",
      period_key: "2026-07",
      requested_amount_cents: null,
    };
    expect(isSameMonthlySettlementOperation(operation, {
      userId: "owner",
      targetUserId: "payer",
      periodKey: "2026-07",
      requestedAmountCents: null,
    })).toBe(true);
    expect(isSameMonthlySettlementOperation(operation, {
      userId: "owner",
      targetUserId: "other",
      periodKey: "2026-07",
      requestedAmountCents: null,
    })).toBe(false);
  });
});

describe("callables financeiros mensais", () => {
  let state: Map<string, Record<string, unknown>>;
  let writeCount: number;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-11T12:00:00.000Z"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    state = new Map();
    writeCount = 0;
    mockDb.collection.mockImplementation((name: string) => fakeCollection(name));
    mockRunTransaction.mockImplementation(async (
      handler: (transaction: Record<string, unknown>) => Promise<unknown>
    ) => handler({
      get: jest.fn(async (target: FakeRef | FakeCollection) => {
        if ((target as FakeCollection).kind !== "query") {
          const ref = target as FakeRef;
          return {
            id: ref.id,
            ref,
            exists: state.has(ref.path),
            data: () => state.get(ref.path),
          };
        }
        const query = target as FakeCollection;
        const prefix = `${query.path}/`;
        let docs = [...state.entries()]
          .filter(([path]) => path.startsWith(prefix) &&
            !path.slice(prefix.length).includes("/"))
          .map(([path, data]) => {
            const ref = fakeRef(path);
            return {id: ref.id, ref, exists: true, data: () => data};
          });
        docs = docs.filter((doc) => query.filters.every((filter) => {
          const data = doc.data();
          const actual = filter.field === "__name__" ?
            doc.id : data[filter.field];
          if (filter.op === "==") return actual === filter.value;
          if (filter.op === ">=") return actual >= filter.value;
          if (filter.op === "<") return actual < filter.value;
          if (filter.op === "in") {
            return Array.isArray(filter.value) && filter.value.includes(actual);
          }
          return false;
        }));
        docs.sort((left, right) => {
          for (const order of query.orders) {
            const leftValue = order.field === "__name__" ?
              left.id : left.data()[order.field];
            const rightValue = order.field === "__name__" ?
              right.id : right.data()[order.field];
            const comparison = leftValue === rightValue ? 0 :
              leftValue < rightValue ? -1 : 1;
            if (comparison !== 0) {
              return order.direction.toLowerCase() === "desc" ?
                -comparison : comparison;
            }
          }
          return left.id.localeCompare(right.id);
        });
        if (query.limitCount != null) docs = docs.slice(0, query.limitCount);
        return {docs, size: docs.length, empty: docs.length === 0};
      }),
      set: jest.fn((
        ref: FakeRef,
        data: Record<string, unknown>,
        options?: {merge?: boolean}
      ) => {
        writeCount += 1;
        state.set(ref.path, options?.merge ? {
          ...(state.get(ref.path) || {}),
          ...data,
        } : {...data});
      }),
      update: jest.fn((ref: FakeRef, data: Record<string, unknown>) => {
        writeCount += 1;
        state.set(ref.path, {...(state.get(ref.path) || {}), ...data});
      }),
    }));
  });

  it("nega admin com membership cujo user_id não corresponde ao caller", async () => {
    state.set("groups/group-1", {owner_id: "another-owner", status: "ACTIVE"});
    state.set("groups/group-1/members/caller", {
      user_id: "victim",
      role: "ADMIN",
      status: "ACTIVE",
    });

    await expect(configureMonthlyFinance({
      auth: {uid: "caller", token: {}},
      data: {
        groupId: "group-1",
        pricingMode: "FIXED_MONTHLY",
        fixedMonthlyCostCents: 100000,
      },
    })).rejects.toMatchObject({code: "permission-denied"});
    expect(writeCount).toBe(0);
  });

  it("valida configuração em centavos e aceita owner sem membership", async () => {
    state.set("groups/group-1", {owner_id: "owner", status: "ACTIVE"});
    await expect(configureMonthlyFinance({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        pricingMode: "FIXED_MONTHLY",
        fixedMonthlyCostCents: 1000.5,
      },
    })).rejects.toMatchObject({code: "invalid-argument"});

    const result = await configureMonthlyFinance({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        pricingMode: "FIXED_MONTHLY",
        fixedMonthlyCostCents: 100000,
      },
    });
    expect(result).toMatchObject({revision: 1, duplicate: false});
    expect(state.get("groups/group-1/monthly_finance_config/current"))
      .toMatchObject({
        pricing_mode: "FIXED_MONTHLY",
        fixed_monthly_cost_cents: 100000,
        default_game_cost_cents: null,
      });
  });

  it("só inclui target com membership ACTIVE e identidade íntegra", async () => {
    state.set("groups/group-1", {owner_id: "owner", status: "ACTIVE"});
    state.set("groups/group-1/monthly_finance_config/current", {
      pricing_mode: "FIXED_MONTHLY",
      revision: 1,
      roster_revision: 0,
    });
    state.set("groups/group-1/members/player-1", {
      user_id: "another-user",
      status: "ACTIVE",
    });
    await expect(setMonthlyMember({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", targetUserId: "player-1", isMonthly: true},
    })).rejects.toMatchObject({code: "failed-precondition"});

    state.set("groups/group-1/members/player-1", {
      user_id: "player-1",
      status: "ACTIVE",
      display_name: "Jogadora",
    });
    const result = await setMonthlyMember({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", targetUserId: "player-1", isMonthly: true},
    });
    expect(result).toMatchObject({
      targetUserId: "player-1",
      isMonthly: true,
      revision: 1,
      rosterRevision: 1,
      duplicate: false,
    });
    expect(state.get("groups/group-1/monthly_member_roster/player-1"))
      .toMatchObject({user_id: "player-1", active: true, revision: 1});
    expect(state.get("groups/group-1/monthly_finance_config/current"))
      .toMatchObject({revision: 1, roster_revision: 1});

    state.set("groups/group-1/members/player-1", {
      user_id: "player-1",
      status: "INACTIVE",
    });
    const removed = await setMonthlyMember({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", targetUserId: "player-1", isMonthly: false},
    });
    expect(removed).toMatchObject({
      targetUserId: "player-1",
      isMonthly: false,
      rosterRevision: 2,
      duplicate: false,
    });
    expect(state.get("groups/group-1/monthly_member_roster/player-1"))
      .toMatchObject({active: false, revision: 2});
  });

  it("bloqueia alterações da configuração e roster no mês atual fechado", async () => {
    state.set("groups/group-1", {owner_id: "owner", status: "ACTIVE"});
    state.set("groups/group-1/monthly_finance_config/current", {
      pricing_mode: "FIXED_MONTHLY",
      fixed_monthly_cost_cents: 100000,
      default_game_cost_cents: null,
      revision: 2,
      roster_revision: 5,
    });
    state.set("groups/group-1/monthly_finance_periods/2026-07", {
      period_key: "2026-07",
      status: "FINALIZED",
    });
    state.set("groups/group-1/members/player-1", {
      user_id: "player-1",
      status: "ACTIVE",
    });

    await expect(configureMonthlyFinance({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        pricingMode: "FIXED_MONTHLY",
        fixedMonthlyCostCents: 120000,
      },
    })).rejects.toMatchObject({code: "failed-precondition"});
    await expect(setMonthlyMember({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", targetUserId: "player-1", isMonthly: true},
    })).rejects.toMatchObject({code: "failed-precondition"});
    expect(state.get("groups/group-1/monthly_finance_config/current"))
      .toMatchObject({revision: 2, roster_revision: 5});
  });

  it("rebuild salva revisões, projeta série e override recalcula com replay", async () => {
    state.set("groups/group-1", {owner_id: "owner", status: "ACTIVE"});
    state.set("groups/group-1/monthly_finance_config/current", {
      pricing_mode: "PER_GAME",
      fixed_monthly_cost_cents: null,
      default_game_cost_cents: 10000,
      revision: 3,
      roster_revision: 6,
    });
    state.set("groups/group-1/members/payer-1", {
      user_id: "payer-1",
      status: "ACTIVE",
      display_name: "Mensalista",
    });
    state.set("groups/group-1/monthly_member_roster/payer-1", {
      user_id: "payer-1",
      active: true,
      effective_from_period: "2026-01",
    });
    state.set("games/root-game", {
      group_id: "group-1",
      date: "2026-06-24",
      status: "FINISHED",
      recurrence: "weekly",
      recurrence_index: 1,
      recurrence_count: 10,
      court_cost_cents: 10000,
      name: "Quarta recorrente",
    });

    const rebuilt = await rebuildMonthlyCycle({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", periodKey: "2026-07"},
    });
    expect(rebuilt).toMatchObject({
      totalCourtCostCents: 50000,
      gameCount: 5,
      monthlyMemberCount: 1,
      duplicate: false,
    });
    const periodPath = "groups/group-1/monthly_finance_periods/2026-07";
    const period = state.get(periodPath) || {};
    expect(period).toMatchObject({
      config_revision: 3,
      roster_revision: 6,
      total_court_cost_cents: 50000,
      game_count: 5,
    });
    const snapshot = period.game_snapshot as Array<Record<string, unknown>>;
    expect(snapshot).toHaveLength(5);
    expect(snapshot[0]).toMatchObject({
      source: "RECURRENCE",
      label: "Quarta recorrente",
      manual_override: null,
    });

    const occurrenceId = snapshot[0].id as string;
    const overridden = await setMonthlyGameOverride({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        occurrenceId,
        excluded: false,
        costCents: 15001,
        reason: "OTHER",
      },
    });
    expect(overridden).toMatchObject({
      totalCourtCostCents: 55001,
      gameCount: 5,
      duplicate: false,
    });
    const writesAfterOverride = writeCount;
    const replay = await setMonthlyGameOverride({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        occurrenceId,
        excluded: false,
        costCents: 15001,
        reason: "OTHER",
      },
    });
    expect(replay).toMatchObject({duplicate: true});
    expect(writeCount).toBe(writesAfterOverride);
    expect(state.get(
      `${periodPath}/payers/payer-1`
    )).toMatchObject({expected_cents: 55001, outstanding_cents: 55001});
    const rebuiltAgain = await rebuildMonthlyCycle({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", periodKey: "2026-07"},
    });
    expect(rebuiltAgain).toMatchObject({
      totalCourtCostCents: 55001,
      duplicate: true,
    });
    const preservedSnapshot = (state.get(periodPath)?.game_snapshot ?? []) as
      Array<Record<string, unknown>>;
    expect(preservedSnapshot.find((game) => game.id === occurrenceId))
      .toMatchObject({
        manual_override: {
          excluded: false,
          cost_cents: 15001,
          reason: null,
        },
      });
    const overrideAudit = state.get(periodPath)?.override_audit as
      Record<string, Record<string, unknown>>;
    expect(Object.values(overrideAudit)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        occurrence_id: occurrenceId,
        reason: null,
      }),
    ]));
    state.set(periodPath, {...(state.get(periodPath) || {}), status: "FINALIZED"});
    await expect(rebuildMonthlyCycle({
      auth: {uid: "owner", token: {}},
      data: {groupId: "group-1", periodKey: "2026-07"},
    })).rejects.toMatchObject({code: "failed-precondition"});
    await expect(setMonthlyGameOverride({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        occurrenceId,
        excluded: true,
        reason: "HOLIDAY",
      },
    })).rejects.toMatchObject({code: "failed-precondition"});
  });

  it("rejeita baixa quando config/roster mudaram após o rebuild", async () => {
    state.set("groups/group-1", {owner_id: "owner", status: "ACTIVE"});
    state.set("groups/group-1/monthly_finance_config/current", {
      revision: 8,
      roster_revision: 2,
    });
    state.set("groups/group-1/monthly_finance_periods/2026-07", {
      period_key: "2026-07",
      status: "DRAFT",
      calculation_hash: "period-hash",
      config_revision: 7,
      roster_revision: 2,
      total_court_cost_cents: 1000,
      received_cents: 0,
      open_cents: 1000,
      settlement_count: 0,
    });
    state.set(
      "groups/group-1/monthly_finance_periods/2026-07/payers/payer-1",
      {
        user_id: "payer-1",
        period_key: "2026-07",
        calculation_hash: "period-hash",
        active: true,
        expected_cents: 1000,
        paid_cents: 0,
        outstanding_cents: 1000,
        status: "PENDING",
      }
    );
    state.set("groups/group-1/cashbox_summary/current", {
      recomputed_by_server: true,
      truncated: false,
      total_income_cents: 0,
      total_expense_cents: 0,
      entry_count: 0,
      ledger_version: 0,
      last_entry_at: null,
    });
    await expect(settleMonthlyCharge({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        targetUserId: "payer-1",
        requestId: "monthly-stale-0001",
      },
    })).rejects.toMatchObject({code: "failed-precondition"});
    expect(state.has(
      "groups/group-1/cashbox/monthly_monthly-stale-0001"
    )).toBe(false);
    state.set("groups/group-1/monthly_finance_config/current", {
      revision: 7,
      roster_revision: 3,
    });
    await expect(settleMonthlyCharge({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        targetUserId: "payer-1",
        requestId: "monthly-stale-0002",
      },
    })).rejects.toMatchObject({code: "failed-precondition"});
    state.set("groups/group-1/monthly_finance_config/current", {
      revision: 99,
      revision_effective_period: "2026-08",
      roster_revision: 99,
      roster_revision_effective_period: "2026-08",
    });
    await expect(settleMonthlyCharge({
      auth: {uid: "owner", token: {}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        targetUserId: "payer-1",
        requestId: "monthly-stale-0003",
        amountCents: 100,
      },
    })).resolves.toMatchObject({amountCents: 100, duplicate: false});
  });

  it("liquida parcial/integral e torna o retry idempotente", async () => {
    state.set("groups/group-1", {owner_id: "owner", status: "ACTIVE"});
    state.set("groups/group-1/monthly_finance_config/current", {
      pricing_mode: "FIXED_MONTHLY",
      revision: 4,
      roster_revision: 7,
    });
    state.set("groups/group-1/monthly_finance_periods/2026-07", {
      period_key: "2026-07",
      status: "DRAFT",
      calculation_hash: "period-hash",
      total_court_cost_cents: 1001,
      received_cents: 0,
      open_cents: 1001,
      settlement_count: 0,
      config_revision: 4,
      roster_revision: 7,
    });
    state.set(
      "groups/group-1/monthly_finance_periods/2026-07/payers/payer-1",
      {
        user_id: "payer-1",
        period_key: "2026-07",
        calculation_hash: "period-hash",
        active: true,
        expected_cents: 1001,
        paid_cents: 0,
        outstanding_cents: 1001,
        payment_count: 0,
        payment_sequence: 0,
        status: "PENDING",
      }
    );
    state.set("groups/group-1/cashbox_summary/current", {
      recomputed_by_server: true,
      truncated: false,
      total_income_cents: 0,
      total_expense_cents: 0,
      entry_count: 0,
      ledger_version: 0,
      last_entry_at: null,
    });
    const requestBase = {
      auth: {uid: "owner", token: {name: "Owner"}},
      data: {
        groupId: "group-1",
        periodKey: "2026-07",
        targetUserId: "payer-1",
        requestId: "monthly-payment-0001",
        amountCents: 400,
      },
    };
    const partial = await settleMonthlyCharge(requestBase);
    expect(partial).toMatchObject({
      amountCents: 400,
      paidCents: 400,
      outstandingCents: 601,
      chargeStatus: "PARTIAL",
      periodStatus: "FINALIZED",
      paymentSequence: 1,
      duplicate: false,
    });
    const writesAfterPartial = writeCount;
    expect(state.get(
      "groups/group-1/monthly_finance_periods/2026-07/settlements/monthly-payment-0001"
    )).toMatchObject({
      status: "ACTIVE",
      payer_id: "payer-1",
      amount_cents: 400,
      cashbox_entry_id: "monthly_monthly-payment-0001",
      payment_sequence: 1,
    });
    state.delete(
      "groups/group-1/cashbox_summary_ops/create_monthly_monthly-payment-0001"
    );
    const replay = await settleMonthlyCharge(requestBase);
    expect(replay).toMatchObject({duplicate: true, amountCents: 400});
    expect(writeCount).toBe(writesAfterPartial);
    await expect(settleMonthlyCharge({
      ...requestBase,
      data: {...requestBase.data, amountCents: 399},
    })).rejects.toMatchObject({code: "already-exists"});

    const full = await settleMonthlyCharge({
      auth: requestBase.auth,
      data: {
        ...requestBase.data,
        requestId: "monthly-payment-0002",
        amountCents: undefined,
      },
    });
    expect(full).toMatchObject({
      amountCents: 601,
      paidCents: 1001,
      outstandingCents: 0,
      chargeStatus: "PAID",
      periodStatus: "CLOSED",
      paymentSequence: 2,
      duplicate: false,
    });
    expect(state.get(
      "groups/group-1/monthly_finance_periods/2026-07/payers/payer-1"
    )).toMatchObject({
      paid_cents: 1001,
      outstanding_cents: 0,
      status: "PAID",
      payment_sequence: 2,
      last_payment_sequence: 2,
    });
    expect(state.get("groups/group-1/monthly_finance_periods/2026-07"))
      .toMatchObject({received_cents: 1001, open_cents: 0, status: "CLOSED"});
    expect(state.get("groups/group-1/cashbox_summary/current"))
      .toMatchObject({total_income_cents: 1001, balance_cents: 1001});
    expect(state.get("groups/group-1/cashbox/monthly_monthly-payment-0001"))
      .toMatchObject({category: "MONTHLY_FEE", amount_cents: 400});
    expect(state.get("groups/group-1/cashbox/monthly_monthly-payment-0002"))
      .toMatchObject({category: "MONTHLY_FEE", amount_cents: 601});
  });
});
