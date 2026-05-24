const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

const queryChain: any = { where: mockWhere, orderBy: mockOrderBy, limit: mockLimit, get: mockCollectionGet };
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);

let mockGroupMemberCount = 5;
let mockGroupExists = true;

const mockTxUpdate = jest.fn();
const mockRunTransaction = jest.fn(
  async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
    const tx = {
      get: jest.fn().mockResolvedValue({
        exists: mockGroupExists,
        data: () => mockGroupExists ? { member_count: mockGroupMemberCount } : undefined,
      }),
      update: mockTxUpdate,
    };
    return callback(tx);
  },
);

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({ id: sid, get: mockDocGet, update: mockDocUpdate })),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    get: mockCollectionGet,
  })),
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockCollectionGet,
}));

const memberFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const memberTimestamp = {
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
};
const memberFirestore = jest.fn(() => ({
  collection: mockCollection,
  doc: jest.fn((path: string) => ({
    id: path.split("/").pop(),
    get: mockDocGet,
    update: mockDocUpdate,
  })),
  batch: jest.fn(),
  runTransaction: mockRunTransaction,
})) as any;
memberFirestore.FieldValue = memberFieldValue;
memberFirestore.Timestamp = memberTimestamp;
memberFirestore.FieldPath = { documentId: jest.fn(() => "__name__") };

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: memberFirestore,
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_c: any, h: any) => h),
}));

import { onMemberWritten } from "../../src/groups/member-counter";

describe("Member Counter", () => {
  const makeEvent = (beforeData: any, afterData: any) => ({
    data: {
      before: { data: () => beforeData, exists: beforeData != null },
      after: { data: () => afterData, exists: afterData != null },
    },
    params: { groupId: "group1", memberId: "user1" },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDocUpdate.mockResolvedValue(undefined);
    mockTxUpdate.mockResolvedValue(undefined);
    mockGroupMemberCount = 5;
    mockGroupExists = true;
    mockRunTransaction.mockImplementation(
      async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: mockGroupExists,
            data: () => mockGroupExists ? { member_count: mockGroupMemberCount } : undefined,
          }),
          update: mockTxUpdate,
        };
        return callback(tx);
      },
    );
  });

  it("incrementa member_count em CREATE ACTIVE", async () => {
    await onMemberWritten(makeEvent(undefined, { status: "ACTIVE" }));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 6,
      }),
    );
  });

  it("nao incrementa quando status nao e ACTIVE", async () => {
    await onMemberWritten(makeEvent(undefined, { status: "PENDING" }));

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("decrementa member_count em DELETE (before existia)", async () => {
    await onMemberWritten(makeEvent({ status: "ACTIVE" }, undefined));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 4,
      }),
    );
  });

  it("decrementa quando status muda de ACTIVE para INACTIVE", async () => {
    await onMemberWritten(makeEvent(
      { status: "ACTIVE" },
      { status: "INACTIVE" },
    ));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 4,
      }),
    );
  });

  it("faz no-op quando wasActive e isActive sao iguais", async () => {
    await onMemberWritten(makeEvent(
      { status: "ACTIVE" },
      { status: "ACTIVE" },
    ));

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("faz no-op quando ambos nao sao ACTIVE", async () => {
    await onMemberWritten(makeEvent(
      { status: "PENDING" },
      { status: "REMOVED" },
    ));

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("skip quando counted_by_join_request e CREATE", async () => {
    await onMemberWritten(makeEvent(
      undefined,
      { status: "ACTIVE", _counted_by_join_request: true },
    ));

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("nao impede decrement mesmo com counted_by_join_request (nao e CREATE)", async () => {
    await onMemberWritten(makeEvent(
      { status: "ACTIVE" },
      { status: "INACTIVE", _counted_by_join_request: true },
    ));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 4,
      }),
    );
  });

  it("reativacao (INACTIVE -> ACTIVE) incrementa member_count", async () => {
    await onMemberWritten(makeEvent(
      { status: "INACTIVE" },
      { status: "ACTIVE" },
    ));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 6,
      }),
    );
  });

  it("trata erro do Firestore sem lancar excecao", async () => {
    mockRunTransaction.mockRejectedValueOnce(new Error("Firestore error"));

    await expect(
      onMemberWritten(makeEvent(undefined, { status: "ACTIVE" })),
    ).resolves.toBeUndefined();
  });

  it("skip quando grupo nao existe na transacao", async () => {
    mockGroupExists = false;

    await onMemberWritten(makeEvent(undefined, { status: "ACTIVE" }));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it("nao permite member_count negativo (floor em 0)", async () => {
    mockGroupMemberCount = 0;

    await onMemberWritten(makeEvent({ status: "ACTIVE" }, undefined));

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 0,
      }),
    );
  });

  it("usa member_count=0 quando campo esta ausente no grupo", async () => {
    mockRunTransaction.mockImplementation(
      async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({}),
          }),
          update: mockTxUpdate,
        };
        return callback(tx);
      },
    );

    await onMemberWritten(makeEvent(undefined, { status: "ACTIVE" }));

    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        member_count: 1,
      }),
    );
  });
});
