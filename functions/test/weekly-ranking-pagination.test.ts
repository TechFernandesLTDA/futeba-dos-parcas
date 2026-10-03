const mockGamesQuery = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({empty: true, docs: [], size: 0}),
};

const mockDreamTeamQuery = {
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: jest.fn()
    .mockResolvedValueOnce({
      empty: false,
      size: 1,
      docs: [{
        id: "current",
        ref: {parent: {parent: {id: "owner-1"}}},
        data: () => ({players: [{userId: "player-1"}]}),
      }],
    })
    .mockResolvedValueOnce({
      empty: true,
      size: 0,
      docs: [],
    }),
};

const mockUsersCollection = {
  doc: jest.fn(() => ({
    get: jest.fn().mockResolvedValue({
      data: () => ({name: "Owner"}),
    }),
  })),
};

const mockWeeklyRankingDoc = {
  set: jest.fn().mockResolvedValue(undefined),
};

jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({toDate: () => date})),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/notifications/helpers", () => ({
  sendNotificationToUsers: jest.fn(),
  NotificationType: {
    RANKING_CHANGED: "RANKING_CHANGED",
  },
}));

// IMPORTANT: mantém o módulo real de constants (spread de requireActual).
// src/badges/user-badge-docs.ts → src/xp/pipeline.ts avalia
// `XP_ACTIONS.PARTICIPATION` na carga do módulo; um factory mock que
// substitui TODO o módulo deixa XP_ACTIONS undefined e quebra a suíte
// inteira (inclusive o dry run do Stryker, que roda todos os testes).
jest.mock("../src/constants", () => ({
  ...jest.requireActual("../src/constants"),
  FUNCTION_REGION: "southamerica-east1",
}));

const mockDb = jest.fn(() => ({
  collection: jest.fn((name: string) => {
    if (name === "games") return mockGamesQuery;
    if (name === "confirmations") {
      return {
        where: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({docs: [], empty: true}),
          }),
        }),
      };
    }
    if (name === "teams") {
      return {
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({docs: [], empty: true}),
        }),
      };
    }
    if (name === "users") return mockUsersCollection;
    if (name === "weekly-rankings") {
      return {doc: jest.fn(() => mockWeeklyRankingDoc)};
    }
    throw new Error(`Unexpected collection ${name}`);
  }),
  collectionGroup: jest.fn(() => mockDreamTeamQuery),
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => mockDb()),
}));

import {processWeeklyRanking} from "../src/growth/weekly-ranking";

describe("processWeeklyRanking pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGamesQuery.where.mockReturnThis();
    mockGamesQuery.limit.mockReturnThis();
    mockGamesQuery.get.mockResolvedValue({
      empty: false,
      size: 1,
      docs: [{
        id: "game-1",
        data: () => ({
          status: "FINISHED",
          date: "2026-06-10",
        }),
      }],
    });
    mockDreamTeamQuery.orderBy.mockReturnThis();
    mockDreamTeamQuery.limit.mockReturnThis();
    mockDreamTeamQuery.startAfter.mockReturnThis();
    mockDreamTeamQuery.get
      .mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [{
          id: "current",
          ref: {parent: {parent: {id: "owner-1"}}},
          data: () => ({players: [{userId: "player-1"}]}),
        }],
      })
      .mockResolvedValueOnce({
        empty: true,
        size: 0,
        docs: [],
      });
  });

  it("pagina collectionGroup dream_team com orderBy explicito por documentId", async () => {
    await processWeeklyRanking();

    expect(mockDreamTeamQuery.orderBy).toHaveBeenCalledWith("__name__");
  });
});
