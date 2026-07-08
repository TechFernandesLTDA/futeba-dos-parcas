const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

const queryChain: any = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockCollectionGet,
};
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);

let mockGroupMemberCount = 5;
let mockGroupExists = true;
let mockMemberDocs: Array<{ id: string; data: () => Record<string, unknown> }> = [];

function setMemberDocs(statuses: Array<string | undefined>) {
  mockMemberDocs = statuses.map((status, index) => ({
    id: `user${index + 1}`,
    data: () => status === undefined ? {} : { status },
  }));
}

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({
      id: sid,
      get: mockDocGet,
      update: mockDocUpdate,
    })),
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
  runTransaction: jest.fn(),
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
    mockGroupMemberCount = 5;
    mockGroupExists = true;
    setMemberDocs(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"]);
    mockDocGet.mockImplementation(async () => ({
      exists: mockGroupExists,
      data: () => mockGroupExists ?
        { member_count: mockGroupMemberCount } :
        undefined,
    }));
    mockCollectionGet.mockImplementation(async () => ({ docs: mockMemberDocs }));
  });

  it("reconta member_count em CREATE ACTIVE", async () => {
    setMemberDocs([
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
    ]);

    await onMemberWritten(makeEvent(undefined, { status: "ACTIVE" }));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 6,
      }),
    );
  });

  it("nao escreve quando status nao e ACTIVE e contador ja esta correto", async () => {
    await onMemberWritten(makeEvent(undefined, { status: "PENDING" }));

    expect(mockCollectionGet).toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("reconta member_count em DELETE de membro ativo", async () => {
    setMemberDocs(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"]);

    await onMemberWritten(makeEvent({ status: "ACTIVE" }, undefined));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 4,
      }),
    );
  });

  it("reconta quando status muda de ACTIVE para INACTIVE", async () => {
    setMemberDocs(["ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"]);

    await onMemberWritten(makeEvent(
      { status: "ACTIVE" },
      { status: "INACTIVE" },
    ));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 4,
      }),
    );
  });

  it("cura drift mesmo quando wasActive e isActive sao iguais", async () => {
    mockGroupMemberCount = 2;
    setMemberDocs(["ACTIVE"]);

    await onMemberWritten(makeEvent(
      { status: "ACTIVE" },
      { status: "ACTIVE" },
    ));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 1,
      }),
    );
  });

  it("faz no-op quando ambos nao sao ACTIVE e contador ja esta correto", async () => {
    await onMemberWritten(makeEvent(
      { status: "PENDING" },
      { status: "REMOVED" },
    ));

    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("nao duplica join-request ja contado quando contador esta correto", async () => {
    mockGroupMemberCount = 6;
    setMemberDocs([
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
    ]);

    await onMemberWritten(makeEvent(
      undefined,
      { status: "ACTIVE", _counted_by_join_request: true },
    ));

    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("reativacao (INACTIVE -> ACTIVE) reconta member_count", async () => {
    setMemberDocs([
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
    ]);

    await onMemberWritten(makeEvent(
      { status: "INACTIVE" },
      { status: "ACTIVE" },
    ));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 6,
      }),
    );
  });

  it("trata erro do Firestore sem lancar excecao", async () => {
    mockCollectionGet.mockRejectedValueOnce(new Error("Firestore error"));

    await expect(
      onMemberWritten(makeEvent(undefined, { status: "ACTIVE" })),
    ).resolves.toBeUndefined();
  });

  it("skip quando grupo nao existe", async () => {
    mockGroupExists = false;

    await onMemberWritten(makeEvent(undefined, { status: "ACTIVE" }));

    expect(mockCollectionGet).toHaveBeenCalled();
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("considera status ausente como membro ativo legacy", async () => {
    mockGroupMemberCount = 0;
    setMemberDocs([undefined]);

    await onMemberWritten(makeEvent(undefined, {}));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 1,
      }),
    );
  });

  it("usa member_count=0 quando campo esta ausente no grupo", async () => {
    mockDocGet.mockImplementation(async () => ({
      exists: true,
      data: () => ({}),
    }));
    setMemberDocs(["ACTIVE"]);

    await onMemberWritten(makeEvent(undefined, { status: "ACTIVE" }));

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        member_count: 1,
      }),
    );
  });
});
