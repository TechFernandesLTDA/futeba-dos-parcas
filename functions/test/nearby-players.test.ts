const mockDoc = jest.fn();
const mockGetAll = jest.fn();

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    doc: mockDoc,
    getAll: mockGetAll,
  })),
}));

jest.mock("../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  HttpsError: class HttpsError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: class Timestamp {},
}));

import {__testing} from "../src/social/nearby-players";

describe("nearby players batched reads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockImplementation((path: string) => ({path}));
  });

  it("loadFollowingSet usa getAll em lote e deduplica candidatos", async () => {
    mockGetAll.mockResolvedValueOnce([
      {exists: true},
      {exists: false},
    ]);

    const following = await __testing.loadFollowingSet(
      "user-1",
      ["candidate-1", "candidate-1", "candidate-2"]
    );

    expect(mockDoc).toHaveBeenCalledTimes(2);
    expect(mockDoc).toHaveBeenNthCalledWith(
      1,
      "users/user-1/following/candidate-1"
    );
    expect(mockDoc).toHaveBeenNthCalledWith(
      2,
      "users/user-1/following/candidate-2"
    );
    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(mockGetAll).toHaveBeenCalledWith(
      {path: "users/user-1/following/candidate-1"},
      {path: "users/user-1/following/candidate-2"}
    );
    expect([...following]).toEqual(["candidate-1"]);
  });

  it("loadPublicProfiles usa getAll e filtra perfis nao publicos", async () => {
    mockGetAll.mockResolvedValueOnce([
      {
        exists: true,
        data: () => ({
          is_searchable: true,
          name: "Ana",
          photo_url: "https://example.test/ana.jpg",
          followers_count: 7,
        }),
      },
      {
        exists: true,
        data: () => ({
          is_searchable: false,
          name: "Bruno",
        }),
      },
      {
        exists: true,
        data: () => ({
          is_searchable: true,
          deleted_at: {_seconds: 1},
          name: "Carla",
        }),
      },
      {exists: false},
    ]);

    const profiles = await __testing.loadPublicProfiles(
      ["candidate-1", "candidate-2", "candidate-3", "candidate-4"],
      new Set(["candidate-1"])
    );

    expect(mockDoc).toHaveBeenCalledTimes(4);
    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect([...profiles.keys()]).toEqual(["candidate-1"]);
    expect(profiles.get("candidate-1")).toMatchObject({
      id: "candidate-1",
      displayName: "Ana",
      photoUrl: "https://example.test/ana.jpg",
      followersCount: 7,
      isFollowing: true,
    });
  });

  it("helpers retornam vazio sem chamar getAll quando nao ha candidatos", async () => {
    await expect(
      __testing.loadFollowingSet("user-1", [])
    ).resolves.toEqual(new Set());
    await expect(
      __testing.loadPublicProfiles([], new Set())
    ).resolves.toEqual(new Map());

    expect(mockDoc).not.toHaveBeenCalled();
    expect(mockGetAll).not.toHaveBeenCalled();
  });
});
