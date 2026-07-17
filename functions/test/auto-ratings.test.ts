const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();
const mockUserUpdate = jest.fn();
const mockFallbackSet = jest.fn();
const mockCollection = jest.fn();

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_options, handler) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    collection: mockCollection,
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  calculateAutoRatingsFromStats,
  onStatisticsWrittenForAutoRatings,
} = require("../src/ratings/auto-ratings");

describe("auto-ratings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockImplementation((collectionName: string) => {
      if (collectionName === "users") {
        return {
          doc: jest.fn((docId: string) => ({
            update: (data: Record<string, unknown>) =>
              mockUserUpdate(docId, data),
          })),
        };
      }

      if (collectionName === "auto_rating_fallbacks") {
        return {
          doc: jest.fn((docId: string) => ({
            set: (
              data: Record<string, unknown>,
              options: Record<string, unknown>
            ) => mockFallbackSet(docId, data, options),
          })),
        };
      }

      return {
        doc: jest.fn(),
      };
    });
  });

  it("calcula ratings a partir de statistics e penaliza vermelho mais que amarelo", () => {
    const yellowOnly = calculateAutoRatingsFromStats({
      totalGames: 10,
      totalGoals: 5,
      totalAssists: 3,
      totalSaves: 8,
      gamesWon: 5,
      totalYellowCards: 1,
      totalRedCards: 0,
    });
    const redOnly = calculateAutoRatingsFromStats({
      totalGames: 10,
      totalGoals: 5,
      totalAssists: 3,
      totalSaves: 8,
      gamesWon: 5,
      totalYellowCards: 0,
      totalRedCards: 1,
    });

    expect(yellowOnly.sampleSize).toBe(10);
    expect(yellowOnly.striker).toBeGreaterThan(0);
    expect(redOnly.defender).toBeLessThan(yellowOnly.defender);
  });

  it("escreve auto-ratings no user doc quando o usuário existe", async () => {
    mockUserUpdate.mockResolvedValue(undefined);

    await onStatisticsWrittenForAutoRatings({
      params: {userId: "user-1"},
      data: {
        after: {
          exists: true,
          data: () => ({
            totalGames: 8,
            totalGoals: 4,
            totalAssists: 2,
            totalSaves: 6,
            gamesWon: 5,
            totalYellowCards: 1,
            totalRedCards: 0,
          }),
        },
      },
    });

    expect(mockUserUpdate).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        auto_rating_samples: 8,
        auto_striker_rating: expect.any(Number),
        auto_mid_rating: expect.any(Number),
        auto_defender_rating: expect.any(Number),
        auto_gk_rating: expect.any(Number),
      })
    );
    expect(mockFallbackSet).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalledWith(
      "Auto-ratings updated from statistics",
      expect.objectContaining({
        userId: "user-1",
        sampleSize: 8,
        writeMode: "user",
        writePath: "users/user-1",
      })
    );
  });

  it("persiste fallback operacional para statistics órfão sem perder o cálculo", async () => {
    mockUserUpdate.mockRejectedValue({
      code: 5,
      message: "No document to update: users/orphan-user",
    });
    mockFallbackSet.mockResolvedValue(undefined);

    await onStatisticsWrittenForAutoRatings({
      params: {userId: "orphan-user"},
      data: {
        after: {
          exists: true,
          data: () => ({
            totalGames: 12,
            totalGoals: 6,
            totalAssists: 5,
            totalSaves: 9,
            gamesWon: 7,
            totalYellowCards: 2,
            totalRedCards: 0,
          }),
        },
      },
    });

    expect(mockFallbackSet).toHaveBeenCalledWith(
      "orphan-user",
      expect.objectContaining({
        user_id: "orphan-user",
        source_document: "statistics/orphan-user",
        status: "PENDING_USER_RECONCILIATION",
        fallback_reason: "missing_user_document",
        auto_rating_samples: 12,
      }),
      {merge: true}
    );
    expect(mockWarn).toHaveBeenCalledWith(
      "Auto-ratings fallback persisted for orphan statistics",
      expect.objectContaining({
        userId: "orphan-user",
        sampleSize: 12,
        fallbackPath: "auto_rating_fallbacks/orphan-user",
      })
    );
    expect(mockInfo).toHaveBeenCalledWith(
      "Auto-ratings updated from statistics",
      expect.objectContaining({
        userId: "orphan-user",
        writeMode: "fallback",
        writePath: "auto_rating_fallbacks/orphan-user",
      })
    );
  });
});
