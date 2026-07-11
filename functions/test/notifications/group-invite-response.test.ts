const mockSendAndSaveNotification = jest.fn().mockResolvedValue(true);
const mockRunTransaction = jest.fn();
const dedupClaimedIds = new Set<string>();
const dedupDocuments = new Map<string, Record<string, unknown>>();

function makeDedupDocMock(id: string) {
  return {
    id,
    create: jest.fn().mockImplementation(() => {
      if (dedupClaimedIds.has(id)) {
        const err = new Error("ALREADY_EXISTS") as Error & {code: number};
        err.code = 6;
        return Promise.reject(err);
      }
      dedupClaimedIds.add(id);
      return Promise.resolve();
    }),
  };
}

function makeDocRef(id: string) {
  return {
    id,
    collection: jest.fn(() => ({
      doc: jest.fn((nestedId: string) => makeDocRef(nestedId)),
    })),
  };
}

const mockCollection = jest.fn((name: string) => {
  if (name === "notif_dedup") {
    return {
      doc: (id: string) => makeDedupDocMock(id),
    };
  }

  return {
    doc: jest.fn((id: string) => makeDocRef(id)),
  };
});

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: mockCollection,
    runTransaction: mockRunTransaction,
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    delete: jest.fn(() => ({_type: "DeleteField"})),
  },
  Timestamp: {
    fromMillis: jest.fn((millis: number) => ({
      toMillis: () => millis,
    })),
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
  onDocumentCreated: jest.fn((_config: unknown, handler: unknown) => handler),
  onDocumentDeleted: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("../../src/notifications/helpers", () => ({
  NotificationType: {
    GROUP_INVITE_ACCEPTED: "GROUP_INVITE_ACCEPTED",
    GROUP_INVITE_DECLINED: "GROUP_INVITE_DECLINED",
  },
  sendNotificationToUsers: jest.fn(),
  sendAndSaveNotification: mockSendAndSaveNotification,
}));

import {
  onGroupInviteResponse,
} from "../../src/notifications/presence-notifications";

describe("onGroupInviteResponse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dedupClaimedIds.clear();
    dedupDocuments.clear();
    mockRunTransaction.mockImplementation(async (
      callback: (tx: unknown) => Promise<unknown>
    ) => callback({
      get: jest.fn(async (ref: {id: string}) => ({
        exists: dedupDocuments.has(ref.id),
        data: () => dedupDocuments.get(ref.id),
      })),
      set: jest.fn((
        ref: {id: string},
        data: Record<string, unknown>
      ) => {
        dedupDocuments.set(ref.id, {
          ...(dedupDocuments.get(ref.id) || {}),
          ...data,
        });
      }),
    }));
  });

  it("preserva membership ativa existente antes de notificar aceite", async () => {
    const txSet = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        get: jest.fn()
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({name: "Pelada FC"}),
          })
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({name: "Maria", photo_url: "photo.jpg"}),
          })
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({status: "ACTIVE", total_games: 3}),
          })
          .mockResolvedValueOnce({
            exists: false,
            data: () => undefined,
          }),
        set: txSet,
      })
    );

    await onGroupInviteResponse({
      id: "evt-preserve-existing-member",
      data: {
        before: {data: () => ({status: "PENDING"})},
        after: {
          data: () => ({
            status: "ACCEPTED",
            invited_by_id: "inviter1",
            invited_user_id: "user1",
            invited_user_name: "Maria",
            group_name: "Pelada FC",
            group_id: "group1",
          }),
        },
      },
      params: {inviteId: "inv-existing-member"},
    });

    expect(txSet).not.toHaveBeenCalled();
    expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
      "inviter1",
      expect.objectContaining({title: "Convite aceito!"}),
      "inv_resp_inv-existing-member_ACCEPTED",
    );
  });

  it("reativa membership inativa ao aceitar convite", async () => {
    const txSet = jest.fn();
    mockRunTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<void>) =>
      callback({
        get: jest.fn()
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({name: "Pelada FC", photo_url: "group.jpg"}),
          })
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({name: "Maria", level: 2}),
          })
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({status: "INACTIVE", total_games: 5}),
          })
          .mockResolvedValueOnce({
            exists: false,
            data: () => undefined,
          }),
        set: txSet,
      })
    );

    await onGroupInviteResponse({
      id: "evt-reactivate-inactive-member",
      data: {
        before: {data: () => ({status: "PENDING"})},
        after: {
          data: () => ({
            status: "ACCEPTED",
            invited_by_id: "inviter1",
            invited_user_id: "user1",
            invited_user_name: "Maria",
            group_name: "Pelada FC",
            group_id: "group1",
          }),
        },
      },
      params: {inviteId: "inv-inactive-member"},
    });

    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({id: "user1"}),
      expect.objectContaining({
        status: "ACTIVE",
        total_games: 5,
        level: 2,
      }),
      {merge: true},
    );
    expect(txSet).toHaveBeenCalledTimes(2);
  });

  it("ignora reentrega recusada ja reivindicada", async () => {
    const event = {
      id: "evt-declined-dedup",
      data: {
        before: {data: () => ({status: "PENDING"})},
        after: {
          data: () => ({
            status: "DECLINED",
            invited_by_id: "inviter1",
            invited_user_name: "Maria",
            group_name: "Pelada FC",
          }),
        },
      },
      params: {inviteId: "inv-declined-dedup"},
    };

    await onGroupInviteResponse(event);
    await onGroupInviteResponse(event);

    expect(mockSendAndSaveNotification).toHaveBeenCalledTimes(1);
  });
});
