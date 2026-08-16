const mockState = {
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

const janitorGet = jest.fn();

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

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock("firebase-functions/v2", () => ({logger: mockLogger}));

let reconcileHandler: (() => Promise<void>) | null = null;
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: () => Promise<void>) => {
    reconcileHandler = handler;
    return handler;
  }),
}));

import {createGameVideo, reconcileStaleProcessingGameVideos} from "../../src/storage/game-videos";

type Callable = (request: unknown) => Promise<unknown>;
const callable = createGameVideo as unknown as Callable;

function ref(collection: string, id: string) {
  return {kind: "ref", collection, id, path: `${collection}/${id}`};
}

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {exists, data: () => data};
}

function configureDatabase() {
  const queryChain: any = {kind: "query", where: jest.fn(), limit: jest.fn(), get: janitorGet};
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
      caption: "Golaco",
      ...overrides,
    },
  };
}

describe("createGameVideo", () => {
  beforeEach(() => {
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

    expect(result).toEqual({success: true, videoId: expect.any(String), alreadyExists: false});
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

    await expect(callable(request())).rejects.toMatchObject({code: "failed-precondition"});
    expect(mockState.created).toHaveLength(0);
  });

  it("enforces the active per-game limit inside the transaction", async () => {
    mockState.activeDocs = Array.from({length: 10}, (_, index) => ({
      id: `video-${index}`,
      get: (field: string) => field === "uploaded_by" ? `other-${index}` : "READY",
    }));

    await expect(callable(request())).rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockState.created).toHaveLength(0);
  });

  it("is idempotent for a repeated Storage path", async () => {
    mockState.existing = {
      storage_path: "games/game-1/videos/player/clip.mp4",
      uploaded_by: "player",
    };

    await expect(callable(request())).resolves.toMatchObject({success: true, alreadyExists: true});
    expect(mockState.created).toHaveLength(0);
  });
});

describe("reconcileStaleProcessingGameVideos (#4038)", () => {
  const janitor = () => {
    if (!reconcileHandler) throw new Error("janitor handler not captured");
    return reconcileHandler();
  };

  const staleCreatedAt = () => {
    const old = Date.now() - 60 * 60 * 1000;
    return {toMillis: () => old, toDate: () => new Date(old)};
  };

  beforeEach(() => {
    jest.clearAllMocks();
    janitorGet.mockReset();
    janitorGet.mockResolvedValue({docs: [], size: 0});
    mockDb.runTransaction.mockReset();
    mockFile.exists.mockReset();

    const chain: any = {where: jest.fn(), limit: jest.fn(), get: janitorGet};
    chain.where.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    mockDb.collection.mockImplementation(() => ({where: jest.fn(() => chain)}));
  });

  it("finds stale PROCESSING docs whose object is missing and marks them REJECTED", async () => {
    const ref = {set: jest.fn().mockResolvedValue(undefined)};
    janitorGet.mockResolvedValue({
      docs: [
        {
          id: "video-1",
          data: () => ({storage_path: "games/g-1/videos/u1/clip.mp4", created_at: staleCreatedAt()}),
          ref,
        },
      ],
      size: 1,
    });
    mockFile.exists.mockResolvedValue([false]);

    await janitor();

    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "REJECTED",
        rejection_reason: "STALE_PROCESSING_NO_OBJECT",
      }),
      {merge: true}
    );
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("1 doc(s) PROCESSING")
    );
  });

  it("keeps PROCESSING docs whose object still exists", async () => {
    const ref = {set: jest.fn()};
    janitorGet.mockResolvedValue({
      docs: [
        {
          id: "video-1",
          data: () => ({storage_path: "games/g-1/videos/u1/clip.mp4", created_at: staleCreatedAt()}),
          ref,
        },
      ],
      size: 1,
    });
    mockFile.exists.mockResolvedValue([true]);

    await janitor();

    expect(ref.set).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("doc(s) PROCESSING")
    );
  });

  it("skips docs without a storage_path", async () => {
    const ref = {set: jest.fn()};
    janitorGet.mockResolvedValue({
      docs: [
        {id: "video-1", data: () => ({created_at: staleCreatedAt()}), ref},
      ],
      size: 1,
    });

    await janitor();

    expect(ref.set).not.toHaveBeenCalled();
    expect(mockFile.exists).not.toHaveBeenCalled();
  });

  it("treats a storage lookup failure as a missing object and reconciles", async () => {
    const ref = {set: jest.fn().mockResolvedValue(undefined)};
    janitorGet.mockResolvedValue({
      docs: [
        {
          id: "video-1",
          data: () => ({storage_path: "games/g-1/videos/u1/clip.mp4", created_at: staleCreatedAt()}),
          ref,
        },
      ],
      size: 1,
    });
    mockFile.exists.mockRejectedValue(new Error("storage unavailable"));

    await janitor();

    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({status: "REJECTED"}),
      {merge: true}
    );
  });

  it("does nothing on an empty scan", async () => {
    janitorGet.mockResolvedValue({docs: [], size: 0});

    await janitor();

    expect(mockFile.exists).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining("doc(s) PROCESSING")
    );
  });

  it("treats a created_at with only toDate as stale", async () => {
    const ref = {set: jest.fn().mockResolvedValue(undefined)};
    const old = Date.now() - 60 * 60 * 1000;
    janitorGet.mockResolvedValue({
      docs: [
        {
          id: "video-1",
          data: () => ({
            storage_path: "games/g-1/videos/u1/clip.mp4",
            created_at: {toDate: () => new Date(old)},
          }),
          ref,
        },
      ],
      size: 1,
    });
    mockFile.exists.mockResolvedValue([false]);

    await janitor();

    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({status: "REJECTED"}),
      {merge: true}
    );
  });

  it("treats a missing created_at as stale", async () => {
    const ref = {set: jest.fn().mockResolvedValue(undefined)};
    janitorGet.mockResolvedValue({
      docs: [
        {
          id: "video-1",
          data: () => ({storage_path: "games/g-1/videos/u1/clip.mp4"}),
          ref,
        },
      ],
      size: 1,
    });
    mockFile.exists.mockResolvedValue([false]);

    await janitor();

    expect(ref.set).toHaveBeenCalledWith(
      expect.objectContaining({status: "REJECTED"}),
      {merge: true}
    );
  });
});
