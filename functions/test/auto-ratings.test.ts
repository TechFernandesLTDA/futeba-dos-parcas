jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_options, handler) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(undefined),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {calculateAutoRatingsFromStats} = require("../src/ratings/auto-ratings");

describe("calculateAutoRatingsFromStats", () => {
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
});
