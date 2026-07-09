const mockGameDocGet = jest.fn();
const mockTxnGet = jest.fn();
const mockTxnDelete = jest.fn();
const mockTxnSet = jest.fn();
const mockRunTransaction = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockAuditDoc = jest.fn((id: string) => ({id, path: `audit_logs/${id}`}));

const queryChain: any = {
  where: mockWhere,
  limit: mockLimit,
};
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);

const mockCollection = jest.fn((name: string) => {
  if (name === "audit_logs") {
    return {
      doc: mockAuditDoc,
    };
  }

  return {
    doc: jest.fn((id: string) => ({
      id,
      get: mockGameDocGet,
    })),
    where: mockWhere,
    limit: mockLimit,
  };
});

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{name: "test"}],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
      collection: mockCollection,
      doc: jest.fn((path: string) => ({
        path,
        get: mockGameDocGet,
      })),
      runTransaction: mockRunTransaction,
    })),
  };
  return mockAdmin;
});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((_config: any, handler: any) => handler),
}));

import {onGameEventCreated} from "../src/voting/events-rate-limit";

describe("onGameEventCreated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunTransaction.mockImplementation(async (callback: any) =>
      callback({
        get: mockTxnGet,
        delete: mockTxnDelete,
        set: mockTxnSet,
      })
    );
  });

  it("usa doc ID deterministico para o audit log do rate limit", async () => {
    mockGameDocGet.mockResolvedValueOnce({
      data: () => ({owner_id: "owner-1"}),
    });
    mockTxnGet.mockResolvedValueOnce({
      size: 51,
    });

    await onGameEventCreated({
      data: {
        data: () => ({
          game_id: "game-1",
          created_by: "player-1",
        }),
        ref: {id: "evt-1"},
      },
      params: {eventId: "evt-1"},
    });

    expect(mockTxnDelete).toHaveBeenCalledWith(
      expect.objectContaining({id: "evt-1"})
    );
    expect(mockTxnSet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "game_event_rate_limit_evt-1",
      }),
      expect.objectContaining({
        type: "GAME_EVENTS_RATE_LIMIT_EXCEEDED",
        deleted_event_id: "evt-1",
      })
    );
  });
});
