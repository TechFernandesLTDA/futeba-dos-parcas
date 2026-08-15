const mockState = {
  storageExists: true,
  metadata: {
    contentType: "video/mp4",
    size: "1000",
    metadata: {firebaseStorageDownloadTokens: "token-1"},
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

jest.mock("../../src/_db", () => ({
  db: jest.fn(() => mockDb),
}));

jest.mock("../../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: jest.fn((_options, handler) => handler),
}));

jest.mock("firebase-admin/storage", () => ({
  getStorage: jest.fn(() => ({bucket: jest.fn(() => mockBucket)})),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({serverTimestamp: true})),
  },
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

import {createGameVideo} from "../../src/storage/game-videos";

type Callable = (request: unknown) => Promise<unknown>;

const callable = createGameVideo as unknown as Callable;

function ref(collection: string, id: string) {
  return {kind: "ref", collection, id, path: `${collection}/${id}`};
}

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {exists, data: () => data};
}

function configureDatabase() {
  const queryChain = {
    kind: "query",
    where: jest.fn(),
    limit: jest.fn(),
  };
  queryChain.where.mockReturnValue(queryChain);
  queryChain.limit.mockReturnValue(queryChain);
  mockDb.collection.mockImplementation((name: string) => ({
    doc: jest.fn((id: string) => ref(name, id)),
    where: jest.fn(() => queryChain),
  }));
  mockDb.runTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    const transaction = {
      get: jest.fn(async (target: {kind: string; collection?: string}) => {
        if (target.kind === "query") {
          return {docs: mockState.activeDocs};
        }
        if (target.collection === "games") return snapshot(true, mockState.game);
        if (target.collection === "confirmations") return snapshot(true, mockState.confirmation);
        if (target.collection === "users") return snapshot(true, mockState.user);
        if (target.collection === "game_videos" && mockState.existing) {
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
      storagePath: "games/game-1/videos/player/clip.mp4",
      caption: "Golaço",
      ...overrides,
    },
  };
}

describe("createGameVideo", () => {
  beforeEach(() => {
    mockState.storageExists = true;
    mockState.metadata = {
      contentType: "video/mp4",
      size: "1000",
      metadata: {firebaseStorageDownloadTokens: "token-1"},
    };
    mockState.existing = null;
    mockState.activeDocs = [];
    mockState.created = [];
    mockFile.exists.mockResolvedValue([true]);
    mockFile.getMetadata.mockImplementation(async () => [mockState.metadata]);
    mockFile.setMetadata.mockResolvedValue(undefined);
    configureDatabase();
  });

  it("creates one server-derived document for a valid uploaded object", async () => {
    const result = await callable(request());

    expect(result).toEqual({
      success: true,
      videoId: expect.any(String),
      alreadyExists: false,
    });
    expect(mockState.created).toHaveLength(1);
    expect(mockState.created[0].data).toMatchObject({
      game_id: "game-1",
      storage_path: "games/game-1/videos/player/clip.mp4",
      uploaded_by: "player",
      status: "PROCESSING",
      url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.appspot.com/o/games%2Fgame-1%2Fvideos%2Fplayer%2Fclip.mp4?alt=media&token=token-1",
    });
  });

  it("rejects a document-only request when the Storage object is absent", async () => {
    mockFile.exists.mockResolvedValue([false]);

    await expect(callable(request())).rejects.toMatchObject({
      code: "failed-precondition",
    });
    expect(mockState.created).toHaveLength(0);
  });

  it("enforces the active per-game limit inside the transaction", async () => {
    mockState.activeDocs = Array.from({length: 10}, (_, index) => ({
      id: `video-${index}`,
      get: (field: string) => field === "uploaded_by" ? `other-${index}` : "READY",
    }));

    await expect(callable(request())).rejects.toMatchObject({
      code: "resource-exhausted",
    });
    expect(mockState.created).toHaveLength(0);
  });

  it("is idempotent for a repeated Storage path", async () => {
    mockState.existing = {
      storage_path: "games/game-1/videos/player/clip.mp4",
      uploaded_by: "player",
    };

    await expect(callable(request())).resolves.toMatchObject({
      success: true,
      alreadyExists: true,
    });
    expect(mockState.created).toHaveLength(0);
  });
});
