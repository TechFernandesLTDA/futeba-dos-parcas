const mockDb = jest.fn();

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
  Timestamp: class Timestamp {},
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/constants", () => ({
  FIRESTORE_BATCH_SAFE_LIMIT: 450,
  FIRESTORE_PAGINATION_LIMIT: 500,
  FUNCTION_REGION: "southamerica-east1",
}));

jest.mock("../src/_db", () => ({
  db: () => mockDb(),
}));

import {fetchDocsByFieldPaginated} from "../src/season/index";

describe("season pagination helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pagina coleções season-scoped até consumir todos os docs", async () => {
    const query: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn()
        .mockResolvedValueOnce({
          empty: false,
          size: 500,
          docs: Array.from({length: 500}, (_, index) => ({id: `doc-${index}`})),
        })
        .mockResolvedValueOnce({
          empty: false,
          size: 2,
          docs: [{id: "doc-500"}, {id: "doc-501"}],
        }),
    };

    mockDb.mockReturnValue({
      collection: jest.fn(() => query),
    });

    const docs = await fetchDocsByFieldPaginated(
      "season_participation",
      "season_id",
      "season-1"
    );

    expect(query.startAfter).toHaveBeenCalledTimes(1);
    expect(docs).toHaveLength(502);
    expect(docs[0].id).toBe("doc-0");
    expect(docs[501].id).toBe("doc-501");
  });
});
