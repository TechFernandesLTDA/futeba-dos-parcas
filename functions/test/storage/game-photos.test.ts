const mockState = {
  metadata: {
    contentType: "image/jpeg",
    size: "1000",
  },
  game: {status: "FINISHED", owner_id: "owner", co_organizers: []},
  confirmation: {status: "CONFIRMED"},
  user: {name: "Player", photoUrl: ""},
  existing: null as {storage_path: string; uploaded_by: string} | null,
  activeDocs: [] as Array<{id: string; get: (field: string) => unknown}>,
  created: [] as Array<{id: string; data: Record<string, unknown>}>,
};

const mockFile = {
  exists: jest.fn(),
  getMetadata: jest.fn(),
  setMetadata: jest.fn(),
};

const mockBucket = {
  name: "futebadosparcas.appspot.com",
  file: jest.fn(() => mockFile),
};

const mockDb = {
  collection: jest.fn(),
  runTransaction: jest.fn(),
};

jest.mock("../../src/_db", () => ({db: jest.fn(() => mockDb)}));
jest.mock("../../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: jest.fn((_options, handler) => handler),
}));
jest.mock("firebase-admin/storage", () => ({
  getStorage: jest.fn(() => ({bucket: jest.fn(() => mockBucket)})),
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: jest.fn(() => ({serverTimestamp: true}))},
}));
jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import {createGamePhoto} from "../../src/storage/game-photos";

type Callable = (request: unknown) => Promise<unknown>;
const callable = createGamePhoto as unknown as Callable;

function ref(collection: string, id: string) {
  return {kind: "ref", collection, id, path: `${collection}/${id}`};
}

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {exists, data: () => data};
}

function configureDatabase() {
  const queryChain = {kind: "query", where: jest.fn(), limit: jest.fn()};
  queryChain.where.mockReturnValue(queryChain);
  queryChain.limit.mockReturnValue(queryChain);
  mockDb.collection.mockImplementation((name: string) => ({
    doc: jest.fn((id: string) => ref(name, id)),
    where: jest.fn(() => queryChain),
  }));
  mockDb.runTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const transaction = {
      get: jest.fn(async (target: {kind: string; collection?: string}) => {
        if (target.kind === "query") return {docs: mockState.activeDocs};
        if (target.collection === "games") return snapshot(true, mockState.game);
        if (target.collection === "confirmations") return snapshot(true, mockState.confirmation);
        if (target.collection === "users") return snapshot(true, mockState.user);
        if (target.collection === "game_photos" && mockState.existing) {
          return snapshot(true, mockState.existing);
        }
        return snapshot(false);
      }),
      create: jest.fn((target: {id: string}, data: Record<string, unknown>) => {
        mockState.created.push({id: target.id, data});
      }),
    };
    return callback(transaction);
  });
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    auth: {uid: "player", token: {role: "PLAYER", name: "Player"}},
    data: {
      gameId: "game-1",
      storagePath: "games/game-1/photos/player/photo.jpg",
      caption: "Golaco",
      ...overrides,
    },
  };
}

describe("createGamePhoto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.metadata = {
      contentType: "image/jpeg",
      size: "1000",
    };
    mockState.game = {status: "FINISHED", owner_id: "owner", co_organizers: []};
    mockState.confirmation = {status: "CONFIRMED"};
    mockState.user = {name: "Player", photoUrl: ""};
    mockState.existing = null;
    mockState.activeDocs = [];
    mockState.created = [];
    mockFile.exists.mockResolvedValue([true]);
    mockFile.getMetadata.mockImplementation(async () => [mockState.metadata]);
    mockFile.setMetadata.mockResolvedValue([{}]);
    configureDatabase();
  });

  it("creates one server-derived document for a valid uploaded object", async () => {
    const result = await callable(request());

    expect(result).toEqual({success: true, photoId: expect.any(String), alreadyExists: false});
    expect(mockState.created).toHaveLength(1);
    expect(mockState.created[0].data).toMatchObject({
      game_id: "game-1",
      storage_path: "games/game-1/photos/player/photo.jpg",
      uploaded_by: "player",
      status: "ACTIVE",
      content_type: "image/jpeg",
      caption: "Golaco",
    });
    expect(mockState.created[0].data.url).toMatch(
      /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/futebadosparcas\.appspot\.com\/o\/games%2Fgame-1%2Fphotos%2Fplayer%2Fphoto\.jpg\?alt=media&token=[0-9a-fA-F-]{36}$/
    );
    expect(mockState.created[0].data.url).not.toContain("X-Goog-Signature");
    expect(mockFile.setMetadata).toHaveBeenCalledWith({
      metadata: expect.objectContaining({
        firebaseStorageDownloadTokens: expect.any(String),
      }),
    });
  });

  it("reuses an existing download token instead of writing new metadata", async () => {
    mockState.metadata = {
      contentType: "image/jpeg",
      size: "1000",
      metadata: {firebaseStorageDownloadTokens: "existing-token"},
    };

    const result = await callable(request());

    expect(result).toMatchObject({success: true, alreadyExists: false});
    expect(mockState.created[0].data.url).toContain(
      "?alt=media&token=existing-token"
    );
    expect(mockFile.setMetadata).not.toHaveBeenCalled();
  });

  it("rejects a document-only request when the Storage object is absent", async () => {
    mockFile.exists.mockResolvedValue([false]);

    await expect(callable(request())).rejects.toMatchObject({code: "failed-precondition"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects an object whose content type or size is not accepted", async () => {
    mockState.metadata = {contentType: "text/plain", size: "1000"};
    mockFile.getMetadata.mockImplementation(async () => [mockState.metadata]);

    await expect(callable(request())).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockState.created).toHaveLength(0);
  });

  it("is idempotent for a repeated Storage path", async () => {
    mockState.existing = {
      storage_path: "games/game-1/photos/player/photo.jpg",
      uploaded_by: "player",
    };

    await expect(callable(request())).resolves.toMatchObject({success: true, alreadyExists: true});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects a collision when the same deterministic id maps to another upload", async () => {
    mockState.existing = {
      storage_path: "games/game-1/photos/player/other.jpg",
      uploaded_by: "player",
    };

    await expect(callable(request())).rejects.toMatchObject({code: "already-exists"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects when the game does not exist", async () => {
    mockDb.runTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const transaction = {
        get: jest.fn(async (target: {kind: string; collection?: string}) => {
          if (target.kind === "query") return {docs: mockState.activeDocs};
          return snapshot(false);
        }),
        create: jest.fn(),
      };
      return callback(transaction);
    });

    await expect(callable(request())).rejects.toMatchObject({code: "not-found"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects photos before the game is FINISHED", async () => {
    mockState.game = {status: "SCHEDULED", owner_id: "owner", co_organizers: []};

    await expect(callable(request())).rejects.toMatchObject({code: "failed-precondition"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects a non-confirmed non-manager uploader", async () => {
    mockState.confirmation = {status: "DECLINED"};

    await expect(callable(request())).rejects.toMatchObject({code: "permission-denied"});
    expect(mockState.created).toHaveLength(0);
  });

  it("allows the game owner to upload without being confirmed", async () => {
    mockState.confirmation = {status: "DECLINED"};
    mockState.game = {status: "FINISHED", owner_id: "player", co_organizers: []};
    mockState.user = {};

    await expect(callable({
      auth: {uid: "player", token: {role: "PLAYER"}},
      data: request().data,
    })).resolves.toMatchObject({alreadyExists: false});
    expect(mockState.created).toHaveLength(1);
    expect(mockState.created[0].data.uploaded_by_name).toBe("Jogador");
  });

  it("allows a co-organizer to upload without being confirmed", async () => {
    mockState.confirmation = {status: "DECLINED"};
    mockState.game = {status: "FINISHED", owner_id: "owner", co_organizers: ["player"]};

    await expect(callable(request())).resolves.toMatchObject({alreadyExists: false});
    expect(mockState.created).toHaveLength(1);
  });

  it("enforces the per-game photo limit inside the transaction", async () => {
    mockState.activeDocs = Array.from({length: 50}, (_, index) => ({
      id: `photo-${index}`,
      get: (field: string) => field === "uploaded_by" ? `other-${index}` : "ACTIVE",
    }));

    await expect(callable(request())).rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockState.created).toHaveLength(0);
  });

  it("enforces the per-user per-game photo limit inside the transaction", async () => {
    mockState.activeDocs = Array.from({length: 20}, (_, index) => ({
      id: `photo-${index}`,
      get: (field: string) => field === "uploaded_by" ? "player" : "ACTIVE",
    }));

    await expect(callable(request())).rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects a storage path that does not belong to the caller", async () => {
    await expect(callable(request({
      storagePath: "games/game-1/photos/someone-else/photo.jpg",
    }))).rejects.toMatchObject({code: "permission-denied"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects an unparseable storage path", async () => {
    await expect(callable(request({
      storagePath: "not-a-canonical-path",
    }))).rejects.toMatchObject({code: "permission-denied"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects a caption longer than the limit", async () => {
    await expect(callable(request({
      caption: "x".repeat(161),
    }))).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects a non-string gameId", async () => {
    await expect(callable(request({
      gameId: 123,
    }))).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects a blank storagePath", async () => {
    await expect(callable(request({
      storagePath: "   ",
    }))).rejects.toMatchObject({code: "invalid-argument"});
    expect(mockState.created).toHaveLength(0);
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(callable({auth: null, data: request().data}))
      .rejects.toMatchObject({code: "unauthenticated"});
    expect(mockState.created).toHaveLength(0);
  });
});
