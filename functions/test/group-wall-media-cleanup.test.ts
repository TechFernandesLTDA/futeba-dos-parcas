const mockDelete = jest.fn();
const mockFile = jest.fn(() => ({
  delete: mockDelete,
}));
const mockBucket = jest.fn(() => ({
  file: mockFile,
}));
const mockGetStorage = jest.fn(() => ({
  bucket: mockBucket,
}));
const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}));

jest.mock("firebase-admin/storage", () => ({
  getStorage: mockGetStorage,
}));

import {getStorage} from "firebase-admin/storage";
import {
  isManagedWallMediaPath,
  onGroupWallPostSoftDeletedCleanupMedia,
} from "../src/groups/wall-media-cleanup";

type WallCleanupEvent = {
  data?: {
    before: {data: () => Record<string, unknown> | undefined};
    after: {data: () => Record<string, unknown> | undefined};
  };
  params: {groupId: string; postId: string};
};

function buildEvent(params: {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}): WallCleanupEvent {
  return {
    data: {
      before: {data: () => params.before},
      after: {data: () => params.after},
    },
    params: {
      groupId: "group-1",
      postId: "post-1",
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(undefined);
});

describe("group wall media cleanup helper", () => {
  test("aceita path legado do web dentro do grupo", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/1710000000000-file.jpg"
      )
    ).toBe(true);
  });

  test("aceita path Android com uid intermediário", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/uid-player-a-001/file.webp"
      )
    ).toBe(true);
  });

  test("rejeita path fora do prefixo do grupo", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-2/wall_media/__draft__/file.jpg"
      )
    ).toBe(false);
  });

  test("rejeita path com traversal ou extensão não permitida", () => {
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/../secrets.txt"
      )
    ).toBe(false);
    expect(
      isManagedWallMediaPath(
        "group-1",
        "groups/group-1/wall_media/__draft__/file.gif"
      )
    ).toBe(false);
  });
});

describe("onGroupWallPostSoftDeletedCleanupMedia", () => {
  test("ignora evento sem documento after", async () => {
    await expect(
      onGroupWallPostSoftDeletedCleanupMedia({
        data: {
          before: {data: () => undefined},
          after: {data: () => undefined},
        },
        params: {groupId: "group-1", postId: "post-1"},
      } as WallCleanupEvent)
    ).resolves.toBeUndefined();

    expect(mockGetStorage).not.toHaveBeenCalled();
  });

  test("ignora quando o post ainda não foi soft-deletado ou já estava deletado", async () => {
    await expect(
      onGroupWallPostSoftDeletedCleanupMedia(
        buildEvent({
          before: {deleted_at: "2026-07-05T00:00:00.000Z"},
          after: {
            deleted_at: "2026-07-05T00:05:00.000Z",
            media_path: "groups/group-1/wall_media/__draft__/file.jpg",
          },
        })
      )
    ).resolves.toBeUndefined();

    await expect(
      onGroupWallPostSoftDeletedCleanupMedia(
        buildEvent({
          before: {deleted_at: null},
          after: {
            deleted_at: null,
            media_path: "groups/group-1/wall_media/__draft__/file.jpg",
          },
        })
      )
    ).resolves.toBeUndefined();

    expect(mockGetStorage).not.toHaveBeenCalled();
  });

  test("loga warning e não apaga quando todos os paths são inválidos", async () => {
    await expect(
      onGroupWallPostSoftDeletedCleanupMedia(
        buildEvent({
          before: {deleted_at: null},
          after: {
            deleted_at: "2026-07-05T00:05:00.000Z",
            media_path: "groups/group-2/wall_media/__draft__/file.jpg",
            thumbnail_path: "../thumb.jpg",
          },
        })
      )
    ).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalledTimes(2);
    expect(mockGetStorage).not.toHaveBeenCalled();
  });

  test("remove media_path e thumbnail_path válidos com ignoreNotFound", async () => {
    await expect(
      onGroupWallPostSoftDeletedCleanupMedia(
        buildEvent({
          before: {deleted_at: null},
          after: {
            deleted_at: "2026-07-05T00:05:00.000Z",
            media_path: "groups/group-1/wall_media/__draft__/media.jpg",
            thumbnail_path: "groups/group-1/wall_media/__draft__/thumb.webp",
          },
        })
      )
    ).resolves.toBeUndefined();

    expect(getStorage).toHaveBeenCalledTimes(1);
    expect(mockBucket).toHaveBeenCalledTimes(1);
    expect(mockFile).toHaveBeenNthCalledWith(
      1,
      "groups/group-1/wall_media/__draft__/media.jpg"
    );
    expect(mockFile).toHaveBeenNthCalledWith(
      2,
      "groups/group-1/wall_media/__draft__/thumb.webp"
    );
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenNthCalledWith(1, {ignoreNotFound: true});
    expect(mockDelete).toHaveBeenNthCalledWith(2, {ignoreNotFound: true});
    expect(mockInfo).toHaveBeenCalledWith(
      "[GROUP_WALL_MEDIA] Midia removida após soft-delete do post",
      expect.objectContaining({
        groupId: "group-1",
        postId: "post-1",
        managedPaths: [
          "groups/group-1/wall_media/__draft__/media.jpg",
          "groups/group-1/wall_media/__draft__/thumb.webp",
        ],
      })
    );
  });

  test("propaga erro de storage após logar contexto", async () => {
    const storageError = new Error("boom");
    mockDelete.mockRejectedValueOnce(storageError);

    await expect(
      onGroupWallPostSoftDeletedCleanupMedia(
        buildEvent({
          before: {deleted_at: null},
          after: {
            deleted_at: "2026-07-05T00:05:00.000Z",
            media_path: "groups/group-1/wall_media/__draft__/media.jpg",
            thumbnail_path: null,
          },
        })
      )
    ).rejects.toThrow("boom");

    expect(mockError).toHaveBeenCalledWith(
      "[GROUP_WALL_MEDIA] Falha ao remover mídia do mural",
      expect.objectContaining({
        groupId: "group-1",
        postId: "post-1",
        managedPaths: ["groups/group-1/wall_media/__draft__/media.jpg"],
        error: storageError,
      })
    );
  });
});
