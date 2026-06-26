const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockBatch = jest.fn(() => ({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue([]) }));
const mockRunTransaction = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockStartAfter = jest.fn().mockReturnThis();
const mockCountGet = jest.fn();
const mockCount = jest.fn(() => ({ get: mockCountGet }));

const queryChain: any = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  count: mockCount,
  get: mockCollectionGet,
};
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);
mockStartAfter.mockReturnValue(queryChain);

const mockDoc = jest.fn((id: string) => ({
  id,
  get: mockDocGet,
  update: mockDocUpdate,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({ id: sid, get: mockDocGet, update: mockDocUpdate })),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    startAfter: mockStartAfter,
    count: mockCount,
    get: mockCollectionGet,
  })),
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
  count: mockCount,
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

import {
  countConfirmedPlayersForGame,
  fetchConfirmedUserIdsForGame,
  fetchEligibleGroupMemberIdsForVacancy,
  onGameCreated,
  onGameUpdatedNotification,
  onGameVacancy,
} from "../../src/notifications/game-notifications";

describe("Game Notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountGet.mockResolvedValue({
      data: () => ({ count: 0 }),
    });
  });

  describe("helper queries", () => {
    it("pagina confirmacoes ate encontrar uma pagina parcial", async () => {
      const page1Docs = Array.from({ length: 100 }, (_, index) => ({
        id: `conf-${index}`,
        data: () => ({ user_id: `user-${index}` }),
      }));
      const page2Docs = [
        {
          id: "conf-100",
          data: () => ({ userId: "user-100" }),
        },
      ];

      mockCollectionGet
        .mockResolvedValueOnce({
          empty: false,
          size: page1Docs.length,
          docs: page1Docs,
        })
        .mockResolvedValueOnce({
          empty: false,
          size: page2Docs.length,
          docs: page2Docs,
        });

      await expect(fetchConfirmedUserIdsForGame("game-1")).resolves.toEqual([
        ...page1Docs.map((doc) => doc.data().user_id),
        "user-100",
      ]);
      expect(mockStartAfter).toHaveBeenCalledTimes(1);
      expect(mockStartAfter).toHaveBeenCalledWith(page1Docs[page1Docs.length - 1]);
    });

    it("retorna vazio quando nao ha confirmacoes confirmadas", async () => {
      mockCollectionGet.mockResolvedValueOnce({
        empty: true,
        size: 0,
        docs: [],
      });

      await expect(fetchConfirmedUserIdsForGame("game-empty")).resolves.toEqual([]);
      expect(mockStartAfter).not.toHaveBeenCalled();
    });

    it("conta confirmados via agregacao", async () => {
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 9 }),
      });

      await expect(countConfirmedPlayersForGame("game-count")).resolves.toBe(9);
      expect(mockCount).toHaveBeenCalled();
    });

    it("pagina membros do grupo e para quando nao encontra elegiveis", async () => {
      const page1Docs = Array.from({ length: 50 }, (_, index) => ({
        id: `member-${index}`,
        data: () => ({ status: "ACTIVE" }),
      }));

      mockCollectionGet
        .mockResolvedValueOnce({
          empty: false,
          size: page1Docs.length,
          docs: page1Docs,
        })
        .mockResolvedValueOnce({
          empty: true,
          size: 0,
          docs: [],
        });

      await expect(
        fetchEligibleGroupMemberIdsForVacancy(
          "group-1",
          new Set(page1Docs.map((doc) => doc.id)),
          3,
        ),
      ).resolves.toEqual([]);

      expect(mockStartAfter).toHaveBeenCalledTimes(1);
      expect(mockStartAfter).toHaveBeenCalledWith(page1Docs[page1Docs.length - 1]);
    });

    it("exclui confirmados/waitlist e respeita o limite de membros a notificar", async () => {
      const docs = [
        { id: "confirmed-user", data: () => ({ status: "ACTIVE" }) },
        { id: "member-1", data: () => ({ status: "ACTIVE" }) },
        { id: "member-2", data: () => ({ status: "ACTIVE" }) },
        { id: "member-3", data: () => ({ status: "ACTIVE" }) },
      ];

      mockCollectionGet.mockResolvedValueOnce({
        empty: false,
        size: docs.length,
        docs,
      });

      await expect(
        fetchEligibleGroupMemberIdsForVacancy(
          "group-2",
          new Set(["confirmed-user"]),
          2,
        ),
      ).resolves.toEqual(["member-1", "member-2"]);
    });
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
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 14 }),
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

    it("notifica membros elegiveis do grupo quando a waitlist e pequena", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: "SCHEDULED",
          max_players: 14,
          group_id: "group-1",
          location_name: "Arena",
          date: "2026-06-26",
        }),
      });
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 10 }),
      });
      mockCollectionGet
        .mockResolvedValueOnce({
          empty: true,
          size: 0,
          docs: [],
        })
        .mockResolvedValueOnce({
          empty: false,
          size: 1,
          docs: [
            { data: () => ({ user_id: "confirmed-user" }) },
          ],
        })
        .mockResolvedValueOnce({
          empty: false,
          size: 2,
          docs: [
            { id: "member-1", data: () => ({ status: "ACTIVE" }) },
            { id: "member-2", data: () => ({ status: "ACTIVE" }) },
          ],
        });

      await onGameVacancy({
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["member-1", "member-2"],
        expect.objectContaining({ title: "Vaga disponível!" }),
      );
    });
  });
});
