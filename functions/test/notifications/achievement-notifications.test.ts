const mockSendNotificationToUser = jest.fn().mockResolvedValue(true);
const mockSaveNotificationToFirestore = jest.fn().mockResolvedValue("notif1");
const mockSendAndSaveNotification = jest.fn().mockResolvedValue(true);
const mockBatch = jest.fn(() => ({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue([]) }));
const mockRunTransaction = jest.fn();
const mockDocGet = jest.fn();
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

const queryChain: any = { where: mockWhere, orderBy: mockOrderBy, limit: mockLimit, get: mockCollectionGet };
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({ id: sid, get: mockDocGet })),
    where: mockWhere,
    get: mockCollectionGet,
  })),
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockCollectionGet,
}));

jest.mock("firebase-admin", () => {
  const fieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    delete: jest.fn(() => ({ _type: "FieldDelete" })),
    increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
  };
  const timestamp = {
    now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
  };
  return {
    apps: [{ name: "test" }],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
      collection: mockCollection,
      batch: mockBatch,
      runTransaction: mockRunTransaction,
      FieldValue: fieldValue,
      Timestamp: timestamp,
      FieldPath: { documentId: jest.fn(() => "__name__") },
    })),
    messaging: jest.fn(() => ({ send: jest.fn(), sendEachForMulticast: jest.fn() })),
  };
});

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((_c: any, h: any) => h),
  onDocumentUpdated: jest.fn((_c: any, h: any) => h),
  onDocumentDeleted: jest.fn((_c: any, h: any) => h),
  onDocumentWritten: jest.fn((_c: any, h: any) => h),
}));

jest.mock("../../src/notifications/helpers", () => ({
  NotificationType: {
    LEVEL_UP: "LEVEL_UP",
    ACHIEVEMENT: "ACHIEVEMENT",
    MVP_RECEIVED: "MVP_RECEIVED",
    RANKING_CHANGED: "RANKING_CHANGED",
  },
  sendNotificationToUser: mockSendNotificationToUser,
  saveNotificationToFirestore: mockSaveNotificationToFirestore,
  sendAndSaveNotification: mockSendAndSaveNotification,
}));

import {
  onLevelUp,
  onBadgeAwarded,
  sendStreakNotificationIfMilestone,
  onMvpAwarded,
  onDivisionChanged,
  STREAK_MILESTONES,
} from "../../src/notifications/achievement-notifications";

describe("Achievement Notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("onLevelUp", () => {
    it("notifica level up quando level aumenta", async () => {
      await onLevelUp({
        data: {
          before: { data: () => ({ level: 1 }) },
          after: { data: () => ({ level: 2 }) },
        },
        params: { userId: "user1" },
      });

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: "Subiu de nivel!" }),
      );
    });

    it("nao notifica quando level nao muda", async () => {
      await onLevelUp({
        data: {
          before: { data: () => ({ level: 3 }) },
          after: { data: () => ({ level: 3 }) },
        },
        params: { userId: "user1" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });

    it("inclui nome do level na mensagem", async () => {
      await onLevelUp({
        data: {
          before: { data: () => ({ level: 0 }) },
          after: { data: () => ({ level: 1 }) },
        },
        params: { userId: "user1" },
      });

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ body: expect.stringContaining("Iniciante") }),
      );
    });

    it("usa 'Nivel N' para levels alem do array", async () => {
      await onLevelUp({
        data: {
          before: { data: () => ({ level: 10 }) },
          after: { data: () => ({ level: 15 }) },
        },
        params: { userId: "user1" },
      });

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ body: expect.stringContaining("Nivel 15") }),
      );
    });
  });

  describe("onBadgeAwarded", () => {
    it("notifica badge desbloqueada e salva no Firestore", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "Artilheiro", icon_url: "http://icon.url" }),
      });

      await onBadgeAwarded({
        data: { data: () => ({ user_id: "user1", badge_id: "badge1" }) },
        params: { badgeDocId: "bd1" },
      });

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: "Conquista Desbloqueada!" }),
      );
      expect(mockSaveNotificationToFirestore).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: "Conquista Desbloqueada!" }),
      );
    });

    it("ignora quando faltam user_id ou badge_id", async () => {
      await onBadgeAwarded({
        data: { data: () => ({ user_id: "user1" }) },
        params: { badgeDocId: "bd1" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();

      await onBadgeAwarded({
        data: { data: () => ({ badge_id: "badge1" }) },
        params: { badgeDocId: "bd2" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });

    it("nao faz nada sem dados", async () => {
      await onBadgeAwarded({
        data: { data: () => null },
        params: { badgeDocId: "bd1" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });

    it("usa badge_id como nome quando badge nao encontrada", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

      await onBadgeAwarded({
        data: { data: () => ({ user_id: "user1", badge_id: "badge_unknown" }) },
        params: { badgeDocId: "bd1" },
      });

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ body: expect.stringContaining("badge_unknown") }),
      );
    });
  });

  describe("sendStreakNotificationIfMilestone", () => {
    it("notifica no milestone 3 (streak 3)", async () => {
      const result = await sendStreakNotificationIfMilestone("user1", 3, 2);

      expect(result).toBe(true);
      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: expect.stringContaining("Sequencia") }),
      );
    });

    it("notifica no milestone 30 (streak 30)", async () => {
      const result = await sendStreakNotificationIfMilestone("user1", 30, 29);

      expect(result).toBe(true);
      expect(mockSaveNotificationToFirestore).toHaveBeenCalled();
    });

    it("nao notifica se nao atingiu milestone", async () => {
      const result = await sendStreakNotificationIfMilestone("user1", 2, 1);

      expect(result).toBe(false);
      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });

    it("envia milestone quando streak salta de 6 para 8 (atinge 7)", async () => {
      await sendStreakNotificationIfMilestone("user1", 8, 6);

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: expect.stringContaining("Sequencia") }),
      );
    });

    it("retorna false quando sendNotification falha", async () => {
      mockSendNotificationToUser.mockRejectedValueOnce(new Error("FCM error"));

      const result = await sendStreakNotificationIfMilestone("user1", 3, 2);

      expect(result).toBe(false);
    });

    it("usa previousStreak default quando nao fornecido", async () => {
      await sendStreakNotificationIfMilestone("user1", 3);

      expect(mockSendNotificationToUser).toHaveBeenCalled();
    });
  });

  describe("onMvpAwarded", () => {
    it("notifica MVP quando mvp_id muda e jogo FINISHED", async () => {
      await onMvpAwarded({
        data: {
          before: { data: () => ({ status: "LIVE" }) },
          after: { data: () => ({ status: "FINISHED", mvp_id: "player1", location_name: "Campo 1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "player1",
        expect.objectContaining({ title: "Voce foi eleito MVP!" }),
      );
    });

    it("nao notifica quando MVP nao mudou", async () => {
      await onMvpAwarded({
        data: {
          before: { data: () => ({ status: "LIVE", mvp_id: "player1" }) },
          after: { data: () => ({ status: "FINISHED", mvp_id: "player1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("nao notifica se jogo nao esta FINISHED", async () => {
      await onMvpAwarded({
        data: {
          before: { data: () => ({ status: "LIVE" }) },
          after: { data: () => ({ status: "LIVE", mvp_id: "player1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });
  });

  describe("onDivisionChanged", () => {
    it("notifica promocao quando divisao sobe", async () => {
      await onDivisionChanged({
        data: {
          before: { data: () => ({ user_id: "user1", division: "BRONZE" }) },
          after: { data: () => ({ user_id: "user1", division: "PRATA" }) },
        },
        params: { partId: "part1" },
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: "Promocao de Liga!" }),
      );
    });

    it("notifica rebaixamento quando divisao desce", async () => {
      await onDivisionChanged({
        data: {
          before: { data: () => ({ user_id: "user1", division: "OURO" }) },
          after: { data: () => ({ user_id: "user1", division: "PRATA" }) },
        },
        params: { partId: "part1" },
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ title: "Mudanca de Liga" }),
      );
    });

    it("nao notifica quando divisao nao mudou", async () => {
      await onDivisionChanged({
        data: {
          before: { data: () => ({ user_id: "user1", division: "BRONZE" }) },
          after: { data: () => ({ user_id: "user1", division: "BRONZE" }) },
        },
        params: { partId: "part1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("ignora quando userId ausente", async () => {
      await onDivisionChanged({
        data: {
          before: { data: () => ({ division: "BRONZE" }) },
          after: { data: () => ({ division: "BRONZE" }) },
        },
        params: { partId: "part1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });
  });

  describe("STREAK_MILESTONES", () => {
    it("tem 4 milestones definidas", () => {
      expect(STREAK_MILESTONES).toHaveLength(4);
    });

    it("milestones estao ordenadas por streak decrescente", () => {
      for (let i = 0; i < STREAK_MILESTONES.length - 1; i++) {
        expect(STREAK_MILESTONES[i].streak).toBeGreaterThan(STREAK_MILESTONES[i + 1].streak);
      }
    });
  });
});
