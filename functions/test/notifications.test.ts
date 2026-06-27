/**
 * TESTES DAS FUNÇÕES AUXILIARES DE NOTIFICAÇÕES
 *
 * Testa funções puras e auxiliares exportadas de notifications.ts:
 * - NotificationType enum (todos os tipos)
 * - STREAK_MILESTONES constante
 * - isTransientError / isInvalidTokenError (via comportamento)
 * - sendNotificationToUser (mock Firebase)
 * - sendNotificationToUsers (mock Firebase)
 * - saveNotificationToFirestore (mock Firebase)
 */

jest.mock("../src/middleware/rate-limiter");

// Mock do firebase-admin
const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocAdd = jest.fn().mockResolvedValue({ id: "notif-doc-id" });
const mockMessagingSend = jest.fn();
const mockMessagingSendEach = jest.fn();

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    delete: jest.fn(() => ({ _type: "FieldValueDelete" })),
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
          id: "notif-doc-id",
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
        }),
        add: mockDocAdd,
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      })),
      runTransaction: jest.fn(),
    })),
    messaging: jest.fn(() => ({
      send: mockMessagingSend,
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

// Mock das funções de trigger do Firebase (não precisamos delas em unit tests)
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn(() => jest.fn()),
  onDocumentUpdated: jest.fn(() => jest.fn()),
  onDocumentDeleted: jest.fn(() => jest.fn()),
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

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

import {
  NotificationType,
  STREAK_MILESTONES,
  sendNotificationToUser,
  sendNotificationToUsers,
  saveNotificationToFirestore,
} from "../src/notifications";
import { resetDb } from "../src/_db";
import { shouldNotifyUser } from "../src/notifications/helpers";
import { getNotificationSettings } from "../src/notifications/preferences";

// ==========================================
// NOTIFICATION TYPE ENUM
// ==========================================

describe("NotificationType enum", () => {
  test("deve ter tipo CHECKIN compativel com regras do Firestore", () => {
    expect(NotificationType.CHECKIN).toBe("checkin");
  });

  test("deve ter tipo GAME_INVITE", () => {
    expect(NotificationType.GAME_INVITE).toBe("GAME_INVITE");
  });

  test("deve ter tipo GAME_CONFIRMED", () => {
    expect(NotificationType.GAME_CONFIRMED).toBe("GAME_CONFIRMED");
  });

  test("deve ter tipo GAME_CANCELLED", () => {
    expect(NotificationType.GAME_CANCELLED).toBe("GAME_CANCELLED");
  });

  test("deve ter tipo GAME_SUMMON", () => {
    expect(NotificationType.GAME_SUMMON).toBe("GAME_SUMMON");
  });

  test("deve ter tipo GAME_REMINDER", () => {
    expect(NotificationType.GAME_REMINDER).toBe("GAME_REMINDER");
  });

  test("deve ter tipo GAME_UPDATED", () => {
    expect(NotificationType.GAME_UPDATED).toBe("GAME_UPDATED");
  });

  test("deve ter tipo GAME_VACANCY", () => {
    expect(NotificationType.GAME_VACANCY).toBe("GAME_VACANCY");
  });

  test("deve ter tipo GROUP_INVITE", () => {
    expect(NotificationType.GROUP_INVITE).toBe("GROUP_INVITE");
  });

  test("deve ter tipo GROUP_INVITE_ACCEPTED", () => {
    expect(NotificationType.GROUP_INVITE_ACCEPTED).toBe("GROUP_INVITE_ACCEPTED");
  });

  test("deve ter tipo GROUP_INVITE_DECLINED", () => {
    expect(NotificationType.GROUP_INVITE_DECLINED).toBe("GROUP_INVITE_DECLINED");
  });

  test("deve ter tipo MEMBER_JOINED", () => {
    expect(NotificationType.MEMBER_JOINED).toBe("MEMBER_JOINED");
  });

  test("deve ter tipo MEMBER_LEFT", () => {
    expect(NotificationType.MEMBER_LEFT).toBe("MEMBER_LEFT");
  });

  test("deve ter tipo CASHBOX_ENTRY", () => {
    expect(NotificationType.CASHBOX_ENTRY).toBe("CASHBOX_ENTRY");
  });

  test("deve ter tipo CASHBOX_EXIT", () => {
    expect(NotificationType.CASHBOX_EXIT).toBe("CASHBOX_EXIT");
  });

  test("deve ter tipo ACHIEVEMENT", () => {
    expect(NotificationType.ACHIEVEMENT).toBe("ACHIEVEMENT");
  });

  test("deve ter tipo LEVEL_UP", () => {
    expect(NotificationType.LEVEL_UP).toBe("LEVEL_UP");
  });

  test("deve ter tipo RANKING_CHANGED", () => {
    expect(NotificationType.RANKING_CHANGED).toBe("RANKING_CHANGED");
  });

  test("deve ter tipo MVP_RECEIVED", () => {
    expect(NotificationType.MVP_RECEIVED).toBe("MVP_RECEIVED");
  });

  test("todos os tipos devem ser strings não vazias", () => {
    for (const [key, value] of Object.entries(NotificationType)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      if (key === "CHECKIN") {
        expect(value).toBe("checkin");
      } else {
        // Tipos historicos sao serializados com o mesmo valor da chave.
        expect(value).toBe(key);
      }
    }
  });
});

// ==========================================
// STREAK_MILESTONES
// ==========================================

describe("STREAK_MILESTONES", () => {
  test("deve ser um array de objetos com streak, title, body", () => {
    expect(Array.isArray(STREAK_MILESTONES)).toBe(true);
    expect(STREAK_MILESTONES.length).toBeGreaterThan(0);
  });

  test("cada milestone deve ter streak, title e body", () => {
    for (const milestone of STREAK_MILESTONES) {
      expect(typeof milestone.streak).toBe("number");
      expect(milestone.streak).toBeGreaterThan(0);
      expect(typeof milestone.title).toBe("string");
      expect(milestone.title.length).toBeGreaterThan(0);
      expect(typeof milestone.body).toBe("string");
      expect(milestone.body.length).toBeGreaterThan(0);
    }
  });

  test("deve conter marcos padrão (3, 7, 10) como streak values", () => {
    const streaks = STREAK_MILESTONES.map((m) => m.streak);
    expect(streaks).toContain(7);
    expect(streaks).toContain(10);
  });
});

// ==========================================
// sendNotificationToUser
// ==========================================

describe("sendNotificationToUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve retornar false quando usuário não tem token FCM", async () => {
    // Simula usuário sem token
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ name: "Test User" }), // sem fcm_token
    });

    const result = await sendNotificationToUser("user1", {
      title: "Teste",
      body: "Mensagem teste",
      type: NotificationType.GAME_INVITE,
    });

    expect(result).toBe(false);
    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  test("deve retornar false quando usuário não existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => null,
    });

    const result = await sendNotificationToUser("user-inexistente", {
      title: "Teste",
      body: "Mensagem teste",
      type: NotificationType.GAME_CONFIRMED,
    });

    expect(result).toBe(false);
    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  test("deve enviar notificação com sucesso quando token existe", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ fcm_token: "valid-fcm-token-123" }),
    });
    mockMessagingSend.mockResolvedValue("message-id-123");

    const result = await sendNotificationToUser("user1", {
      title: "Jogo confirmado!",
      body: "Seu jogo foi confirmado",
      type: NotificationType.GAME_CONFIRMED,
    });

    expect(result).toBe(true);
    expect(mockMessagingSend).toHaveBeenCalledTimes(1);
  });

  test("deve incluir dados extras no payload FCM", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ fcm_token: "valid-token" }),
    });
    mockMessagingSend.mockResolvedValue("message-id");

    await sendNotificationToUser("user1", {
      title: "MVP!",
      body: "Você foi eleito MVP",
      type: NotificationType.MVP_RECEIVED,
      data: { gameId: "game123", groupId: "group456" },
    });

    expect(mockMessagingSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "valid-token",
        notification: expect.objectContaining({
          title: "MVP!",
          body: "Você foi eleito MVP",
        }),
      })
    );
  });

  test("deve remover token inválido quando FCM retorna erro de token", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ fcm_token: "invalid-token" }),
    });

    const fcmError = {
      code: "messaging/registration-token-not-registered",
      message: "Token não registrado",
    };
    mockMessagingSend.mockRejectedValue(fcmError);

    const result = await sendNotificationToUser("user1", {
      title: "Teste",
      body: "Mensagem",
      type: NotificationType.GAME_INVITE,
    });

    expect(result).toBe(false);
    // Deve ter tentado remover o token inválido
    expect(mockDocUpdate).toHaveBeenCalled();
  });

  test("deve retornar false em erros transientes após retries", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ fcm_token: "token-123" }),
    });

    const transientError = {
      code: "messaging/server-unavailable",
      message: "Server unavailable",
    };
    mockMessagingSend.mockRejectedValue(transientError);

    const result = await sendNotificationToUser("user1", {
      title: "Teste",
      body: "Mensagem",
      type: NotificationType.GAME_INVITE,
    });

    expect(result).toBe(false);
  });
});

// ==========================================
// sendNotificationToUsers
// ==========================================

describe("sendNotificationToUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDb();
  });

  test("deve retornar 0 quando lista de usuários está vazia", async () => {
    const result = await sendNotificationToUsers([], {
      title: "Teste",
      body: "Mensagem",
      type: NotificationType.GAME_INVITE,
    });

    expect(result).toBe(0);
    expect(mockMessagingSend).not.toHaveBeenCalled();
  });

  test("deve enviar para múltiplos usuários com tokens válidos", async () => {
    // sendNotificationToUsers usa whereIn query — mock da query de collection
    const mockDocs = [
      { id: "user1", data: () => ({ fcm_token: "token-user1" }) },
      { id: "user2", data: () => ({ fcm_token: "token-user2" }) },
    ];
    // O mock do firestore usa .where().get() na collection
    // Como mockWhere retorna this (a collection mock), .get() = mockCollectionQueryGet
    // Injetar via mock da collection
    const mockCollectionQueryGet = jest.fn().mockResolvedValue({
      empty: false,
      docs: mockDocs,
      size: 2,
    });

    // FIX #785: shouldNotifyUser lê users/{uid}.notification_preferences.
    // Stub mockDocGet pra retornar perfil com push habilitado (default).
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        notification_preferences: { push_enabled: true },
        mute_groups: [],
      }),
    });

    // Reconfigurar o mock do firestore para esta query específica.
    // Usa mockReturnValue (não Once) — shouldNotifyUser chama getDb() N vezes
    // (uma por user) + sendNotificationToUsers chama mais 2x p/ token fetch.
    const admin = require("firebase-admin");
    admin.firestore.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          id: "notif-doc-id",
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
        }),
        add: mockDocAdd,
        where: jest.fn().mockReturnValue({
          get: mockCollectionQueryGet,
        }),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      })),
      runTransaction: jest.fn(),
    });

    mockMessagingSendEach.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [
        { success: true },
        { success: true },
      ],
    });

    const result = await sendNotificationToUsers(["user1", "user2"], {
      title: "Jogo criado",
      body: "Novo jogo disponível",
      type: NotificationType.GAME_INVITE,
    });

    expect(result).toBe(2);
  });

  test("deve retornar 0 quando nenhum usuário tem token FCM", async () => {
    // shouldNotifyUser ainda passa (push habilitado) mas tokens vêm vazios
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        notification_preferences: { push_enabled: true },
        mute_groups: [],
      }),
    });
    // Sem tokens na query — usar mockReturnValue (não Once) pra sobrepor
    // o stub sticky deixado por testes anteriores.
    const admin = require("firebase-admin");
    admin.firestore.mockReturnValue({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          id: "notif-doc-id",
          get: mockDocGet,
          set: mockDocSet,
          update: mockDocUpdate,
        }),
        add: mockDocAdd,
        where: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            empty: false,
            docs: [
              { id: "user1", data: () => ({}) }, // sem fcm_token
              { id: "user2", data: () => ({}) },
            ],
            size: 2,
          }),
        }),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      })),
      runTransaction: jest.fn(),
    });

    const result = await sendNotificationToUsers(["user1", "user2"], {
      title: "Teste",
      body: "Mensagem",
      type: NotificationType.GAME_INVITE,
    });

    expect(result).toBe(0);
  });
});

// ==========================================
// saveNotificationToFirestore
// ==========================================

describe("saveNotificationToFirestore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deve salvar notificação no Firestore", async () => {
    await saveNotificationToFirestore("user1", {
      userId: "user1",
      title: "Notificação teste",
      body: "Corpo da notificação",
      type: NotificationType.ACHIEVEMENT,
    });

    expect(mockDocSet).toHaveBeenCalled();
  });

  test("deve incluir campos obrigatórios ao salvar", async () => {
    await saveNotificationToFirestore("user1", {
      userId: "user1",
      title: "Novo nível!",
      body: "Você subiu para o nível 5",
      type: NotificationType.LEVEL_UP,
      gameId: "game123",
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Novo nível!",
        body: "Você subiu para o nível 5",
        type: NotificationType.LEVEL_UP,
      })
    );
  });

  test("deve incluir game_id quando gameId fornecido", async () => {
    await saveNotificationToFirestore("user1", {
      userId: "user1",
      title: "Convocação",
      body: "Você foi convocado",
      type: NotificationType.GAME_SUMMON,
      gameId: "game-xyz",
    });

    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        game_id: "game-xyz",
      })
    );
  });
});

// ==========================================
// FIX #2477 — opt-out de notificação (schema canônico reader↔writer)
// Regressão recorrente #785/#926/#1143. Estes testes provam que o GATE
// (shouldNotifyUser) de fato SUPRIME quando o usuário desativa, lendo
// `notification_settings/{uid}` e tolerando AMBOS os casings: snake (web) e
// camel (android). O teste anterior validava o schema FANTASMA
// (`users.notification_preferences`), dando falsa confiança verde.
// ==========================================

describe("shouldNotifyUser opt-out (#2477)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Stub do doc notification_settings/{uid}.
  const stubSettings = (data: Record<string, unknown> | null) => {
    mockDocGet.mockResolvedValue({
      exists: data !== null,
      data: () => data ?? undefined,
    });
  };

  test("suprime quando push global desativado (WEB snake_case)", async () => {
    stubSettings({ push_enabled: false });
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(false);
  });

  test("suprime quando push global desativado (ANDROID camelCase)", async () => {
    stubSettings({ enablePushNotifications: false });
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(false);
  });

  test("suprime tipo específico — MVP (web mvp_votes=false)", async () => {
    stubSettings({ mvp_votes: false });
    expect(await shouldNotifyUser("u1", "MVP_RECEIVED")).toBe(false);
  });

  test("suprime invites (android enableInviteNotifications=false)", async () => {
    stubSettings({ enableInviteNotifications: false });
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(false);
  });

  test("suprime lembrete (web game_reminders=false)", async () => {
    stubSettings({ game_reminders: false });
    expect(await shouldNotifyUser("u1", "GAME_REMINDER")).toBe(false);
  });

  test("suprime quando silenciado (web mute_until futuro)", async () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    stubSettings({ mute_until: future });
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(false);
  });

  test("NÃO suprime mute_until passado", async () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    stubSettings({ mute_until: past });
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(true);
  });

  test("fail-open: tipo sem toggle dedicado é permitido", async () => {
    // mvp_votes off não afeta GAME_CONFIRMED (sem toggle mapeado)
    stubSettings({ mvp_votes: false });
    expect(await shouldNotifyUser("u1", "GAME_CONFIRMED")).toBe(true);
  });

  test("fail-open: doc ausente => permite", async () => {
    stubSettings(null);
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(true);
  });

  test("permite quando push habilitado explicitamente (snake)", async () => {
    stubSettings({ push_enabled: true, game_invites: true });
    expect(await shouldNotifyUser("u1", "GAME_INVITE")).toBe(true);
  });
});

describe("getNotificationSettings normalização (#2477)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const stub = (data: Record<string, unknown> | null) => {
    mockDocGet.mockResolvedValue({
      exists: data !== null,
      data: () => data ?? undefined,
    });
  };

  test("normaliza snake_case (web)", async () => {
    stub({ push_enabled: false, game_reminders: false });
    const s = await getNotificationSettings("u1");
    expect(s.pushEnabled).toBe(false);
    expect(s.gameReminders).toBe(false);
  });

  test("normaliza camelCase (android)", async () => {
    stub({ enablePushNotifications: false, enableGameReminders: false });
    const s = await getNotificationSettings("u1");
    expect(s.pushEnabled).toBe(false);
    expect(s.gameReminders).toBe(false);
  });

  test("fail-open quando campos ausentes", async () => {
    stub({});
    const s = await getNotificationSettings("u1");
    expect(s.pushEnabled).toBe(true);
    expect(s.gameReminders).toBe(true);
    expect(s.muteUntil).toBeNull();
  });
});
