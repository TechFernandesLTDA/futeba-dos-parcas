/**
 * Testes do trigger onJoinRequestApproved (issue #517 Phase 2).
 *
 * Cobre:
 * - PENDING -> APPROVED dispara criacao de member + counter + notification
 * - PENDING -> REJECTED nao dispara nada
 * - Re-aprovacao (member ja existe) e idempotente
 * - Mismatch user_id no doc loga warn e aborta
 * - Falha de notification nao bloqueia o member create
 */

const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue([]);
const mockBatch = jest.fn(() => ({
  set: mockBatchSet,
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

const mockMemberGet = jest.fn().mockResolvedValue({exists: false});
const mockGroupGet = jest.fn().mockResolvedValue({
  exists: true,
  data: () => ({
    name: "Pelada Vila",
    photo_url: "https://example.com/g.jpg",
    member_count: 5,
  }),
});

const mockDoc = jest.fn((path: string) => {
  if (path?.includes("/members/")) {
    return {get: mockMemberGet};
  }
  return {get: mockGroupGet};
});

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({_type: "Increment", value: n})),
  };
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      doc: mockDoc,
      batch: mockBatch,
    })),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue = mockFieldValue;
  return mockAdmin;
});

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSendNotification = jest.fn().mockResolvedValue(true);
jest.mock("../src/notifications/helpers", () => ({
  sendNotificationToUser: mockSendNotification,
  NotificationType: {
    GROUP_JOIN_APPROVED: "GROUP_JOIN_APPROVED",
  },
}));

jest.mock("../src/constants", () => ({
  FUNCTION_REGION: "us-central1",
}));

import {onJoinRequestApproved} from "../src/groups/join-requests";

interface MockEvent {
  data: {
    before: {data: () => unknown};
    after: {data: () => unknown};
  };
  params: {groupId: string; userId: string};
}

function makeEvent(beforeData: unknown, afterData: unknown): MockEvent {
  return {
    data: {
      before: {data: () => beforeData},
      after: {data: () => afterData},
    },
    params: {groupId: "g1", userId: "u1"},
  };
}

describe("onJoinRequestApproved", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMemberGet.mockResolvedValue({exists: false});
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Pelada Vila",
        photo_url: "https://example.com/g.jpg",
        member_count: 5,
      }),
    });
  });

  it("PENDING -> APPROVED cria member, incrementa counter e envia push", async () => {
    const event = makeEvent(
      {user_id: "u1", user_name: "User One", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        user_photo: "https://example.com/u.jpg",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatch).toHaveBeenCalled();
    // 1 set member + 1 update group counter + 1 set user/groups
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
    expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockSendNotification).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        type: "GROUP_JOIN_APPROVED",
        title: expect.stringContaining("Pelada Vila"),
      })
    );
  });

  it("PENDING -> REJECTED nao faz nada", async () => {
    const event = makeEvent(
      {user_id: "u1", user_name: "User One", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "REJECTED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatch).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("APPROVED -> APPROVED (no-op update) nao reprocessa", async () => {
    const event = makeEvent(
      {user_id: "u1", user_name: "User One", status: "APPROVED"},
      {user_id: "u1", user_name: "User One", status: "APPROVED"}
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("idempotente: se member ja existe, nao reprocessa", async () => {
    mockMemberGet.mockResolvedValue({exists: true});

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("aborta se user_id no doc nao bate com event params", async () => {
    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "OUTRO_UID", // mismatch
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("aborta se nao tem responded_by", async () => {
    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {user_id: "u1", user_name: "User One", status: "APPROVED"}
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("aborta se grupo nao existe", async () => {
    mockGroupGet.mockResolvedValue({exists: false});

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("falha de push notification nao bloqueia member create", async () => {
    mockSendNotification.mockRejectedValueOnce(new Error("FCM down"));

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await expect(
      (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event)
    ).resolves.not.toThrow();

    expect(mockBatchCommit).toHaveBeenCalled();
  });
});
