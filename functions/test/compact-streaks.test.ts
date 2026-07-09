const mockQuery = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({empty: true, docs: [], size: 0}),
};

const mockDb = jest.fn(() => ({
  collection: jest.fn((name: string) => {
    if (name === "maintenance_logs") {
      return {
        doc: jest.fn(() => ({
          set: jest.fn().mockResolvedValue(undefined),
        })),
      };
    }
    return mockQuery;
  }),
  batch: jest.fn(() => ({
    commit: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  })),
}));

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({})),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/_db", () => ({
  db: () => mockDb(),
}));

import {maintainStreaksData} from "../src/maintenance/compact-streaks";

describe("maintainStreaksData pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.where.mockReturnThis();
    mockQuery.orderBy.mockReturnThis();
    mockQuery.limit.mockReturnThis();
    mockQuery.startAfter.mockReturnThis();
    mockQuery.get.mockResolvedValue({empty: true, docs: [], size: 0});
  });

  it("pagina streaks com ordenacao deterministica", async () => {
    await maintainStreaksData({} as any);

    expect(mockQuery.orderBy).toHaveBeenNthCalledWith(1, "current_streak");
    expect(mockQuery.orderBy).toHaveBeenNthCalledWith(2, "__name__");
  });
});
