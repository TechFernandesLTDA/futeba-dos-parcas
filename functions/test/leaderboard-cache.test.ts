const mockBatchDelete = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn();
const mockCollection = jest.fn();

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: mockCollection,
    batch: jest.fn(() => ({
      delete: mockBatchDelete,
      set: mockBatchSet,
      commit: mockBatchCommit,
    })),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
  Timestamp: class Timestamp {
    private readonly ms: number;

    constructor(ms = 0) {
      this.ms = ms;
    }

    static fromMillis(ms: number) {
      return new Timestamp(ms);
    }

    toMillis() {
      return this.ms;
    }
  },
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {},
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 1,
    resetAt: new Date(),
  }),
}));

jest.mock("../src/validation/index", () => ({
  sanitizeText: jest.fn((value: string) => value),
}));

jest.mock("../src/error-messages", () => ({
  ERROR_MSGS: {},
}));

jest.mock("../src/constants", () => ({
  FIRESTORE_BATCH_SAFE_LIMIT: 450,
  FIRESTORE_WHERE_IN_LIMIT: 10,
  FUNCTION_REGION: "southamerica-east1",
  GAME_GENDERS: ["MALE", "FEMALE", "MIXED"],
}));

import {__testing} from "../src/cache/leaderboard-cache";

describe("leaderboard-cache batching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockImplementation((id: string) => ({
      id,
      path: `cache_leaderboard/${id}`,
      collection: mockCollection,
    }));
    mockCollection.mockImplementation(() => ({
      doc: mockDoc,
    }));
  });

  it("deleteDocsInBatches divide deletes acima de 500 em batches seguros", async () => {
    const fakeDb: any = {
      batch: jest.fn(() => ({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
    };

    const docs = Array.from({length: 905}, (_, index) => ({
      ref: {path: `cache_leaderboard/doc-${index}`},
    })) as any[];

    const committedBatches =
      await __testing.deleteDocsInBatches(fakeDb, docs as any);

    expect(committedBatches).toBe(3);
    expect(fakeDb.batch).toHaveBeenCalledTimes(3);
    expect(mockBatchDelete).toHaveBeenCalledTimes(905);
    expect(mockBatchCommit).toHaveBeenCalledTimes(3);
  });

  it("writeLeaguePlayersDirectoryCache divide diretorio em chunks", async () => {
    const players = Array.from({length: 501}, (_, index) => ({
      id: `player-${index}`,
      userId: `user-${index}`,
      userName: `Jogador ${index}`,
      userPhoto: index === 0 ? undefined : `https://img.test/${index}.jpg`,
      level: 1,
      points: index,
      gamesPlayed: 0,
      wins: 0,
      goals: 0,
      assists: 0,
      mvpCount: 0,
      division: "BRONZE",
      experiencePoints: index,
      canReceiveInvites: true,
    }));

    await __testing.writeLeaguePlayersDirectoryCache(
      "league_players__season-1__global__ALL",
      "season-1",
      null,
      "ALL",
      players
    );

    expect(mockBatchSet).toHaveBeenCalledTimes(4);
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: "cache_leaderboard/league_players__season-1__global__ALL",
      }),
      expect.objectContaining({
        kind: "league_players_directory",
        season_id: "season-1",
        group_id: null,
        gender_key: "ALL",
        count: 501,
        chunk_count: 3,
      })
    );
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({path: "cache_leaderboard/0000"}),
      expect.objectContaining({
        index: 0,
        players: expect.arrayContaining([
          expect.objectContaining({userId: "user-0"}),
        ]),
      })
    );
    const firstChunkPayload = mockBatchSet.mock.calls[1][1];
    expect(firstChunkPayload.players[0]).not.toHaveProperty("userPhoto");
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({path: "cache_leaderboard/0002"}),
      expect.objectContaining({
        index: 2,
        players: [expect.objectContaining({userId: "user-500"})],
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });
});
