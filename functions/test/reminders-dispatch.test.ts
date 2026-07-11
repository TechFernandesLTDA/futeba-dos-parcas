const mockSendNotificationToUser = jest.fn().mockResolvedValue(true);
const mockSendNotificationToUsers = jest.fn().mockResolvedValue(0);
const mockSaveNotificationToFirestore = jest.fn().mockResolvedValue(undefined);
const mockGetNotificationSettings = jest.fn();
const mockIsMuted = jest.fn().mockReturnValue(false);
const mockIsGroupMuted = jest.fn().mockReturnValue(false);
const mockRunTransaction = jest.fn();
const mockCollection = jest.fn((name: string) => ({
  doc: jest.fn((id: string) => ({name, id, path: `${name}/${id}`})),
}));
const mockDb = jest.fn(() => ({
  collection: mockCollection,
  runTransaction: mockRunTransaction,
}));
const mockLoggerError = jest.fn();

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: mockLoggerError,
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {documentId: jest.fn(() => "__name__")},
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({toDate: () => date})),
  },
}));

jest.mock("../src/constants", () => ({
  FIRESTORE_PAGINATION_LIMIT: 500,
  FUNCTION_REGION: "southamerica-east1",
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

jest.mock("../src/notifications/notification-messages", () => {
  const message = (label: string) => ({
    title: {"pt-BR": jest.fn(() => `Lembrete ${label}`)},
    body: {"pt-BR": jest.fn(({formattedDate}: {formattedDate: string}) =>
      `Jogo ${formattedDate}`)},
  });
  return {
    REMINDER_NOTIFICATIONS: {
      GAME_24H: message("24h"),
      GAME_2H: message("2h"),
      GAME_1H: message("1h"),
    },
    GAME_NOTIFICATIONS: {},
  };
});

jest.mock("../src/notifications/preferences", () => ({
  getNotificationSettings: mockGetNotificationSettings,
  isMuted: mockIsMuted,
  isGroupMuted: mockIsGroupMuted,
}));

jest.mock("../src/_db", () => ({
  db: mockDb,
}));

jest.mock("../src/utils/scheduler-lock", () => ({
  acquireSchedulerLock: jest.fn(),
  releaseSchedulerLock: jest.fn(),
}));

import {
  canSendReminderToUser,
  dispatchReminders,
  markReminderSent,
  type GameForReminder,
} from "../src/reminders";

const defaultSettings = {
  pushEnabled: true,
  gameReminders: true,
  muteUntil: null,
};

const game: GameForReminder = {
  id: "game-1",
  dateTime: {toDate: () => new Date("2026-07-12T20:00:00.000Z")} as never,
  date: "2026-07-12",
  time: "17:00",
  status: "SCHEDULED",
  group_id: "group-1",
  location_name: "Arena Central",
};

function transactionForClaim(options: {
  confirmationExists?: boolean;
  alreadySent?: boolean;
  trackingExists?: boolean;
} = {}) {
  const update = jest.fn();
  const set = jest.fn();
  mockRunTransaction.mockImplementation(async (callback: any) => callback({
    get: jest.fn(async (ref: {name: string}) => ref.name === "confirmations" ? {
      exists: options.confirmationExists ?? true,
      data: () => options.alreadySent ? {reminder_24h_sent: true} : {},
    } : {
      exists: options.trackingExists ?? false,
      data: () => undefined,
    }),
    update,
    set,
  }));
  return {update, set};
}

describe("reminder consent, claim and dispatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNotificationSettings.mockResolvedValue(defaultSettings);
    mockIsMuted.mockReturnValue(false);
    mockIsGroupMuted.mockReturnValue(false);
    mockSendNotificationToUser.mockResolvedValue(true);
    mockSaveNotificationToFirestore.mockResolvedValue(undefined);
    transactionForClaim();
  });

  it("aplica todos os bloqueios de consentimento e falha fechado", async () => {
    mockGetNotificationSettings.mockResolvedValueOnce({
      ...defaultSettings,
      pushEnabled: false,
    });
    await expect(canSendReminderToUser("push-off", "group-1")).resolves.toBe(false);

    mockGetNotificationSettings.mockResolvedValueOnce({
      ...defaultSettings,
      gameReminders: false,
    });
    await expect(canSendReminderToUser("reminders-off", "group-1")).resolves.toBe(false);

    mockIsMuted.mockReturnValueOnce(true);
    mockGetNotificationSettings.mockResolvedValueOnce({
      ...defaultSettings,
      muteUntil: new Date("2026-07-12T20:00:00.000Z"),
    });
    await expect(canSendReminderToUser("muted", "group-1")).resolves.toBe(false);

    mockIsGroupMuted.mockReturnValueOnce(true);
    await expect(canSendReminderToUser("group-muted", "group-1")).resolves.toBe(false);

    await expect(canSendReminderToUser("enabled", "group-1")).resolves.toBe(true);

    mockGetNotificationSettings.mockRejectedValueOnce(new Error("Firestore unavailable"));
    await expect(canSendReminderToUser("read-error", "group-1")).resolves.toBe(false);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("fail-closed"),
      expect.any(Error),
    );
  });

  it("marca confirmação existente dentro da transação", async () => {
    const {update, set} = transactionForClaim({confirmationExists: true});

    await expect(markReminderSent("game-1", "user-1", "24h")).resolves.toBe(true);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({path: "confirmations/game-1_user-1"}),
      expect.objectContaining({reminder_24h_sent: true}),
    );
    expect(set).not.toHaveBeenCalled();
  });

  it("usa tracking determinístico sem criar confirmação falsa", async () => {
    const {update, set} = transactionForClaim({confirmationExists: false});

    await expect(markReminderSent("game-1", "guest-1", "1h")).resolves.toBe(true);

    expect(update).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({path: "reminder_tracking/game-1_guest-1_1h"}),
      expect.objectContaining({
        game_id: "game-1",
        user_id: "guest-1",
        reminder_type: "1h",
        status: "CLAIMED",
      }),
    );
  });

  it("recusa claim duplicado por confirmação ou tracking", async () => {
    transactionForClaim({alreadySent: true});
    await expect(markReminderSent("game-1", "user-1", "24h")).resolves.toBe(false);

    transactionForClaim({trackingExists: true});
    await expect(markReminderSent("game-1", "guest-1", "24h")).resolves.toBe(false);
  });

  it("propaga falha da transação para impedir envio sem claim", async () => {
    const transactionError = new Error("transaction aborted");
    mockRunTransaction.mockRejectedValue(transactionError);

    await expect(markReminderSent("game-1", "user-1", "2h"))
      .rejects.toBe(transactionError);
  });

  it("envia em mais de um lote e não relê preferências após o claim", async () => {
    const userIds = Array.from({length: 26}, (_, index) => `user-${index}`);

    await expect(dispatchReminders(userIds, game, "24h")).resolves.toBe(26);

    expect(mockGetNotificationSettings).toHaveBeenCalledTimes(26);
    expect(mockSaveNotificationToFirestore).toHaveBeenCalledTimes(26);
    expect(mockSendNotificationToUser).toHaveBeenCalledTimes(26);
  });

  it("não envia quando consentimento, claim ou persistência falham", async () => {
    mockGetNotificationSettings.mockResolvedValueOnce({
      ...defaultSettings,
      pushEnabled: false,
    });
    await expect(dispatchReminders(["push-off"], game, "24h")).resolves.toBe(0);

    transactionForClaim({trackingExists: true});
    await expect(dispatchReminders(["duplicate"], game, "24h")).resolves.toBe(0);

    mockRunTransaction.mockRejectedValueOnce(new Error("claim failed"));
    await expect(dispatchReminders(["claim-error"], game, "24h")).resolves.toBe(0);

    transactionForClaim();
    mockSaveNotificationToFirestore.mockRejectedValueOnce(new Error("write failed"));
    await expect(dispatchReminders(["notification-error"], game, "2h")).resolves.toBe(0);

    expect(mockSendNotificationToUser).not.toHaveBeenCalled();
  });
});
