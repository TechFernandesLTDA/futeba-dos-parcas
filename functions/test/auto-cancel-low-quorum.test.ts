const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockSendNotificationToUser = jest.fn().mockResolvedValue(true);
const mockSaveNotificationToFirestore = jest.fn().mockResolvedValue("notif-id");
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();

const queryChain: any = { where: mockWhere, get: mockCollectionGet };
mockWhere.mockReturnValue(queryChain);

const mockDoc = jest.fn((id: string) => ({
  id,
  get: jest.fn(),
  update: mockDocUpdate,
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  get: mockCollectionGet,
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
};
const mockTimestamp = {
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
};
const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
  FieldValue: mockFieldValue,
  Timestamp: mockTimestamp,
}));

(mockFirestore as any).FieldValue = mockFieldValue;
(mockFirestore as any).Timestamp = mockTimestamp;

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_c: any, h: any) => h),
}));

jest.mock("../src/notifications", () => ({
  sendNotificationToUser: mockSendNotificationToUser,
  sendNotificationToUsers: mockSendNotificationToUsers,
  saveNotificationToFirestore: mockSaveNotificationToFirestore,
  NotificationType: {
    GAME_CANCELLED: "GAME_CANCELLED",
    GAME_REMINDER: "GAME_REMINDER",
    GAME_SUMMON: "GAME_SUMMON",
  },
}));

import { autoCancelLowQuorum } from "../src/reminders";

describe("autoCancelLowQuorum", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cancela jogo CONFIRMED com poucos jogadores dentro de 2h", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "game1",
            ref: { update: mockDocUpdate },
            data: () => ({
              status: "CONFIRMED",
              dateTime: { toDate: () => futureDate },
              location_name: "Campo 1",
              date: "2026-05-25",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ user_id: "user1" }) },
          { data: () => ({ user_id: "user2" }) },
        ],
        size: 2,
      });

    await autoCancelLowQuorum();

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "CANCELLED",
        auto_cancelled: true,
        cancel_reason: "Baixo quórum",
      })
    );
    expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
      ["user1", "user2"],
      expect.objectContaining({ title: "Jogo cancelado" })
    );
  });

  it("nao cancela jogo com jogadores suficientes", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "game1",
            ref: { update: mockDocUpdate },
            data: () => ({
              status: "CONFIRMED",
              dateTime: { toDate: () => futureDate },
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({
        docs: Array.from({ length: 8 }, (_, i) => ({
          data: () => ({ user_id: `user${i}` }),
        })),
        size: 8,
      });

    await autoCancelLowQuorum();

    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("pula jogos ja auto-cancelados", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockCollectionGet.mockResolvedValueOnce({
      docs: [
        {
          id: "game1",
          ref: { update: mockDocUpdate },
          data: () => ({
            status: "CONFIRMED",
            dateTime: { toDate: () => futureDate },
            auto_cancelled: true,
          }),
        },
      ],
      size: 1,
    });

    await autoCancelLowQuorum();

    expect(mockDocUpdate).not.toHaveBeenCalled();
  });

  it("usa min_players customizado do jogo", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "game1",
            ref: { update: mockDocUpdate },
            data: () => ({
              status: "CONFIRMED",
              dateTime: { toDate: () => futureDate },
              min_players: 4,
              location_name: "Campo",
              date: "2026-05-25",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({
        docs: [
          { data: () => ({ user_id: "user1" }) },
          { data: () => ({ user_id: "user2" }) },
          { data: () => ({ user_id: "user3" }) },
        ],
        size: 3,
      });

    await autoCancelLowQuorum();

    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "CANCELLED" })
    );
  });

  it("nao cancela quando nao ha jogos na janela", async () => {
    mockCollectionGet.mockResolvedValueOnce({
      docs: [],
      size: 0,
    });

    await autoCancelLowQuorum();

    expect(mockDocUpdate).not.toHaveBeenCalled();
  });
});
