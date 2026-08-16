const mockRunTransaction = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockCollectionGroup = jest.fn();
const mockServerTimestamp = jest.fn(() => ({_type: "ServerTimestamp"}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: mockServerTimestamp,
    increment: jest.fn((value: number) => ({_type: "Increment", value})),
  },
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    collection: mockCollection,
    collectionGroup: mockCollectionGroup,
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 19,
    resetAt: new Date(Date.now() + 60000),
  }),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import {checkRateLimit} from "../src/middleware/rate-limiter";
import {
  createDirectChat,
  submitDirectMessage,
} from "../src/social/direct-messages";

type DocSnapshot = {
  exists: boolean;
  data: () => Record<string, unknown>;
};

let docSnapshots: Record<string, DocSnapshot>;

function makeQuerySnapshot(docs: any[]) {
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
  };
}

function makePagedQuery(pages: any[][]) {
  let pageIndex = 0;
  return {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    get: jest.fn().mockImplementation(() =>
      Promise.resolve(makeQuerySnapshot(pages[pageIndex++] ?? []))
    ),
  };
}

function makeConfirmationDoc(
  gameId: string,
  status = "CONFIRMED"
) {
  return {
    data: () => ({game_id: gameId, status}),
  };
}

function makeMembershipDoc(
  groupId: string,
  peerStatus: "ACTIVE" | null
) {
  return {
    id: `${groupId}_user-1`,
    data: () => ({user_id: "user-1", status: "ACTIVE"}),
    ref: {
      parent: {
        parent: {
          collection: () => ({
            doc: () => ({
              get: jest.fn().mockResolvedValue(
                peerStatus ?
                  {exists: true, data: () => ({status: peerStatus})} :
                  {exists: false, data: () => ({})}
              ),
            }),
          }),
        },
      },
    },
  };
}

function makeDocRef(path: string) {
  return {
    path,
    id: path.split("/").pop() ?? path,
    get: jest.fn().mockImplementation(() =>
      Promise.resolve(
        docSnapshots[path] ?? {exists: false, data: () => ({})}
      )
    ),
    collection: (name: string) => ({
      doc: () => ({
        id: "message-1",
        path: `${path}/${name}/message-1`,
      }),
    }),
  };
}

describe("direct messages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    docSnapshots = {
      "users/user-1": {
        exists: true,
        data: () => ({name: "Novo Nome", photo_url: "new-photo.png"}),
      },
      "users/user-2": {
        exists: true,
        data: () => ({name: "Outro Nome", photo_url: "other-photo.png"}),
      },
      "users/user-1/blocked/user-2": {
        exists: false,
        data: () => ({}),
      },
      "users/user-2/blocked/user-1": {
        exists: false,
        data: () => ({}),
      },
    };
    mockDoc.mockImplementation((path: string) => makeDocRef(path));
  });

  it("pagina memberships ativas até encontrar grupo em comum ao criar DM", async () => {
    const membershipsQuery = makePagedQuery([
      Array.from({length: 20}, (_, index) =>
        makeMembershipDoc(`group-${index}`, null)),
      [makeMembershipDoc("group-shared", "ACTIVE")],
    ]);
    const tx = {
      get: jest.fn().mockResolvedValue({exists: false, data: () => ({})}),
      set: jest.fn(),
    };

    mockCollectionGroup.mockReturnValue(membershipsQuery);
    mockRunTransaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await createDirectChat({
      auth: {uid: "user-1", token: {}},
      data: {targetUid: "user-2"},
    } as any);

    expect(result).toEqual({chatId: "user-1_user-2"});
    expect(membershipsQuery.startAfter).toHaveBeenCalledTimes(1);
    expect(mockCollection).not.toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({path: "chats/user-1_user-2"}),
      expect.objectContaining({
        participants: ["user-1", "user-2"],
      }),
    );
  });

  it("pagina confirmações até achar jogo compartilhado fora da primeira janela", async () => {
    const membershipsQuery = makePagedQuery([[]]);
    const callerFirstPageQuery = makePagedQuery([
      Array.from({length: 100}, () => makeConfirmationDoc("game-old")),
    ]);
    const callerSecondPageQuery = makePagedQuery([
      [makeConfirmationDoc("game-shared")],
    ]);
    const peerMissQuery = makePagedQuery([[]]);
    const peerHitQuery = makePagedQuery([[makeConfirmationDoc("game-shared")]]);
    const tx = {
      get: jest.fn().mockResolvedValue({exists: false, data: () => ({})}),
      set: jest.fn(),
    };
    const confirmationQueries = [
      callerFirstPageQuery,
      peerMissQuery,
      callerSecondPageQuery,
      peerHitQuery,
    ];

    mockCollectionGroup.mockReturnValue(membershipsQuery);
    mockCollection.mockImplementation((name: string) => {
      if (name !== "confirmations") {
        throw new Error(`Unexpected collection ${name}`);
      }
      const nextQuery = confirmationQueries.shift();
      if (!nextQuery) {
        throw new Error("Unexpected confirmations query");
      }
      return nextQuery;
    });
    mockRunTransaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await createDirectChat({
      auth: {uid: "user-1", token: {}},
      data: {targetUid: "user-2"},
    } as any);

    expect(result).toEqual({chatId: "user-1_user-2"});
    expect(callerSecondPageQuery.startAfter).toHaveBeenCalledTimes(1);
    expect(peerHitQuery.where).toHaveBeenCalledWith(
      "game_id",
      "in",
      ["game-shared"],
    );
  });

  it("bloqueia criação de DM quando há rate limiting", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30000),
    });

    await expect(createDirectChat({
      auth: {uid: "user-1", token: {}},
      data: {targetUid: "user-2"},
    } as any)).rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockCollectionGroup).not.toHaveBeenCalled();
  });

  it("atualiza participant_names e participant_photos com os dados atuais no envio", async () => {
    const tx = {
      get: jest.fn((ref: {path: string}) => {
        switch (ref.path) {
        case "chats/user-1_user-2":
          return Promise.resolve({
            exists: true,
            data: () => ({participants: ["user-1", "user-2"]}),
          });
        case "users/user-1":
          return Promise.resolve(docSnapshots["users/user-1"]);
        case "users/user-2":
          return Promise.resolve(docSnapshots["users/user-2"]);
        default:
          return Promise.resolve({exists: false, data: () => ({})});
        }
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockRunTransaction.mockImplementation(async (callback: any) => callback(tx));

    await submitDirectMessage({
      auth: {uid: "user-1"},
      data: {chatId: "user-1_user-2", text: "Oi"},
    } as any);

    expect(tx.update).toHaveBeenCalledWith(
      expect.objectContaining({path: "chats/user-1_user-2"}),
      expect.objectContaining({
        participant_names: {
          "user-1": "Novo Nome",
          "user-2": "Outro Nome",
        },
        participant_photos: {
          "user-1": "new-photo.png",
          "user-2": "other-photo.png",
        },
      })
    );
  });

  it("rejeita chatId com path injection antes de acessar Firestore", async () => {
    await expect(submitDirectMessage({
      auth: {uid: "user-1"},
      data: {chatId: "chat/nested/doc", text: "Oi"},
    } as any)).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it.each([
    {exists: false, data: () => ({})},
    {exists: true, data: () => ({deletedAt: {_seconds: 1}})},
    {exists: true, data: () => ({status: "DELETED"})},
    {exists: true, data: () => ({is_active: false})},
  ])("bloqueia envio quando participante está ausente/inativo", async (recipient) => {
    const tx = {
      get: jest.fn((ref: {path: string}) => {
        if (ref.path === "chats/user-1_user-2") {
          return Promise.resolve({
            exists: true,
            data: () => ({participants: ["user-1", "user-2"]}),
          });
        }
        if (ref.path === "users/user-1") {
          return Promise.resolve({exists: true, data: () => ({name: "Um"})});
        }
        if (ref.path === "users/user-2") return Promise.resolve(recipient);
        return Promise.resolve({exists: false, data: () => ({})});
      }),
      set: jest.fn(),
      update: jest.fn(),
    };
    mockRunTransaction.mockImplementation(async (callback: any) => callback(tx));

    await expect(submitDirectMessage({
      auth: {uid: "user-1"},
      data: {chatId: "user-1_user-2", text: "Oi"},
    } as any)).rejects.toMatchObject({code: "not-found"});
    expect(tx.set).not.toHaveBeenCalled();
  });
});
