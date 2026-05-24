const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockBatch = jest.fn(() => ({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue([]) }));
const mockRunTransaction = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
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
  update: mockDocUpdate,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({ id: sid, get: mockDocGet, update: mockDocUpdate })),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
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

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const mockTimestamp = {
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
  fromMillis: jest.fn((ms: number) => ({ toDate: () => new Date(ms), _type: "Timestamp" })),
};
const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
  batch: mockBatch,
  runTransaction: mockRunTransaction,
  FieldValue: mockFieldValue,
  Timestamp: mockTimestamp,
  FieldPath: { documentId: jest.fn(() => "__name__") },
}));

(mockFirestore as any).FieldValue = mockFieldValue;
(mockFirestore as any).Timestamp = mockTimestamp;

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((_c: any, h: any) => h),
  onDocumentUpdated: jest.fn((_c: any, h: any) => h),
  onDocumentDeleted: jest.fn((_c: any, h: any) => h),
  onDocumentWritten: jest.fn((_c: any, h: any) => h),
}));

jest.mock("../../src/notifications/helpers", () => ({
  NotificationType: {
    GAME_INVITE: "GAME_INVITE",
    GAME_CANCELLED: "GAME_CANCELLED",
    GAME_UPDATED: "GAME_UPDATED",
    GAME_VACANCY: "GAME_VACANCY",
  },
  sendNotificationToUsers: mockSendNotificationToUsers,
  sendNotificationToUser: jest.fn().mockResolvedValue(true),
}));

import { onGameCreated, onGameUpdatedNotification, onGameVacancy } from "../../src/notifications/game-notifications";

describe("Game Notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("onGameCreated", () => {
    it("envia notificacao para membros do grupo quando jogo tem group_id", async () => {
      mockDocGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ name: "Joao", nickname: "Jao" }),
        });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "member1", data: () => ({ role: "MEMBER" }) },
          { id: "member2", data: () => ({ role: "ADMIN" }) },
        ],
        size: 2,
      });

      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["member1", "member2"],
        expect.objectContaining({ title: "Novo jogo criado!" }),
      );
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ invite_notification_sent: true }),
      );
    });

    it("nao envia notificacao duplicada quando invite_notification_sent=true", async () => {
      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1", invite_notification_sent: true }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("nao faz nada quando jogo nao tem dados", async () => {
      await onGameCreated({
        data: { data: () => null },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("ignora quando nao tem group_id (jogo publico)", async () => {
      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("filtra o owner da lista de membros", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "Joao" }),
      });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "owner1", data: () => ({ role: "OWNER" }) },
          { id: "member1", data: () => ({ role: "MEMBER" }) },
        ],
        size: 2,
      });

      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["member1"],
        expect.any(Object),
      );
    });

    it("usa 'Alguem' quando owner nao encontrado no Firestore", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });
      mockCollectionGet.mockResolvedValue({
        docs: [{ id: "member1", data: () => ({ role: "MEMBER" }) }],
        size: 1,
      });

      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["member1"],
        expect.objectContaining({
          body: expect.stringContaining("Alguem"),
        }),
      );
    });

    it("nao envia quando so tem o owner no grupo", async () => {
      mockCollectionGet.mockResolvedValue({
        docs: [{ id: "owner1", data: () => ({ role: "OWNER" }) }],
        size: 1,
      });

      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("trata erro ao buscar membros do grupo graciosamente", async () => {
      mockDocGet.mockRejectedValue(new Error("Firestore error"));

      await expect(
        onGameCreated({
          data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
          params: { gameId: "game1" },
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("onGameUpdatedNotification", () => {
    it("notifica confirmados quando jogo cancelado", async () => {
      mockCollectionGet.mockResolvedValue({
        docs: [
          { data: () => ({ user_id: "user1" }) },
          { data: () => ({ user_id: "user2" }) },
        ],
        size: 2,
      });

      await onGameUpdatedNotification({
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: { data: () => ({ status: "CANCELLED", date: "2024-01-01", location_id: "loc1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["user1", "user2"],
        expect.objectContaining({ title: "Jogo cancelado" }),
      );
    });

    it("nao notifica quando status nao mudou para CANCELLED", async () => {
      await onGameUpdatedNotification({
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: { data: () => ({ status: "CONFIRMED", date: "2024-01-01", location_id: "loc1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("notifica confirmados quando data muda", async () => {
      mockCollectionGet.mockResolvedValue({
        docs: [{ data: () => ({ user_id: "user1" }) }],
        size: 1,
      });

      await onGameUpdatedNotification({
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: { data: () => ({ status: "SCHEDULED", date: "2024-01-15", location_id: "loc1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["user1"],
        expect.objectContaining({ title: "Jogo atualizado" }),
      );
    });

    it("notifica confirmados quando location muda", async () => {
      mockCollectionGet.mockResolvedValue({
        docs: [{ data: () => ({ user_id: "user1" }) }],
        size: 1,
      });

      await onGameUpdatedNotification({
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc2" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalled();
    });

    it("nao notifica quando nao ha confirmados", async () => {
      mockCollectionGet.mockResolvedValue({ docs: [], size: 0 });

      await onGameUpdatedNotification({
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: { data: () => ({ status: "CANCELLED", date: "2024-01-01", location_id: "loc1" }) },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("nao faz nada sem dados before/after", async () => {
      await onGameUpdatedNotification({
        data: { before: { data: () => null }, after: { data: () => null } },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });
  });

  describe("onGameVacancy", () => {
    it("notifica waitlist quando vaga abre (CONFIRMED -> CANCELLED)", async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "SCHEDULED", max_players: 14, location_name: "Campo 1", date: "2024-01-15" }),
      });
      mockCollectionGet.mockResolvedValue({ empty: true, size: 0, docs: [] });

      await onGameVacancy({
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockDocUpdate).toHaveBeenCalled();
    });

    it("nao notifica se nao era CONFIRMED", async () => {
      await onGameVacancy({
        data: {
          before: { data: () => ({ status: "PENDING", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("nao notifica se jogo nao esta SCHEDULED ou CONFIRMED", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: "FINISHED", max_players: 14 }),
      });

      await onGameVacancy({
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("respeita idempotencia vacancy_notified_at < 5 min", async () => {
      const recentDate = new Date(Date.now() - 60 * 1000);
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: "SCHEDULED",
          max_players: 14,
          vacancy_notified_at: { toDate: () => recentDate },
        }),
      });

      await onGameVacancy({
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("nao notifica quando jogo continua cheio (currentPlayers >= maxPlayers)", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: "SCHEDULED", max_players: 14, location_name: "Campo" }),
      });
      mockCollectionGet.mockResolvedValueOnce({
        docs: Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, data: () => ({ user_id: `u${i}` }) })),
        size: 14,
      });

      await onGameVacancy({
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });
  });
});
