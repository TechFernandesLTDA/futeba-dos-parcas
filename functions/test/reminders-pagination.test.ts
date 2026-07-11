const mockSendNotificationToUser = jest.fn();
const mockSendNotificationToUsers = jest.fn();
const mockSaveNotificationToFirestore = jest.fn();
const mockDb = jest.fn();

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

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

jest.mock("../src/constants", () => ({
  FUNCTION_REGION: "southamerica-east1",
  FIRESTORE_PAGINATION_LIMIT: 500,
}));

jest.mock("../src/notifications", () => ({
  sendNotificationToUser: mockSendNotificationToUser,
  sendNotificationToUsers: mockSendNotificationToUsers,
  saveNotificationToFirestore: mockSaveNotificationToFirestore,
  NotificationType: {
    GAME_REMINDER: "GAME_REMINDER",
    GAME_INVITE: "GAME_INVITE",
  },
}));

jest.mock("../src/notifications/notification-messages", () => ({
  REMINDER_NOTIFICATIONS: {},
  GAME_NOTIFICATIONS: {},
}));

jest.mock("../src/notifications/preferences", () => ({
  getNotificationSettings: jest.fn(),
  isMuted: jest.fn(() => false),
  isGroupMuted: jest.fn(() => false),
}));

jest.mock("../src/_db", () => ({
  db: () => mockDb(),
}));

import {fetchGroupMembersWithoutConfirmation} from "../src/reminders";

describe("reminders pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("pagina members, confirmations e tracking antes de decidir quem ainda precisa de lembrete", async () => {
    const membersQuery: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn()
        .mockResolvedValueOnce({
          empty: false,
          size: 100,
          docs: Array.from({length: 100}, (_, index) => ({
            id: `member-${index}`,
            data: () => ({
              user_id: `member-${index}`,
              status: "ACTIVE",
            }),
          })),
        })
        .mockResolvedValueOnce({
          empty: false,
          size: 2,
          docs: [
            {
              id: "member-100",
              data: () => ({user_id: "member-100", status: "ACTIVE"}),
            },
            {
              id: "member-101",
              data: () => ({user_id: "member-101", status: "ACTIVE"}),
            },
          ],
        }),
    };

    const confirmationsQuery: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn()
        .mockResolvedValueOnce({
          empty: false,
          size: 500,
          docs: Array.from({length: 500}, (_, index) => ({
            data: () => ({
              user_id:
                index < 99 ?
                  `member-${index}` :
                  `outsider-${index}`,
            }),
          })),
        })
        .mockResolvedValueOnce({
          empty: false,
          size: 2,
          docs: [
            {data: () => ({user_id: "member-100", reminder_24h_sent: true})},
            {data: () => ({user_id: "outsider-500"})},
          ],
        }),
    };

    const trackingQuery: any = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get: jest.fn()
        .mockResolvedValueOnce({
          empty: false,
          size: 1,
          docs: [
            {data: () => ({user_id: "member-100"})},
          ],
        }),
    };

    mockDb.mockReturnValue({
      collection: jest.fn((name: string) => {
        if (name === "groups") {
          return {
            doc: jest.fn(() => ({
              collection: jest.fn(() => membersQuery),
            })),
          };
        }

        if (name === "confirmations") {
          return confirmationsQuery;
        }

        if (name === "reminder_tracking") {
          return trackingQuery;
        }

        throw new Error(`Unexpected collection ${name}`);
      }),
    });

    const result =
      await fetchGroupMembersWithoutConfirmation(
        "game-1",
        "group-1",
        "24h"
      );

    expect(membersQuery.startAfter).toHaveBeenCalledTimes(1);
    expect(confirmationsQuery.startAfter).toHaveBeenCalledTimes(1);
    expect(trackingQuery.startAfter).not.toHaveBeenCalled();
    expect(result).toEqual(["member-99", "member-101"]);
  });
});
