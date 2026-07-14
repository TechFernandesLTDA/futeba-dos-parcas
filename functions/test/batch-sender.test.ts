/**
 * TESTES DO BATCH SENDER DE NOTIFICAÇÕES
 *
 * Testa as funções de enfileiramento e envio em batch
 * do módulo notifications/batch-sender.ts:
 * - enqueueNotification: enfileira notificação única
 * - enqueueNotifications: enfileira múltiplas notificações
 *  */

jest.mock("../src/middleware/rate-limiter");

// ==========================================
// MOCKS DO FIREBASE ADMIN
// ==========================================

const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocId = "mocked-queue-doc-id";
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockQueryGet = jest.fn();
const mockMessagingSendEach = jest.fn();
const mockCollectionAdd = jest.fn().mockResolvedValue({ id: "metrics-doc-id" });

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({})),
    delete: jest.fn(() => ({ _type: "FieldValueDelete" })),
    arrayUnion: jest.fn((...values: unknown[]) => ({ _type: "FieldValueArrayUnion", values })),
    arrayRemove: jest.fn((...values: unknown[]) => ({ _type: "FieldValueArrayRemove", values })),
    increment: jest.fn((n: number) => ({ _type: "Increment", operand: n })),
  };

  const mockTimestamp = {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      _type: "Timestamp",
    })),
    now: jest.fn(() => ({
      toDate: () => new Date(),
      _type: "Timestamp",
    })),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          id: mockDocId,
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
        }),
        add: mockCollectionAdd,
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: mockQueryGet,
      }),
      batch: jest.fn(() => ({
        set: mockBatchSet,
        update: mockBatchUpdate,
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
      // FIX #2324: stub de runTransaction para o claim atômico
      // (PENDING→PROCESSING) em processNotificationQueue. Os testes atuais
      // não exercitam essa função, mas o stub evita crash caso passem a fazê-lo.
      runTransaction: jest.fn(
        async (
          fn: (tx: { get: jest.Mock; update: jest.Mock }) => Promise<unknown>
        ) => fn({ get: mockDocGet, update: mockDocUpdate })
      ),
    })),
    messaging: jest.fn(() => ({
      sendEachForMulticast: mockMessagingSendEach,
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = mockTimestamp;
  mockAdmin.firestore.FieldPath = {
    documentId: jest.fn(() => "__name__"),
  };

  return mockAdmin;
});

// Mock das funções de scheduler/https do Firebase
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn(() => jest.fn()),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import {
  __testing,
  enqueueNotification,
  enqueueNotifications,
  QueuedNotification,
} from "../src/notifications/batch-sender";

// ==========================================
// enqueueNotification
// ==========================================

describe("enqueueNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocSet.mockResolvedValue(undefined);
  });

  test("deve enfileirar notificação e retornar ID do documento", async () => {
    const notification: QueuedNotification = {
      userIds: ["user1", "user2"],
      title: "Jogo criado",
      body: "Novo jogo disponível",
      type: "GAME_INVITE",
    };

    const queueId = await enqueueNotification(notification);

    expect(queueId).toBe(mockDocId);
    expect(mockDocSet).toHaveBeenCalledTimes(1);
  });

  test("deve definir status PENDING ao enfileirar", async () => {
    const notification: QueuedNotification = {
      userIds: ["user1"],
      title: "MVP!",
      body: "Você foi eleito MVP",
      type: "MVP_RECEIVED",
    };

    await enqueueNotification(notification);

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        userIds: ["user1"],
        title: "MVP!",
        body: "Você foi eleito MVP",
        type: "MVP_RECEIVED",
      })
    );
  });

  test("deve usar prioridade NORMAL por padrão", async () => {
    const notification: QueuedNotification = {
      userIds: ["user1"],
      title: "Teste",
      body: "Mensagem",
      type: "GAME_INVITE",
    };

    await enqueueNotification(notification);

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "NORMAL",
      })
    );
  });

  test("deve respeitar prioridade HIGH quando especificada", async () => {
    const notification: QueuedNotification = {
      userIds: ["user1"],
      title: "Urgente",
      body: "Convocação imediata",
      type: "GAME_SUMMON",
      priority: "HIGH",
    };

    await enqueueNotification(notification);

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "HIGH",
      })
    );
  });

  test("deve retornar string vazia quando lista de userIds está vazia", async () => {
    const notification: QueuedNotification = {
      userIds: [],
      title: "Teste",
      body: "Mensagem",
      type: "GAME_INVITE",
    };

    const queueId = await enqueueNotification(notification);

    expect(queueId).toBe("");
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  test("deve incluir dados adicionais no documento", async () => {
    const notification: QueuedNotification = {
      userIds: ["user1"],
      title: "Jogo",
      body: "Detalhes do jogo",
      type: "GAME_CONFIRMED",
      data: { gameId: "game123", groupId: "group456" },
      imageUrl: "https://example.com/image.jpg",
    };

    await enqueueNotification(notification);

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { gameId: "game123", groupId: "group456" },
        imageUrl: "https://example.com/image.jpg",
      })
    );
  });

  test("deve incluir createdAt com serverTimestamp", async () => {
    const notification: QueuedNotification = {
      userIds: ["user1"],
      title: "Teste",
      body: "Mensagem",
      type: "GAME_INVITE",
    };

    await enqueueNotification(notification);

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        createdAt: expect.any(Object),
      })
    );
  });
});

// ==========================================
// enqueueNotifications (batch)
// ==========================================

describe("enqueueNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  test("deve retornar 0 para lista vazia", async () => {
    const count = await enqueueNotifications([]);

    expect(count).toBe(0);
    expect(mockBatchSet).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  test("deve enfileirar múltiplas notificações via batch", async () => {
    const notifications: QueuedNotification[] = [
      {
        userIds: ["user1"],
        title: "Notif 1",
        body: "Corpo 1",
        type: "GAME_INVITE",
      },
      {
        userIds: ["user2"],
        title: "Notif 2",
        body: "Corpo 2",
        type: "GAME_CONFIRMED",
      },
      {
        userIds: ["user3"],
        title: "Notif 3",
        body: "Corpo 3",
        type: "ACHIEVEMENT",
      },
    ];

    const count = await enqueueNotifications(notifications);

    expect(count).toBe(3);
    expect(mockBatchSet).toHaveBeenCalledTimes(3);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  test("deve ignorar notificações com userIds vazio", async () => {
    const notifications: QueuedNotification[] = [
      {
        userIds: ["user1"],
        title: "Válida",
        body: "Tem destinatário",
        type: "GAME_INVITE",
      },
      {
        userIds: [], // deve ser ignorada
        title: "Inválida",
        body: "Sem destinatário",
        type: "GAME_INVITE",
      },
      {
        userIds: ["user2"],
        title: "Válida 2",
        body: "Tem destinatário",
        type: "GAME_CONFIRMED",
      },
    ];

    const count = await enqueueNotifications(notifications);

    // Apenas 2 notificações válidas devem ser enfileiradas
    expect(count).toBe(2);
    expect(mockBatchSet).toHaveBeenCalledTimes(2);
  });

  test("deve definir status PENDING em todas as notificações batch", async () => {
    const notifications: QueuedNotification[] = [
      {
        userIds: ["user1"],
        title: "Teste",
        body: "Mensagem",
        type: "GAME_INVITE",
      },
    ];

    await enqueueNotifications(notifications);

    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: "PENDING" })
    );
  });

  test("deve usar prioridade NORMAL por padrão nas notificações batch", async () => {
    const notifications: QueuedNotification[] = [
      {
        userIds: ["user1"],
        title: "Teste",
        body: "Mensagem",
        type: "GAME_INVITE",
      },
    ];

    await enqueueNotifications(notifications);

    expect(mockBatchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ priority: "NORMAL" })
    );
  });

  test("deve fazer commit do batch mesmo quando há apenas 1 notificação", async () => {
    const notifications: QueuedNotification[] = [
      {
        userIds: ["user1"],
        title: "Notif única",
        body: "Mensagem",
        type: "LEVEL_UP",
      },
    ];

    await enqueueNotifications(notifications);

    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  test("deve incluir createdAt com serverTimestamp em todas", async () => {
    const notifications: QueuedNotification[] = [
      { userIds: ["user1"], title: "T1", body: "B1", type: "GAME_INVITE" },
      { userIds: ["user2"], title: "T2", body: "B2", type: "GAME_CONFIRMED" },
    ];

    await enqueueNotifications(notifications);

    const calls = mockBatchSet.mock.calls;
    for (const call of calls) {
      expect(call[1]).toMatchObject({
        createdAt: expect.any(Object),
      });
    }
  });
});

describe("batch-sender retry por token", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("buildDispatchTokens reenvia apenas tokens pendentes em retry", () => {
    const tokenMap = new Map<string, string[]>([
      ["user1", ["token-a", "token-b"]],
      ["user2", ["token-c"]],
    ]);

    const dispatch = __testing.buildDispatchTokens(
      ["user1", "user2"],
      tokenMap,
      ["token-b"],
      ["token-a"]
    );

    expect(dispatch.tokens).toEqual(["token-b"]);
    expect(Array.from(dispatch.tokenToUser.entries())).toEqual([
      ["token-b", "user1"],
    ]);
  });

  test("sendMulticastInChunks mantém retry do token transiente mesmo com sucesso em outro device do mesmo usuário", async () => {
    mockMessagingSendEach.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        {success: true},
        {success: false, error: {code: "messaging/server-unavailable"}},
      ],
    });

    const result = await __testing.sendMulticastInChunks(
      ["token-a", "token-b"],
      new Map<string, string>([
        ["token-a", "user1"],
        ["token-b", "user1"],
      ]),
      {
        title: "Teste",
        body: "Mensagem",
        type: "GAME_INVITE",
        data: {},
      }
    );

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.transientFailed).toBe(1);
    expect(Array.from(result.deliveredTokens)).toEqual(["token-a"]);
    expect(Array.from(result.pendingTokens)).toEqual(["token-b"]);
    expect(Array.from(result.deliveredUserIds)).toEqual(["user1"]);
    expect(Array.from(result.pendingUserIds)).toEqual(["user1"]);
  });

  test("persiste chunk entregue antes de interromper e retry não o reenvia", async () => {
    const tokens = Array.from(
      {length: 501},
      (_, index) => `token-${index}`
    );
    const tokenToUser = new Map(
      tokens.map((token, index) => [token, `user-${index}`])
    );
    mockMessagingSendEach.mockResolvedValueOnce({
      successCount: 500,
      failureCount: 0,
      responses: Array.from({length: 500}, () => ({success: true})),
    });

    let checkpoint = {
      deliveredTokens: [] as string[],
      pendingTokens: [...tokens],
    };

    await expect(
      __testing.sendMulticastInChunks(
        tokens,
        tokenToUser,
        {
          title: "Teste",
          body: "Mensagem",
          type: "GAME_INVITE",
          data: {},
        },
        async (progress) => {
          checkpoint = __testing.mergeChunkCheckpoint(
            checkpoint,
            progress
          );
          throw new Error("interrupção simulada após checkpoint");
        }
      )
    ).rejects.toThrow("interrupção simulada após checkpoint");

    expect(mockMessagingSendEach).toHaveBeenCalledTimes(1);
    expect(checkpoint.deliveredTokens).toHaveLength(500);
    expect(checkpoint.pendingTokens).toEqual(["token-500"]);

    const retryDispatch = __testing.buildDispatchTokens(
      Array.from(tokenToUser.values()),
      new Map(
        tokens.map((token, index) => [`user-${index}`, [token]])
      ),
      checkpoint.pendingTokens,
      checkpoint.deliveredTokens
    );
    expect(retryDispatch.tokens).toEqual(["token-500"]);
  });

  test("checkpoint mantém apenas falhas transientes e chunks futuros pendentes", () => {
    const checkpoint = __testing.mergeChunkCheckpoint(
      {
        deliveredTokens: ["token-anterior"],
        pendingTokens: ["token-a", "token-b", "token-c"],
      },
      {
        chunkTokens: ["token-a", "token-b"],
        deliveredTokens: ["token-a"],
        pendingTokens: ["token-b"],
      }
    );

    expect(checkpoint.deliveredTokens).toEqual([
      "token-anterior",
      "token-a",
    ]);
    expect(checkpoint.pendingTokens).toEqual(["token-c", "token-b"]);
  });

  test("exceção de transporte mantém chunk inteiro pendente mesmo se próximo chunk for entregue", async () => {
    const tokens = Array.from(
      {length: 501},
      (_, index) => `token-${index}`
    );
    const tokenToUser = new Map(
      tokens.map((token, index) => [token, `user-${index}`])
    );
    mockMessagingSendEach
      .mockRejectedValueOnce(new Error("FCM indisponível"))
      .mockResolvedValueOnce({
        successCount: 1,
        failureCount: 0,
        responses: [{success: true}],
      });

    let checkpoint = {
      deliveredTokens: [] as string[],
      pendingTokens: [...tokens],
    };
    const result = await __testing.sendMulticastInChunks(
      tokens,
      tokenToUser,
      {
        title: "Teste",
        body: "Mensagem",
        type: "GAME_INVITE",
        data: {},
      },
      async (progress) => {
        checkpoint = __testing.mergeChunkCheckpoint(
          checkpoint,
          progress
        );
      }
    );

    expect(mockMessagingSendEach).toHaveBeenCalledTimes(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.transientFailed).toBe(500);
    expect(Array.from(result.pendingTokens)).toEqual(tokens.slice(0, 500));
    expect(Array.from(result.deliveredTokens)).toEqual(["token-500"]);
    expect(checkpoint.pendingTokens).toEqual(tokens.slice(0, 500));
    expect(checkpoint.deliveredTokens).toEqual(["token-500"]);
  });

  test("totalTargeted deduplica usuário elegível em docs com preferências distintas", () => {
    const targetedUserIds = new Set<string>();

    // doc GAME_INVITE: user-overlap e user-a permitidos.
    __testing.addTargetedUserIds(
      targetedUserIds,
      ["user-overlap", "user-a"]
    );
    // doc ACHIEVEMENT: user-overlap foi bloqueado; user-b permitido.
    __testing.addTargetedUserIds(targetedUserIds, ["user-b"]);
    // terceiro doc permitido repete user-overlap.
    __testing.addTargetedUserIds(
      targetedUserIds,
      ["user-overlap"]
    );

    expect(targetedUserIds.size).toBe(3);
    expect(Array.from(targetedUserIds)).toEqual([
      "user-overlap",
      "user-a",
      "user-b",
    ]);
  });
});
