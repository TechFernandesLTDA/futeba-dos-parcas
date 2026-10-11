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
const mockStartAfter = jest.fn().mockReturnThis();

const queryChain: any = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  startAfter: mockStartAfter,
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
    get: mockCollectionGet,
  })),
}));

// Estado persistido dos leases de dedup simulados no Firestore.
const dedupDocuments = new Map<string, Record<string, unknown>>();

/**
 * Cria uma referência estável para notif_dedup.
 */
function makeDedupDocMock(id: string) {
  return {
    id,
    path: `notif_dedup/${id}`,
  };
}

const mockCollection = jest.fn((name: string) => {
  if (name === "notif_dedup") {
    return {
      doc: (id: string) => makeDedupDocMock(id),
    };
  }
  return {
    doc: mockDoc,
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    get: mockCollectionGet,
  };
});

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
    dedupDocuments.clear();
    mockBatch.mockImplementation(() => ({ update: mockBatchUpdate, set: jest.fn(), delete: jest.fn(), commit: mockBatchCommit }));
    mockRunTransaction.mockImplementation(async (callback: any) => {
      const reads = [
        {exists: true, data: () => ({name: "Pelada FC", status: "ACTIVE"})},
        {exists: true, data: () => ({name: "Maria", status: "ACTIVE"})},
        {exists: false, data: () => undefined},
        {exists: false, data: () => undefined},
      ];
      let readIndex = 0;
      return callback({
        get: jest.fn().mockImplementation((ref: {path?: string}) => {
          if (ref.path?.startsWith("notif_dedup/")) {
            const id = ref.path.slice("notif_dedup/".length);
            const data = dedupDocuments.get(id);
            return Promise.resolve({exists: Boolean(data), data: () => data});
          }
          return Promise.resolve(reads[readIndex++]);
        }),
        set: jest.fn((ref: {path?: string}, payload: Record<string, unknown>) => {
          if (!ref.path?.startsWith("notif_dedup/")) return;
          const id = ref.path.slice("notif_dedup/".length);
          dedupDocuments.set(id, {
            ...(dedupDocuments.get(id) ?? {}),
            ...payload,
          });
        }),
      });
    });
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

      expect(mockSendAndSaveNotification).toHaveBeenCalledWith(
        "owner1",
        expect.objectContaining({ title: "Nova confirmação!" }),
        "game_cnfmd_conf1",
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
        "group_inv_inv1",
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
              invited_user_id: "user1",
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
        "inv_resp_inv1_ACCEPTED",
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
        "inv_resp_inv1_DECLINED",
      );
    });

    it("não cria vínculo nem notifica aceite para usuário bloqueado", async () => {
      mockRunTransaction.mockImplementationOnce(async (callback: any) => {
        const reads = [
          {exists: true, data: () => ({name: "Pelada FC", status: "ACTIVE"})},
          {exists: true, data: () => ({name: "Maria", status: "ACTIVE"})},
          {exists: false, data: () => undefined},
          {exists: true, data: () => ({reason: "BANNED"})},
        ];
        let readIndex = 0;
        return callback({
          get: jest.fn().mockImplementation(() => Promise.resolve(reads[readIndex++])),
          set: jest.fn(),
        });
      });

      await onGroupInviteResponse({
        id: "evt-blocked-invite",
        data: {
          before: {data: () => ({status: "PENDING"})},
          after: {data: () => ({
            status: "ACCEPTED",
            invited_by_id: "inviter1",
            invited_user_id: "blocked-user",
            group_id: "group1",
          })},
        },
        params: {inviteId: "inv-blocked"},
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
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
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "admin2",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin2" }),
          },
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

    it("não notifica migração de membership durante união de contas", async () => {
      await onMemberJoined({
        id: "evt-member-merge",
        data: {data: () => ({role: "MEMBER", merged_from_alias: true})},
        params: {groupId: "group1", memberId: "canonical-user"},
      });

      expect(mockSendNotificationToUsers).not.toHaveBeenCalled();
    });

    it("filtra o proprio membro da lista de admins", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Admin" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "member1",
            data: () => ({ role: "MEMBER", status: "ACTIVE", user_id: "member1" }),
          },
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

    it("ignora ex-admins e memberships orfas ao notificar entrada", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Novato" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "removed-admin",
            data: () => ({ role: "ADMIN", status: "REMOVED", user_id: "removed-admin" }),
          },
          {
            id: "orphan-admin",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "another-user" }),
          },
        ],
        size: 3,
      });

      await onMemberJoined({
        data: { data: () => ({ role: "MEMBER" }) },
        params: { groupId: "group1", memberId: "novato1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1"],
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
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
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
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
        ],
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

    it("ignora admins inativos ou orfaos ao notificar saida", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Desistente" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "inactive-admin",
            data: () => ({ role: "ADMIN", status: "INACTIVE", user_id: "inactive-admin" }),
          },
          {
            id: "orphan-owner",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "different-user" }),
          },
        ],
        size: 3,
      });

      await onMemberLeft({
        data: { data: () => null },
        params: { groupId: "group1", memberId: "leaver1" },
      });

      expect(mockSendNotificationToUsers).toHaveBeenCalledWith(
        ["admin1"],
        expect.any(Object),
      );
    });
  });

  describe("onCashboxTransaction", () => {
    it("notifica admins sobre entrada no caixa", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
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
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "admin2",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin2" }),
          },
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
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "creator1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "creator1" }),
          },
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

    it("ignora ex-admins e memberships orfas no aviso de caixa", async () => {
      mockDocGet.mockResolvedValueOnce({ exists: true, data: () => ({ name: "Grupo" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
          {
            id: "banned-admin",
            data: () => ({ role: "ADMIN", status: "BANNED", user_id: "banned-admin" }),
          },
          {
            id: "orphan-owner",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "another-user" }),
          },
          {
            id: "creator1",
            data: () => ({ role: "OWNER", status: "ACTIVE", user_id: "creator1" }),
          },
        ],
        size: 4,
      });

      await onCashboxTransaction({
        data: {
          data: () => ({ type: "ENTRY", amount: 50, created_by_id: "creator1" }),
        },
        params: { groupId: "group1", transactionId: "tx4" },
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
      expect(mockOrderBy).toHaveBeenCalledWith("created_at", "asc");
      expect(mockLimit).toHaveBeenCalledWith(250);
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

    it("pagina backlog grande sem reler o lote inteiro", async () => {
      const firstPageDocs = Array.from({length: 250}, (_, index) => ({
        ref: {id: `inv-${index + 1}`},
      }));
      const secondPageDocs = [
        {ref: {id: "inv-251"}},
        {ref: {id: "inv-252"}},
      ];
      mockCollectionGet
        .mockResolvedValueOnce({
          empty: false,
          size: firstPageDocs.length,
          docs: firstPageDocs,
        })
        .mockResolvedValueOnce({
          empty: false,
          size: secondPageDocs.length,
          docs: secondPageDocs,
        });

      await cleanupExpiredInvites();

      expect(mockBatch).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(2);
      expect(mockBatchUpdate).toHaveBeenCalledTimes(252);
      expect(mockStartAfter).toHaveBeenCalledWith(firstPageDocs[firstPageDocs.length - 1]);
      expect(mockLimit).toHaveBeenCalledWith(250);
    });
  });

  // ============================================================
  // TESTES DE IDEMPOTÊNCIA: reentrega at-least-once não duplica
  // ============================================================
  describe("idempotência de reentrega (claimOnce)", () => {
    it("ignora confirmação recriada pela união de contas antes do claim", async () => {
      await onGameConfirmed({
        id: "evt-merged-confirmation",
        data: {data: () => ({
          game_id: "game1",
          user_id: "player1",
          status: "CONFIRMED",
          merged_from_alias: true,
        })},
        params: {confirmationId: "conf-merged"},
      });

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("não materializa aceite sem identidade canônica do convite", async () => {
      await onGroupInviteResponse({
        id: "evt-invalid-accepted-invite",
        data: {
          before: {data: () => ({status: "PENDING"})},
          after: {data: () => ({
            status: "ACCEPTED",
            invited_by_id: "inviter1",
            invited_user_id: "user1",
          })},
        },
        params: {inviteId: "inv-invalid"},
      });

      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it.each([
      {
        label: "grupo inexistente",
        reads: [
          {exists: false, data: () => undefined},
          {exists: true, data: () => ({status: "ACTIVE"})},
          {exists: false, data: () => undefined},
          {exists: false, data: () => undefined},
        ],
      },
      {
        label: "grupo inativo",
        reads: [
          {exists: true, data: () => ({status: "ARCHIVED"})},
          {exists: true, data: () => ({status: "ACTIVE"})},
          {exists: false, data: () => undefined},
          {exists: false, data: () => undefined},
        ],
      },
      {
        label: "usuário removido",
        reads: [
          {exists: true, data: () => ({status: "ACTIVE"})},
          {exists: false, data: () => undefined},
          {exists: false, data: () => undefined},
          {exists: false, data: () => undefined},
        ],
      },
      {
        label: "membership banida",
        reads: [
          {exists: true, data: () => ({status: "ACTIVE"})},
          {exists: true, data: () => ({status: "ACTIVE"})},
          {exists: true, data: () => ({status: "BANNED"})},
          {exists: false, data: () => undefined},
        ],
      },
    ])("recusa aceite para $label", async ({reads}) => {
      mockRunTransaction.mockImplementationOnce(async (callback: any) => {
        let readIndex = 0;
        return callback({
          get: jest.fn(async () => reads[readIndex++]),
          set: jest.fn(),
        });
      });

      await onGroupInviteResponse({
        id: `evt-${reads.length}`,
        data: {
          before: {data: () => ({status: "PENDING"})},
          after: {data: () => ({
            status: "ACCEPTED",
            invited_by_id: "inviter1",
            invited_user_id: "user1",
            group_id: "group1",
          })},
        },
        params: {inviteId: "inv-ineligible"},
      });

      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("libera o lease como FAILED quando o envio falha e permite retry", async () => {
      const deliveryError = new Error("FCM unavailable");
      mockSendAndSaveNotification.mockRejectedValueOnce(deliveryError);
      const event = {
        id: "evt-delivery-failed",
        data: {data: () => ({
          invited_user_id: "user1",
          group_id: "group1",
          group_name: "Pelada FC",
          invited_by_name: "João",
        })},
        params: {inviteId: "inv-failed"},
      };

      await expect(onGroupInviteCreated(event)).rejects.toBe(deliveryError);
      expect(dedupDocuments.get(event.id)).toMatchObject({status: "FAILED"});

      mockSendAndSaveNotification.mockResolvedValueOnce(true);
      await expect(onGroupInviteCreated(event)).resolves.toBeUndefined();
      expect(dedupDocuments.get(event.id)).toMatchObject({status: "COMPLETED"});
    });

    it("não conclui nem libera lease assumido por outro worker", async () => {
      const eventId = "evt-lease-lost";
      mockSendAndSaveNotification.mockImplementationOnce(async () => {
        dedupDocuments.set(eventId, {
          status: "PROCESSING",
          lease_owner: "new-worker",
        });
        return true;
      });

      await expect(onGroupInviteCreated({
        id: eventId,
        data: {data: () => ({
          invited_user_id: "user1",
          group_id: "group1",
          group_name: "Pelada FC",
          invited_by_name: "João",
        })},
        params: {inviteId: "inv-lost"},
      })).rejects.toThrow("Lease perdido");

      expect(dedupDocuments.get(eventId)).toMatchObject({
        status: "PROCESSING",
        lease_owner: "new-worker",
      });
    });

    it("reconhece lease ativo persistido com toDate", async () => {
      dedupDocuments.set("evt-date-lease", {
        status: "PROCESSING",
        lease_owner: "worker-ativo",
        lease_expires_at: {toDate: () => new Date(Date.now() + 60_000)},
      });

      await expect(onGroupInviteCreated({
        id: "evt-date-lease",
        data: {data: () => ({
          invited_user_id: "user1",
          group_id: "group1",
          group_name: "Pelada FC",
          invited_by_name: "João",
        })},
        params: {inviteId: "inv-date-lease"},
      })).rejects.toThrow("ainda em processamento");
    });

    it("onGameConfirmed: reentrega com mesmo event.id nao duplica push FCM", async () => {
      mockDocGet
        .mockResolvedValue({
          exists: true,
          data: () => ({ owner_id: "owner1" }),
        });
      // Segunda chamada ao mockDocGet (userDoc) — também precisa funcionar na 1ª entrega
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ owner_id: "owner1" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Jogador" }) });

      const event = {
        id: "evt-game-confirmed-1",
        data: { data: () => ({ game_id: "game1", user_id: "player1", status: "CONFIRMED" }) },
        params: { confirmationId: "conf1" },
      };

      // 1ª entrega — deve processar
      await onGameConfirmed(event);
      // 2ª entrega (reentrega) com mesmo event.id — deve pular
      await onGameConfirmed(event);

      expect(mockSendAndSaveNotification).toHaveBeenCalledTimes(1);
    });

    it("retoma claim PROCESSING vencida após crash e conclui o evento", async () => {
      // Valor fixo: um getter relativo a Date.now() vira "ativo" se passar >=2 ms
      // entre a captura de nowMs no claim e a checagem do lease (flaky #4361).
      const expiredAt = Date.now() - 60_000;
      dedupDocuments.set("evt-stale-claim", {
        status: "PROCESSING",
        lease_owner: "worker-morto",
        lease_expires_at: {toMillis: () => expiredAt},
      });
      mockDocGet
        .mockResolvedValueOnce({exists: true, data: () => ({owner_id: "owner1"})})
        .mockResolvedValueOnce({exists: true, data: () => ({name: "Jogador"})});

      await onGameConfirmed({
        id: "evt-stale-claim",
        data: {data: () => ({
          game_id: "game1",
          user_id: "player1",
          status: "CONFIRMED",
        })},
        params: {confirmationId: "conf-stale"},
      });

      expect(mockSendAndSaveNotification).toHaveBeenCalledTimes(1);
      expect(dedupDocuments.get("evt-stale-claim"))
        .toMatchObject({status: "COMPLETED"});
    });

    it("não confirma reentrega enquanto outro worker mantém lease ativo", async () => {
      dedupDocuments.set("evt-active-claim", {
        status: "PROCESSING",
        lease_owner: "worker-ativo",
        lease_expires_at: {toMillis: () => Date.now() + 60_000},
      });

      await expect(onGroupInviteCreated({
        id: "evt-active-claim",
        data: {data: () => ({
          invited_user_id: "user1",
          group_id: "group1",
          group_name: "Pelada FC",
          invited_by_name: "João",
        })},
        params: {inviteId: "inv-active"},
      })).rejects.toThrow("ainda em processamento");
      expect(mockSendAndSaveNotification).not.toHaveBeenCalled();
    });

    it("onGroupInviteCreated: reentrega com mesmo event.id nao duplica sendAndSaveNotification", async () => {
      const event = {
        id: "evt-group-invite-1",
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
      };

      // 1ª entrega
      await onGroupInviteCreated(event);
      // 2ª entrega (reentrega)
      await onGroupInviteCreated(event);

      // Deve ter enviado exatamente 1 notificação (push + doc)
      expect(mockSendAndSaveNotification).toHaveBeenCalledTimes(1);
    });

    it("onGroupInviteResponse: reentrega com mesmo event.id nao duplica notificacao", async () => {
      const event = {
        id: "evt-invite-response-1",
        data: {
          before: { data: () => ({ status: "PENDING" }) },
          after: {
            data: () => ({
              status: "ACCEPTED",
              invited_by_id: "inviter1",
              invited_user_id: "user1",
              invited_user_name: "Maria",
              group_name: "Pelada FC",
              group_id: "group1",
            }),
          },
        },
        params: { inviteId: "inv1" },
      };

      await onGroupInviteResponse(event);
      await onGroupInviteResponse(event);

      expect(mockSendAndSaveNotification).toHaveBeenCalledTimes(1);
    });

    it("onMemberJoined: reentrega com mesmo event.id nao duplica notificacao", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Pelada FC" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Novato" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
        ],
        size: 1,
      });

      const event = {
        id: "evt-member-joined-1",
        data: { data: () => ({ role: "MEMBER" }) },
        params: { groupId: "group1", memberId: "novato1" },
      };

      await onMemberJoined(event);
      await onMemberJoined(event);

      expect(mockSendNotificationToUsers).toHaveBeenCalledTimes(1);
    });

    it("onMemberLeft: reentrega com mesmo event.id nao duplica notificacao", async () => {
      mockDocGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Pelada FC" }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ name: "Ex-membro" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
        ],
        size: 1,
      });

      const event = {
        id: "evt-member-left-1",
        data: { data: () => null },
        params: { groupId: "group1", memberId: "leaver1" },
      };

      await onMemberLeft(event);
      await onMemberLeft(event);

      expect(mockSendNotificationToUsers).toHaveBeenCalledTimes(1);
    });

    it("onCashboxTransaction: reentrega com mesmo event.id nao duplica notificacao", async () => {
      mockDocGet.mockResolvedValue({ exists: true, data: () => ({ name: "Grupo" }) });
      mockCollectionGet.mockResolvedValue({
        docs: [
          {
            id: "admin1",
            data: () => ({ role: "ADMIN", status: "ACTIVE", user_id: "admin1" }),
          },
        ],
        size: 1,
      });

      const event = {
        id: "evt-cashbox-tx-1",
        data: {
          data: () => ({ type: "ENTRY", amount: 100, description: "Mensalidade", created_by_id: "creator1" }),
        },
        params: { groupId: "group1", transactionId: "tx1" },
      };

      await onCashboxTransaction(event);
      await onCashboxTransaction(event);

      expect(mockSendNotificationToUsers).toHaveBeenCalledTimes(1);
    });

    it("eventos diferentes com event.id distintos sao processados independentemente", async () => {
      const event1 = {
        id: "evt-invite-A",
        data: {
          data: () => ({
            invited_user_id: "userA",
            group_id: "groupA",
            group_name: "Grupo A",
            invited_by_name: "Admin",
            invited_by_id: "adminA",
          }),
        },
        params: { inviteId: "invA" },
      };
      const event2 = {
        id: "evt-invite-B",
        data: {
          data: () => ({
            invited_user_id: "userB",
            group_id: "groupB",
            group_name: "Grupo B",
            invited_by_name: "Admin",
            invited_by_id: "adminB",
          }),
        },
        params: { inviteId: "invB" },
      };

      await onGroupInviteCreated(event1);
      await onGroupInviteCreated(event2);

      // Ambos devem ter disparado — são eventos distintos
      expect(mockSendAndSaveNotification).toHaveBeenCalledTimes(2);
    });
  });
});
