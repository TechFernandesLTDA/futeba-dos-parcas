const mockSendNotificationToUser = jest.fn().mockResolvedValue(true);
const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockSendAndSaveNotification = jest.fn().mockResolvedValue(true);
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue([]);
const mockBatch = jest.fn(() => ({ update: mockBatchUpdate, set: jest.fn(), delete: jest.fn(), commit: mockBatchCommit }));
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

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_c: any, h: any) => h),
}));

jest.mock("../../src/notifications/helpers", () => ({
  NotificationType: {
    GAME_CONFIRMED: "GAME_CONFIRMED",
    GROUP_INVITE: "GROUP_INVITE",
    GROUP_INVITE_ACCEPTED: "GROUP_INVITE_ACCEPTED",
    GROUP_INVITE_DECLINED: "GROUP_INVITE_DECLINED",
    MEMBER_JOINED: "MEMBER_JOINED",
    MEMBER_LEFT: "MEMBER_LEFT",
    CASHBOX_ENTRY: "CASHBOX_ENTRY",
    CASHBOX_EXIT: "CASHBOX_EXIT",
  },
  sendNotificationToUser: mockSendNotificationToUser,
  sendNotificationToUsers: mockSendNotificationToUsers,
  sendAndSaveNotification: mockSendAndSaveNotification,
}));

import {
  onGameConfirmed,
  onGroupInviteCreated,
  cleanupExpiredInvites,
  onGroupInviteResponse,
  onMemberJoined,
  onMemberLeft,
  onCashboxTransaction,
} from "../../src/notifications/presence-notifications";

describe("Presence Notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch.mockImplementation(() => ({ update: mockBatchUpdate, set: jest.fn(), delete: jest.fn(), commit: mockBatchCommit }));
  });

  describe("onGameConfirmed", () => {
    it("notifica owner do jogo quando jogador confirma", async () => {
      mockDocGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ owner_id: "owner1" }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ name: "Maria", nickname: "Mary" }),
        });

      await onGameConfirmed({
        data: { data: () => ({ game_id: "game1", user_id: "player1", status: "CONFIRMED" }) },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUser).toHaveBeenCalledWith(
        "owner1",
        expect.objectContaining({ title: "Nova confirmação!" }),
      );
    });

    it("nao notifica quando o proprio owner confirma (self)", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ owner_id: "owner1" }),
      });

      await onGameConfirmed({
        data: { data: () => ({ game_id: "game1", user_id: "owner1", status: "CONFIRMED" }) },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });

    it("nao faz nada quando status nao e CONFIRMED", async () => {
      await onGameConfirmed({
        data: { data: () => ({ game_id: "game1", user_id: "player1", status: "PENDING" }) },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });

    it("trata jogo nao encontrado", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

      await onGameConfirmed({
        data: { data: () => ({ game_id: "game1", user_id: "player1", status: "CONFIRMED" }) },
        params: { confirmationId: "conf1" },
      });

      expect(mockSendNotificationToUser).not.toHaveBeenCalled();
    });
  });

  describe("onGroupInviteCreated", () => {
    it("envia notificacao de convite via sendAndSaveNotification", async () => {
      await onGroupInviteCreated({
        data: {
          data: () => ({
            invited_user_id: "user1",
            group_id: "group1",
            group_name: "Pelada FC",
            invited_by_name: "Joao",
            invited_by_id: "owner1",
          }),
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({
          title: "Convite para grupo",
          body: expect.stringContaining("Joao"),
        }),
      );
    });

    it("ignora quando invited_user_id ausente", async () => {
      await onGroupInviteCreated({
        data: {
          data: () => ({
            group_id: "group1",
            group_name: "Pelada FC",
            invited_by_name: "Joao",
          }),
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("ignora quando group_id ausente", async () => {
      await onGroupInviteCreated({
        data: {
          data: () => ({
            invited_user_id: "user1",
            group_name: "Pelada FC",
            invited_by_name: "Joao",
          }),
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("nao faz nada sem dados", async () => {
      await onGroupInviteCreated({
        data: { data: () => null },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });
  });

  describe("onGroupInviteResponse", () => {
    it("notifica invited_by quando convite aceito", async () => {
      await onGroupInviteResponse({
        data: {
          before: { data: () => ({ status: "PENDING" }) },
          after: {
            data: () => ({
              status: "ACCEPTED",
              invited_by_id: "inviter1",
              invited_user_name: "Maria",
              group_name: "Pelada FC",
              group_id: "group1",
            }),
          },
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "inviter1",
        expect.objectContaining({ title: "Convite aceito!" }),
      );
    });

    it("notifica invited_by quando convite recusado", async () => {
      await onGroupInviteResponse({
        data: {
          before: { data: () => ({ status: "PENDING" }) },
          after: {
            data: () => ({
              status: "DECLINED",
              invited_by_id: "inviter1",
              invited_user_name: "Maria",
              group_name: "Pelada FC",
            }),
          },
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "inviter1",
        expect.objectContaining({ title: "Convite recusado" }),
      );
    });

    it("ignora quando status nao mudou de PENDING", async () => {
      await onGroupInviteResponse({
        data: {
          before: { data: () => ({ status: "PENDING" }) },
          after: { data: () => ({ status: "PENDING" }) },
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("ignora quando invited_by_id ausente", async () => {
      await onGroupInviteResponse({
        data: {
          before: { data: () => ({ status: "PENDING" }) },
          after: {
            data: () => ({
              status: "ACCEPTED",
              invited_user_name: "Maria",
              group_name: "Pelada FC",
            }),
          },
        },
        params: { inviteId: "inv1" },
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });
  });

  describe("onMemberJoined", () => {
    it("notifica admins quando membro entra", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Pelada FC" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Novato" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "admin1", data: () => ({ role: "ADMIN" }) },
          { id: "admin2", data: () => ({ role: "ADMIN" }) },
        ],
        size: 2,
      });

      await onMemberJoined({
        data: { data: () => ({ role: "MEMBER" }) },
        params: { groupId: "group1", memberId: "novato1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1", "admin2"],
        expect.objectContaining({ title: "Novo membro!" }),
      );
    });

    it("nao notifica quando e o OWNER entrando", async () => {
      await onMemberJoined({
        data: { data: () => ({ role: "OWNER" }) },
        params: { groupId: "group1", memberId: "owner1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("filtra o proprio membro da lista de admins", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Admin" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "admin1", data: () => ({ role: "ADMIN" }) },
          { id: "member1", data: () => ({ role: "MEMBER" }) },
        ],
        size: 2,
      });

      await onMemberJoined({
        data: { data: () => ({ role: "ADMIN" }) },
        params: { groupId: "group1", memberId: "admin1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["member1"],
        expect.any(Object),
      );
    });
  });

  describe("onMemberLeft", () => {
    it("notifica admins quando membro sai", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Pelada FC" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Desistente" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "admin1", data: () => ({ role: "ADMIN" }) },
        ],
        size: 1,
      });

      await onMemberLeft({
        data: { data: () => null },
        params: { groupId: "group1", memberId: "leaver1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1"],
        expect.objectContaining({ title: "Membro saiu" }),
      );
    });

    it("lida com grupo nao encontrado", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

      await onMemberLeft({
        data: { data: () => null },
        params: { groupId: "group-inexistente", memberId: "leaver1" },
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("usa nome padrao quando usuario nao encontrado", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: false, data: () => null });
      mockCollectionGet.mockResolvedValue({
        docs: [{ id: "admin1", data: () => ({ role: "ADMIN" }) }],
        size: 1,
      });

      await onMemberLeft({
        data: { data: () => null },
        params: { groupId: "group1", memberId: "unknown" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1"],
        expect.objectContaining({
          body: expect.stringContaining("Um jogador"),
        }),
      );
    });
  });

  describe("onCashboxTransaction", () => {
    it("notifica admins sobre entrada no caixa", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "admin1", data: () => ({ role: "ADMIN" }) },
        ],
        size: 1,
      });

      await onCashboxTransaction({
        data: {
          data: () => ({ type: "ENTRY", amount: 100, description: "Mensalidade", created_by_id: "creator1" }),
        },
        params: { groupId: "group1", transactionId: "tx1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1"],
        expect.objectContaining({ title: "Entrada no caixa" }),
      );
    });

    it("notifica admins sobre saida do caixa", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "admin1", data: () => ({ role: "ADMIN" }) },
          { id: "admin2", data: () => ({ role: "ADMIN" }) },
        ],
        size: 2,
      });

      await onCashboxTransaction({
        data: {
          data: () => ({ type: "EXIT", amount: 50, description: "Compra de bola", created_by_id: "creator1" }),
        },
        params: { groupId: "group1", transactionId: "tx2" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        expect.arrayContaining(["admin1", "admin2"]),
        expect.objectContaining({ title: "Saída do caixa" }),
      );
    });

    it("filtra created_by dos admins", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          { id: "admin1", data: () => ({ role: "ADMIN" }) },
          { id: "creator1", data: () => ({ role: "ADMIN" }) },
        ],
        size: 2,
      });

      await onCashboxTransaction({
        data: {
          data: () => ({ type: "ENTRY", amount: 50, created_by_id: "creator1" }),
        },
        params: { groupId: "group1", transactionId: "tx3" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1"],
        expect.any(Object),
      );
    });
  });

  describe("cleanupExpiredInvites", () => {
    it("marca invites expirados como EXPIRED em batch", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: false,
        size: 2,
        docs: [
          { ref: { id: "inv1" } },
          { ref: { id: "inv2" } },
        ],
      });

      await cleanupExpiredInvites();

      expect(mockBatch).toHaveBeenCalled();
      expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    });

    it("retorna cedo quando nao ha convites expirados", async () => {
      mockCollectionGet.mockResolvedValue({
        empty: true,
        size: 0,
        docs: [],
      });

      await cleanupExpiredInvites();

      expect(mockBatch).not.toHaveBeenCalled();
    });
  });
});
