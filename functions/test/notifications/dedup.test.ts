const mockDocCreate = jest.fn().mockResolvedValue(undefined);
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocDelete = jest.fn().mockResolvedValue(undefined);

const mockDoc = jest.fn((id: string) => ({
  id,
  create: mockDocCreate,
  update: mockDocUpdate,
  get: mockDocGet,
  delete: mockDocDelete,
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
};

const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
}));

(mockFirestore as any).FieldValue = mockFieldValue;

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
}));

import {
  claimNotificationEventOnce,
  completeNotificationEvent,
} from "../../src/notifications/dedup";
import {resetDb} from "../../src/_db";

describe("notification dedup ttl", () => {
  const fixedNow = new Date("2026-07-17T12:00:00.000Z").getTime();

  beforeEach(() => {
    jest.clearAllMocks();
    resetDb();
    jest.spyOn(Date, "now").mockReturnValue(fixedNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("mantem lease curta para claims pendentes", async () => {
    await expect(
      claimNotificationEventOnce("claim-pending")
    ).resolves.toBe(true);

    expect(mockDocCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        expires_at: expect.any(Date),
      })
    );

    const expiresAt =
      mockDocCreate.mock.calls[0][0].expires_at as Date;
    expect(expiresAt.getTime()).toBe(
      fixedNow + 10 * 60 * 1000
    );
  });

  it("estende expires_at por 7 dias ao concluir o evento", async () => {
    await completeNotificationEvent("claim-completed");

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        expires_at: expect.any(Date),
      })
    );

    const expiresAt =
      mockDocUpdate.mock.calls[0][0].expires_at as Date;
    expect(expiresAt.getTime()).toBe(
      fixedNow + 7 * 24 * 60 * 60 * 1000
    );
  });
});
