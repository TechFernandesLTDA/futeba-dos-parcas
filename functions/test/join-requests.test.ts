/**
 * Testes do trigger onJoinRequestApproved (issue #517 Phase 2).
 *
 * Cobre:
 * - PENDING -> APPROVED dispara criacao de member + counter + notification
 * - PENDING -> REJECTED nao dispara nada
 * - Re-aprovacao (member ja existe) e idempotente
 * - Mismatch user_id no doc loga warn e aborta
 * - Falha de notification nao bloqueia o member create
 */

// FIX #620: substituído batch por runTransaction — mocks atualizados.
// tx.set/update/commit não existem; transação usa tx.set/tx.update diretamente
// e commit é implícito ao retornar do callback.
const mockTxSet = jest.fn();
const mockTxUpdate = jest.fn();

const mockMemberGet = jest.fn().mockResolvedValue({exists: false});
const mockBlockedGet = jest.fn().mockResolvedValue({exists: false});
const mockGroupGet = jest.fn().mockResolvedValue({
  exists: true,
  data: () => ({
    name: "Pelada Vila",
    photo_url: "https://example.com/g.jpg",
    member_count: 5,
  }),
});

const mockRunTransaction = jest.fn(
  async (callback: (tx: Record<string, unknown>) => Promise<void>) => {
    const tx = {
      get: jest.fn((ref: {get: () => Promise<unknown>}) => ref.get()),
      set: mockTxSet,
      update: mockTxUpdate,
    };
    return callback(tx);
  }
);

const mockDoc = jest.fn((path: string) => {
  if (path?.includes("/blocked_players/")) {
    return {path, get: mockBlockedGet};
  }
  if (path?.includes("/members/")) {
    return {path, get: mockMemberGet};
  }
  return {path, get: mockGroupGet};
});

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    increment: jest.fn((n: number) => ({_type: "Increment", value: n})),
  };
  const mockAdmin: Record<string, unknown> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      doc: mockDoc,
      runTransaction: mockRunTransaction,
    })),
    initializeApp: jest.fn(),
  };
  (mockAdmin.firestore as Record<string, unknown>).FieldValue = mockFieldValue;
  return mockAdmin;
});

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockSendNotification = jest.fn().mockResolvedValue(true);
jest.mock("../src/notifications/helpers", () => ({
  sendNotificationToUser: mockSendNotification,
  NotificationType: {
    GROUP_JOIN_APPROVED: "GROUP_JOIN_APPROVED",
  },
}));

jest.mock("../src/constants", () => ({
  FUNCTION_REGION: "us-central1",
}));

import {onJoinRequestApproved} from "../src/groups/join-requests";

interface MockEvent {
  data: {
    before: {data: () => unknown};
    after: {data: () => unknown};
  };
  params: {groupId: string; userId: string};
}

function makeEvent(beforeData: unknown, afterData: unknown): MockEvent {
  return {
    data: {
      before: {data: () => beforeData},
      after: {data: () => afterData},
    },
    params: {groupId: "g1", userId: "u1"},
  };
}

describe("onJoinRequestApproved", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMemberGet.mockResolvedValue({exists: false});
    mockBlockedGet.mockResolvedValue({exists: false});
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Pelada Vila",
        photo_url: "https://example.com/g.jpg",
        member_count: 5,
        // FIX #2798: owner_id necessário para validação de aprovador.
        // Nos testes existentes responded_by = "owner-uid" = owner_id → passa.
        owner_id: "owner-uid",
      }),
    });
    // Resetar runTransaction para comportamento padrão
    mockRunTransaction.mockImplementation(
      async (callback: (tx: Record<string, unknown>) => Promise<void>) => {
        const tx = {
          get: jest.fn((ref: {get: () => Promise<unknown>}) => ref.get()),
          set: mockTxSet,
          update: mockTxUpdate,
        };
        return callback(tx);
      }
    );
  });

  it("PENDING -> APPROVED cria member, incrementa counter e envia push", async () => {
    const event = makeEvent(
      {user_id: "u1", user_name: "User One", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        user_photo: "https://example.com/u.jpg",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).toHaveBeenCalled();
    // 1 tx.set member + 1 tx.set user/groups = 2 sets
    expect(mockTxSet).toHaveBeenCalledTimes(2);
    // 1 tx.update group counter
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    expect(mockSendNotification).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        type: "GROUP_JOIN_APPROVED",
        title: expect.stringContaining("Pedido aprovado"),
        body: expect.stringContaining("Pelada Vila"),
      })
    );
  });

  it("PENDING -> REJECTED nao faz nada", async () => {
    const event = makeEvent(
      {user_id: "u1", user_name: "User One", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "REJECTED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("APPROVED -> APPROVED (no-op update) nao reprocessa", async () => {
    const event = makeEvent(
      {user_id: "u1", user_name: "User One", status: "APPROVED"},
      {user_id: "u1", user_name: "User One", status: "APPROVED"}
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("idempotente: se member ja existe, nao reprocessa", async () => {
    mockMemberGet.mockResolvedValue({exists: true});

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("aborta se user_id no doc nao bate com event params", async () => {
    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "OUTRO_UID", // mismatch
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("aborta se nao tem responded_by", async () => {
    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {user_id: "u1", user_name: "User One", status: "APPROVED"}
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("aborta se grupo nao existe", async () => {
    mockGroupGet.mockResolvedValue({exists: false});

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("falha de push notification nao bloqueia member create", async () => {
    mockSendNotification.mockRejectedValueOnce(new Error("FCM down"));

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await expect(
      (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event)
    ).resolves.not.toThrow();

    expect(mockRunTransaction).toHaveBeenCalled();
  });

  // ==========================================
  // FIX #2798 — authz server-side do aprovador
  // ==========================================

  it("FIX #2798: aprovador que e owner do grupo passa a validacao", async () => {
    // Group meta retorna owner_id === responded_by
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Pelada Vila",
        photo_url: null,
        member_count: 3,
        owner_id: "owner-uid", // mesmo que responded_by abaixo
      }),
    });

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    // Deve ter criado o membro normalmente
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it("FIX #2798: aprovador com role ADMIN (nao owner) passa a validacao", async () => {
    // Group meta: owner_id diferente do aprovador
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Pelada Vila",
        photo_url: null,
        member_count: 3,
        owner_id: "different-owner",
      }),
    });

    // Primeiro memberGet = early-exit check (user nao eh membro ainda)
    // Segundo memberGet = txMember check
    // Terceiro memberGet = approver member check → retorna role ADMIN
    mockMemberGet
      .mockResolvedValueOnce({exists: false}) // target user nao eh membro
      .mockResolvedValueOnce({exists: false}) // txMember ainda nao existe
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({role: "ADMIN"}),
      }); // approver eh ADMIN

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "admin-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    // Admin autorizado — deve processar normalmente
    expect(mockRunTransaction).toHaveBeenCalled();
  });

  it("FIX #2798: aprovador sem role owner/admin aborta dentro da transação", async () => {
    const {logger} = require("firebase-functions/v2");

    // Group meta: owner_id diferente do aprovador
    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Pelada Vila",
        photo_url: null,
        member_count: 3,
        owner_id: "real-owner",
      }),
    });

    // Primeiro memberGet = target user nao eh membro
    // Segundo memberGet = txMember ainda nao existe
    // Terceiro memberGet = approver role = MEMBER (nao autorizado)
    mockMemberGet
      .mockResolvedValueOnce({exists: false})
      .mockResolvedValueOnce({exists: false})
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({role: "MEMBER"}),
      });

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "random-member-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    // Deve logar o erro de segurança
    expect(logger.error).toHaveBeenCalledWith(
      "join_request aprovado por não-owner/admin — bloqueado",
      expect.objectContaining({approverId: "random-member-uid"})
    );
  });

  it("FIX #2798: aprovador nao encontrado nos membros e bloqueado", async () => {
    const {logger} = require("firebase-functions/v2");

    mockGroupGet.mockResolvedValue({
      exists: true,
      data: () => ({
        name: "Grupo X",
        photo_url: null,
        member_count: 2,
        owner_id: "real-owner",
      }),
    });

    // Primeiro memberGet = target user não eh membro
    // Segundo memberGet = txMember ainda nao existe
    // Terceiro memberGet = aprovador não encontrado em /members/
    mockMemberGet
      .mockResolvedValueOnce({exists: false})
      .mockResolvedValueOnce({exists: false})
      .mockResolvedValueOnce({exists: false}); // aprovador não existe como membro

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "outsider-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "join_request aprovado por não-owner/admin — bloqueado",
      expect.objectContaining({approverId: "outsider-uid"})
    );
  });

  it("FIX #3829: usuário bloqueado não vira membro via join_request aprovado", async () => {
    const {logger} = require("firebase-functions/v2");

    mockMemberGet
      .mockResolvedValueOnce({exists: false})
      .mockResolvedValueOnce({exists: false});
    mockBlockedGet.mockResolvedValueOnce({exists: true});

    const event = makeEvent(
      {user_id: "u1", status: "PENDING"},
      {
        user_id: "u1",
        user_name: "User One",
        status: "APPROVED",
        responded_by: "owner-uid",
      }
    );

    await (onJoinRequestApproved as unknown as (e: MockEvent) => Promise<void>)(event);

    expect(mockRunTransaction).toHaveBeenCalled();
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockSendNotification).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "join_request approved for blocked user — aborting",
      expect.objectContaining({groupId: "g1", userId: "u1", approverId: "owner-uid"})
    );
  });
});
