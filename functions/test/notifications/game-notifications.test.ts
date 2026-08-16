const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockBatch = jest.fn(() => ({ update: jest.fn(), set: jest.fn(), commit: jest.fn().mockResolvedValue([]) }));
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocDelete = jest.fn().mockResolvedValue(undefined);
const mockDocCreate = jest.fn().mockResolvedValue(undefined);
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
  delete: mockDocDelete,
  create: mockDocCreate,
  collection: jest.fn(() => ({
    doc: jest.fn((sid: string) => ({
      id: sid,
      get: mockDocGet,
      update: mockDocUpdate,
      delete: mockDocDelete,
      create: mockDocCreate,
    })),
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
    mockRunTransaction.mockImplementation(async (callback: any) =>
      callback({
        get: mockTransactionGet,
        update: mockTransactionUpdate,
      })
    );
    mockTransactionGet.mockResolvedValue({
      exists: true,
      data: () => ({
        status: "SCHEDULED",
        max_players: 14,
      }),
    });
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
        data: () => ({
          status: "ACTIVE",
          user_id: `member-${index}`,
        }),
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
        {
          id: "confirmed-user",
          data: () => ({ status: "ACTIVE", user_id: "confirmed-user" }),
        },
        {
          id: "member-1",
          data: () => ({ status: "ACTIVE", user_id: "member-1" }),
        },
        {
          id: "member-2",
          data: () => ({ status: "ACTIVE", user_id: "member-2" }),
        },
        {
          id: "member-3",
          data: () => ({ status: "ACTIVE", user_id: "member-3" }),
        },
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

    it("ignora memberships inactive/orfas mesmo quando a query retorna os docs", async () => {
      mockCollectionGet.mockResolvedValueOnce({
        empty: false,
        size: 4,
        docs: [
          {
            id: "member-active",
            data: () => ({ status: "ACTIVE", user_id: "member-active" }),
          },
          {
            id: "member-removed",
            data: () => ({ status: "REMOVED", user_id: "member-removed" }),
          },
          {
            id: "member-orphan",
            data: () => ({ status: "ACTIVE", user_id: "another-user" }),
          },
          {
            id: "member-camel",
            data: () => ({ status: "ACTIVE", userId: "member-camel" }),
          },
        ],
      });

      await expect(
        fetchEligibleGroupMemberIdsForVacancy(
          "group-3",
          new Set<string>(),
          5,
        ),
      ).resolves.toEqual(["member-active", "member-camel"]);
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
          {
            id: "member1",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member1" }),
          },
          {
            id: "member2",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "member2" }),
          },
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
        id: "evt-created-1",
        data: { data: () => ({ owner_id: "owner1", group_id: "group1", invite_notification_sent: true }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("ignora reentrega do mesmo evento de criacao", async () => {
      mockDocCreate.mockRejectedValueOnce({ code: 6 });

      await onGameCreated({
        id: "evt-created-dup",
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
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
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ name: "Joao" }),
      });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "owner1",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "owner1" }),
          },
          {
            id: "member1",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member1" }),
          },
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

    it("ignora ex-membros e docs orfaos ao montar destinatarios do grupo", async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ name: "Joao" }),
      });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "member-active",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member-active" }),
          },
          {
            id: "member-removed",
            data: () => ({ role: "MEMBER", status: "REMOVED", user_id: "member-removed" }),
          },
          {
            id: "member-orphan",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "another-user" }),
          },
          {
            id: "owner1",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "owner1" }),
          },
        ],
        size: 4,
      });

      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["member-active"],
        expect.any(Object),
      );
    });

    it("usa 'Alguem' quando owner nao encontrado no Firestore", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "member1",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member1" }),
          },
        ],
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
        docs: [
          {
            id: "owner1",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "owner1" }),
          },
        ],
        size: 1,
      });

      await onGameCreated({
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("propaga erro ao buscar membros para permitir retry", async () => {
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "member1",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member1" }),
          },
        ],
        size: 1,
      });
      mockDocGet.mockRejectedValueOnce(new Error("Firestore error"));

      await expect(
        onGameCreated({
          data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
          params: { gameId: "game1" },
        }),
      ).rejects.toThrow("Firestore error");
    });

    it("libera a claim quando a entrega falha e permite retry", async () => {
      mockDocGet.mockResolvedValue({
        exists: true,
        data: () => ({ name: "Joao" }),
      });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "member1",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member1" }),
          },
        ],
        size: 1,
      });
      mockSendNotificationToUsers.mockRejectedValueOnce(
        new Error("FCM unavailable"),
      );

      await expect(onGameCreated({
        id: "evt-created-retry",
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      })).rejects.toThrow("FCM unavailable");

      expect(mockDocDelete).toHaveBeenCalled();

      await onGameCreated({
        id: "evt-created-retry",
        data: { data: () => ({ owner_id: "owner1", group_id: "group1" }) },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledTimes(2);
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
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          date: "2024-01-15",
          location_id: "loc1",
        }),
      });
      mockCollectionGet.mockResolvedValue({
        docs: [{ data: () => ({ user_id: "user1" }) }],
        size: 1,
      });

      await onGameUpdatedNotification({
        id: "evt-updated-date",
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: {
            data: () => ({ status: "SCHEDULED", date: "2024-01-15", location_id: "loc1" }),
            ref: { id: "game1" },
          },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["user1"],
        expect.objectContaining({ title: "Jogo atualizado" }),
      );
    });

    it("notifica confirmados quando location muda", async () => {
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          date: "2024-01-01",
          location_id: "loc2",
        }),
      });
      mockCollectionGet.mockResolvedValue({
        docs: [{ data: () => ({ user_id: "user1" }) }],
        size: 1,
      });

      await onGameUpdatedNotification({
        id: "evt-updated-location",
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: {
            data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc2" }),
            ref: { id: "game1" },
          },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalled();
    });

    it("nao reenvia GAME_UPDATED quando o mesmo estado ja foi notificado", async () => {
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          date: "2024-01-15",
          location_id: "loc1",
          last_game_update_notification_key: "loc1|2024-01-15|",
        }),
      });

      await onGameUpdatedNotification({
        id: "evt-updated-dedup",
        data: {
          before: { data: () => ({ status: "SCHEDULED", date: "2024-01-01", location_id: "loc1" }) },
          after: {
            data: () => ({ status: "SCHEDULED", date: "2024-01-15", location_id: "loc1" }),
            ref: { id: "game1" },
          },
        },
        params: { gameId: "game1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
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
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: "SCHEDULED",
          max_players: 14,
          location_name: "Campo 1",
          date: "2024-01-15",
        }),
      });
      mockCollectionGet.mockResolvedValue({ empty: true, size: 0, docs: [] });

      await onGameVacancy({
        id: "evt-vacancy-1",
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockRunTransaction).toHaveBeenCalled();
      expect(mockTransactionUpdate).toHaveBeenCalled();
    });

    it("#4043: promove a 1ª entrada WAITING para NOTIFIED e usa orderBy(added_at)", async () => {
      mockTransactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "SCHEDULED",
            max_players: 14,
            location_name: "Campo 1",
            date: "2024-01-15",
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({status: "SCHEDULED", max_players: 14}),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "WAITING",
            user_id: "wl-user-1",
            user_name: "Jogador",
          }),
        });
      mockCountGet.mockResolvedValueOnce({
        data: () => ({count: 10}),
      });
      const entryRef = {id: "wl-user-1"};
      mockCollectionGet.mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [
          {
            id: "wl-user-1",
            ref: entryRef,
            data: () => ({
              status: "WAITING",
              user_id: "wl-user-1",
              user_name: "Jogador",
            }),
          },
        ],
      });

      await onGameVacancy({
        id: "evt-vacancy-promote",
        data: {
          before: {data: () => ({status: "CONFIRMED", game_id: "game1"})},
          after: {data: () => ({status: "CANCELLED", game_id: "game1"})},
        },
        params: {confirmationId: "conf1"},
      });

      // Regressão do #753/#4043: a query ordenava por "created_at" (campo
      // inexistente) — o campo real é "added_at".
      expect(mockOrderBy).toHaveBeenCalledWith("added_at", "asc");
      // A 1ª entrada WAITING é promovida a NOTIFIED com deadline de 30 min.
      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        entryRef,
        expect.objectContaining({
          status: "NOTIFIED",
          notified_at: expect.anything(),
          response_deadline: expect.anything(),
        })
      );
      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["wl-user-1"],
        expect.objectContaining({type: "GAME_VACANCY"})
      );
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
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: "FINISHED", max_players: 14 }),
      });

      await onGameVacancy({
        id: "evt-vacancy-closed",
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
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          status: "SCHEDULED",
          max_players: 14,
          vacancy_notified_at: { toDate: () => recentDate },
        }),
      });

      await onGameVacancy({
        id: "evt-vacancy-throttle",
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("nao notifica quando jogo continua cheio (currentPlayers >= maxPlayers)", async () => {
      mockTransactionGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ status: "SCHEDULED", max_players: 14, location_name: "Campo" }),
      });
      mockCountGet.mockResolvedValueOnce({
        data: () => ({ count: 14 }),
      });

      await onGameVacancy({
        id: "evt-vacancy-full",
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it("nao consome cooldown quando o cancelamento apenas reduz overbooking para lotado", async () => {
      const gameData = {
        status: "SCHEDULED",
        max_players: 14,
        location_name: "Campo",
      };
      mockTransactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => gameData,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => gameData,
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => gameData,
        });
      mockCountGet
        .mockResolvedValueOnce({
          data: () => ({ count: 14 }),
        })
        .mockResolvedValueOnce({
          data: () => ({ count: 13 }),
        });
      mockCollectionGet.mockResolvedValue({
        empty: true,
        size: 0,
        docs: [],
      });

      const event = {
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      };

      await onGameVacancy({
        id: "evt-vacancy-overbooked",
        ...event,
      });
      await onGameVacancy({
        id: "evt-vacancy-real",
        ...event,
      });

      expect(mockTransactionUpdate).toHaveBeenCalledTimes(1);
    });

    it("notifica membros elegiveis do grupo quando a waitlist e pequena", async () => {
      mockTransactionGet.mockResolvedValueOnce({
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
            {
              id: "member-1",
              data: () => ({ status: "ACTIVE", user_id: "member-1" }),
            },
            {
              id: "member-2",
              data: () => ({ status: "ACTIVE", user_id: "member-2" }),
            },
          ],
        });

      await onGameVacancy({
        id: "evt-vacancy-group",
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

    it("usa claim transacional para evitar TOCTOU no throttle de vaga", async () => {
      mockRunTransaction.mockResolvedValueOnce({
        shouldNotify: false,
        reason: "throttled",
        game: null,
      });

      await onGameVacancy({
        id: "evt-vacancy-race",
        data: {
          before: { data: () => ({ status: "CONFIRMED", game_id: "game1" }) },
          after: { data: () => ({ status: "CANCELLED", game_id: "game1" }) },
        },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    it("#4043: nao promove quando a entrada ja saiu de WAITING (TOCTOU)", async () => {
      mockTransactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({status: "SCHEDULED", max_players: 14, location_name: "Campo 1"}),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({status: "SCHEDULED", max_players: 14}),
        })
        .mockResolvedValueOnce({exists: false, data: () => null});
      mockCountGet.mockResolvedValueOnce({data: () => ({count: 10})});
      mockCollectionGet.mockResolvedValueOnce({
        empty: false,
        size: 1,
        docs: [
          {
            id: "wl-user-1",
            ref: {id: "wl-user-1"},
            data: () => ({status: "WAITING", user_id: "wl-user-1"}),
          },
        ],
      });

      await onGameVacancy({
        id: "evt-vacancy-toctou",
        data: {
          before: {data: () => ({status: "CONFIRMED", game_id: "game1"})},
          after: {data: () => ({status: "CANCELLED", game_id: "game1"})},
        },
        params: {confirmationId: "conf1"},
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("#4043: erro ao notificar grupo é isolado e nao derruba o fluxo", async () => {
      mockTransactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "SCHEDULED",
            max_players: 14,
            group_id: "group-1",
            location_name: "Arena",
          }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({status: "SCHEDULED", max_players: 14, group_id: "group-1"}),
        });
      mockCountGet.mockResolvedValueOnce({data: () => ({count: 10})});
      mockCollectionGet
        .mockResolvedValueOnce({empty: true, size: 0, docs: []})
        .mockRejectedValueOnce(new Error("FCM group unavailable"));

      await expect(onGameVacancy({
        id: "evt-vacancy-group-error",
        data: {
          before: {data: () => ({status: "CONFIRMED", game_id: "game1"})},
          after: {data: () => ({status: "CANCELLED", game_id: "game1"})},
        },
        params: {confirmationId: "conf1"},
      })).resolves.toBeUndefined();

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });
  });
});
