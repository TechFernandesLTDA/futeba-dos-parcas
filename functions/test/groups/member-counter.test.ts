const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

interface MockMemberDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface TransactionBudget {
  reads: number;
  writes: number;
}

const mockState = {
  groupExists: true,
  memberCount: 0,
  markers: new Set<string>(),
  memberDocs: [] as MockMemberDoc[],
  transactionBudgets: [] as TransactionBudget[],
  directUpdates: [] as Array<Record<string, unknown>>,
  failNextTransaction: false,
};

function mockSnapshot(
  exists: boolean,
  data: Record<string, unknown> = {},
) {
  return {exists, data: () => exists ? data : undefined};
}

function mockMembersQuery(
  startIndex = 0,
  pageLimit = mockState.memberDocs.length || 1,
): Record<string, unknown> {
  return {
    orderBy: jest.fn(() => mockMembersQuery(startIndex, pageLimit)),
    limit: jest.fn((value: number) => mockMembersQuery(startIndex, value)),
    startAfter: jest.fn((cursor: MockMemberDoc) => {
      const cursorIndex = mockState.memberDocs.findIndex(
        (member) => member.id === cursor.id,
      );
      return mockMembersQuery(cursorIndex + 1, pageLimit);
    }),
    get: jest.fn(async () => {
      const docs = mockState.memberDocs.slice(
        startIndex,
        startIndex + pageLimit,
      );
      return {docs, size: docs.length};
    }),
  };
}

function mockDocumentRef(path: string): Record<string, unknown> {
  return {
    path,
    collection: jest.fn((name: string) => {
      if (name === "members") return mockMembersQuery();
      return {
        doc: jest.fn((id: string) => mockDocumentRef(`${path}/${name}/${id}`)),
      };
    }),
    get: jest.fn(async () => mockSnapshot(
      mockState.groupExists,
      {member_count: mockState.memberCount},
    )),
    update: jest.fn(async (data: Record<string, unknown>) => {
      mockState.directUpdates.push(data);
      if (typeof data.member_count === "number") {
        mockState.memberCount = data.member_count;
      }
    }),
  };
}

const mockDb = {
  doc: jest.fn((path: string) => mockDocumentRef(path)),
  runTransaction: jest.fn(async (
    callback: (transaction: Record<string, unknown>) => Promise<unknown>,
  ) => {
    if (mockState.failNextTransaction) {
      mockState.failNextTransaction = false;
      throw new Error("transaction unavailable");
    }

    const budget: TransactionBudget = {reads: 0, writes: 0};
    const transaction = {
      get: jest.fn(async (reference: {path: string}) => {
        budget.reads += 1;
        if (reference.path.includes("/member_counter_events/")) {
          return mockSnapshot(mockState.markers.has(reference.path));
        }
        return mockSnapshot(
          mockState.groupExists,
          {member_count: mockState.memberCount},
        );
      }),
      update: jest.fn((reference: {path: string}, data: Record<string, unknown>) => {
        budget.writes += 1;
        if (typeof data.member_count === "number") {
          mockState.memberCount = data.member_count;
        }
      }),
      create: jest.fn((reference: {path: string}) => {
        budget.writes += 1;
        mockState.markers.add(reference.path);
      }),
    };
    const result = await callback(transaction);
    mockState.transactionBudgets.push(budget);
    return result;
  }),
};

jest.mock("firebase-functions", () => ({logger: mockLogger}));
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_options, handler) => handler),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {documentId: jest.fn(() => "__name__")},
  FieldValue: {serverTimestamp: jest.fn(() => ({serverTimestamp: true}))},
}));
jest.mock("../../src/_db", () => ({db: () => mockDb}));

import {
  onMemberWritten,
  reconcileGroupMemberCount,
} from "../../src/groups/member-counter";

type MemberHandler = (event: {
  id?: string;
  params: {groupId: string; memberId: string};
  data: {
    before: {data: () => Record<string, unknown> | undefined};
    after: {data: () => Record<string, unknown> | undefined};
  };
}) => Promise<void>;

const handleMemberWritten = onMemberWritten as unknown as MemberHandler;

function makeEvent(
  id: string,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  memberId = "member-1",
) {
  return {
    id,
    params: {groupId: "group-1", memberId},
    data: {
      before: {data: () => before},
      after: {data: () => after},
    },
  };
}

describe("member counter delta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.groupExists = true;
    mockState.memberCount = 0;
    mockState.markers.clear();
    mockState.memberDocs = [];
    mockState.transactionBudgets = [];
    mockState.directUpdates = [];
    mockState.failNextTransaction = false;
  });

  it("aplica create e delete ativos exatamente uma vez", async () => {
    await handleMemberWritten(makeEvent(
      "create-1",
      undefined,
      {status: "ACTIVE"},
    ));
    expect(mockState.memberCount).toBe(1);

    await handleMemberWritten(makeEvent(
      "delete-1",
      {status: "ACTIVE"},
      undefined,
    ));
    expect(mockState.memberCount).toBe(0);
  });

  it("converge owner de 0 para 1 sob entregas concorrentes duplicadas", async () => {
    const ownerCreated = makeEvent(
      "owner-created-1",
      undefined,
      {status: "ACTIVE", role: "OWNER"},
      "owner-1",
    );

    await Promise.all([
      handleMemberWritten(ownerCreated),
      handleMemberWritten(ownerCreated),
    ]);

    expect(mockState.memberCount).toBe(1);
    expect(mockState.markers.size).toBe(1);
  });

  it("aplica ACTIVE <-> INACTIVE e mantém contador não-negativo", async () => {
    mockState.memberCount = 4;
    await handleMemberWritten(makeEvent(
      "deactivate-1",
      {status: "ACTIVE"},
      {status: "INACTIVE"},
    ));
    expect(mockState.memberCount).toBe(3);

    await handleMemberWritten(makeEvent(
      "reactivate-1",
      {status: "INACTIVE"},
      {status: "ACTIVE"},
    ));
    expect(mockState.memberCount).toBe(4);

    mockState.memberCount = 0;
    await handleMemberWritten(makeEvent(
      "deactivate-at-zero",
      {status: "ACTIVE"},
      {status: "INACTIVE"},
    ));
    expect(mockState.memberCount).toBe(0);
  });

  it("ignora update irrelevante e create já contado por join-request", async () => {
    mockState.memberCount = 7;
    await handleMemberWritten(makeEvent(
      "profile-update",
      {status: "ACTIVE", role: "MEMBER"},
      {status: "ACTIVE", role: "ADMIN"},
    ));
    await handleMemberWritten(makeEvent(
      "join-request-create",
      undefined,
      {status: "ACTIVE", _counted_by_join_request: true},
    ));

    expect(mockDb.runTransaction).not.toHaveBeenCalled();
    expect(mockState.memberCount).toBe(7);
  });

  it("ignora entrega duplicada pelo event id", async () => {
    const event = makeEvent("duplicate-1", undefined, {status: "ACTIVE"});
    await handleMemberWritten(event);
    await handleMemberWritten(event);

    expect(mockState.memberCount).toBe(1);
    expect(mockState.transactionBudgets).toEqual([
      {reads: 2, writes: 2},
      {reads: 1, writes: 0},
    ]);
  });

  it("propaga falha para retry sem gravar marcador ou contador", async () => {
    mockState.failNextTransaction = true;
    const event = makeEvent("retry-1", undefined, {status: "ACTIVE"});

    await expect(handleMemberWritten(event)).rejects.toThrow(
      "transaction unavailable",
    );
    expect(mockState.memberCount).toBe(0);
    expect(mockState.markers.size).toBe(0);
    expect(mockLogger.error).toHaveBeenCalled();

    await expect(handleMemberWritten(event)).resolves.toBeUndefined();
    expect(mockState.memberCount).toBe(1);
  });

  it("processa 1000 eventos mistos com contador exato e orçamento constante", async () => {
    for (let block = 0; block < 200; block += 1) {
      const createId = `create-${block}`;
      await handleMemberWritten(makeEvent(
        createId,
        undefined,
        {status: "ACTIVE"},
        `member-${block}-a`,
      ));
      await handleMemberWritten(makeEvent(
        `reactivate-${block}`,
        {status: "INACTIVE"},
        {status: "ACTIVE"},
        `member-${block}-b`,
      ));
      await handleMemberWritten(makeEvent(
        `deactivate-${block}`,
        {status: "ACTIVE"},
        {status: "INACTIVE"},
        `member-${block}-b`,
      ));
      await handleMemberWritten(makeEvent(
        `irrelevant-${block}`,
        {status: "ACTIVE", role: "MEMBER"},
        {status: "ACTIVE", role: "ADMIN"},
        `member-${block}-a`,
      ));
      await handleMemberWritten(makeEvent(
        createId,
        undefined,
        {status: "ACTIVE"},
        `member-${block}-a`,
      ));
    }

    expect(mockState.memberCount).toBe(200);
    expect(mockState.transactionBudgets).toHaveLength(800);
    for (const budget of mockState.transactionBudgets) {
      expect(budget.reads).toBeLessThanOrEqual(3);
      expect(budget.writes).toBeLessThanOrEqual(2);
    }
  });
});

describe("member counter reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.groupExists = true;
    mockState.memberCount = 12;
    mockState.markers.clear();
    mockState.transactionBudgets = [];
    mockState.directUpdates = [];
    mockState.memberDocs = Array.from({length: 1000}, (_, index) => ({
      id: `member-${String(index).padStart(4, "0")}`,
      data: () => ({status: index % 4 === 0 ? "INACTIVE" : "ACTIVE"}),
    }));
  });

  it("faz dry-run paginado e reconcilia drift sob execução explícita", async () => {
    const preview = await reconcileGroupMemberCount("group-1", {
      dryRun: true,
      pageSize: 128,
    });
    expect(preview).toEqual(expect.objectContaining({
      dryRun: true,
      pages: 8,
      scannedMembers: 1000,
      activeMembers: 750,
      previousCount: 12,
      drift: 738,
      updated: false,
    }));
    expect(mockState.directUpdates).toHaveLength(0);

    const applied = await reconcileGroupMemberCount("group-1", {
      dryRun: false,
      pageSize: 200,
    });
    expect(applied.updated).toBe(true);
    expect(mockState.memberCount).toBe(750);
    expect(mockState.directUpdates).toHaveLength(1);
  });
});
