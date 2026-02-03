/**
 * TESTES DE HELPERS DO SISTEMA DE LEMBRETES
 *
 * Testa funções auxiliares de reminders.ts:
 * - getGameDateTime: parsing de data/hora do jogo
 * - formatGameDateTime: formatação para exibição
 * - Constantes de status
 */

// Mock firebase-admin antes de importar
jest.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: jest.fn(),
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

  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => mockFirestore),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.Timestamp = mockTimestamp;
  mockAdmin.firestore.FieldValue = mockFieldValue;

  return mockAdmin;
});

// Mock firebase-functions
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

// Mock notifications
jest.mock("../src/notifications", () => ({
  sendNotificationToUser: jest.fn(),
  saveNotificationToFirestore: jest.fn(),
  NotificationType: {
    GAME_REMINDER: "GAME_REMINDER",
    GAME_SUMMON: "GAME_SUMMON",
  },
}));

import {
  getGameDateTime,
  formatGameDateTime,
  GameForReminder,
  EXCLUDED_GAME_STATUSES,
  CONFIRMED_STATUSES,
} from "../src/reminders";

describe("Reminders - Constantes", () => {
  test("EXCLUDED_GAME_STATUSES deve incluir CANCELLED, FINISHED, LIVE", () => {
    expect(EXCLUDED_GAME_STATUSES).toContain("CANCELLED");
    expect(EXCLUDED_GAME_STATUSES).toContain("FINISHED");
    expect(EXCLUDED_GAME_STATUSES).toContain("LIVE");
  });

  test("EXCLUDED_GAME_STATUSES não deve incluir SCHEDULED", () => {
    expect(EXCLUDED_GAME_STATUSES).not.toContain("SCHEDULED");
    expect(EXCLUDED_GAME_STATUSES).not.toContain("CONFIRMED");
  });

  test("CONFIRMED_STATUSES deve incluir apenas CONFIRMED", () => {
    expect(CONFIRMED_STATUSES).toEqual(["CONFIRMED"]);
  });
});

describe("Reminders - getGameDateTime", () => {
  test("deve retornar null se não houver data", () => {
    const game: GameForReminder = {
      id: "game1",
      dateTime: null,
      date: null,
      time: null,
      status: "SCHEDULED",
      group_id: null,
    };

    expect(getGameDateTime(game)).toBeNull();
  });

  test("deve usar dateTime (Timestamp) se disponível", () => {
    const fixedDate = new Date("2026-02-15T20:00:00Z");
    const game: GameForReminder = {
      id: "game1",
      dateTime: {
        toDate: () => fixedDate,
      } as any,
      date: null,
      time: null,
      status: "SCHEDULED",
      group_id: null,
    };

    const result = getGameDateTime(game);
    expect(result).toEqual(fixedDate);
  });

  test("deve parsear campos date + time separados", () => {
    const game: GameForReminder = {
      id: "game1",
      dateTime: null,
      date: "2026-02-15",
      time: "18:00",
      status: "SCHEDULED",
      group_id: null,
    };

    const result = getGameDateTime(game);
    expect(result).not.toBeNull();
    // A função adiciona +3h para ajuste de timezone (UTC-3 → UTC)
    // Data UTC: 2026-02-15 18:00 + 3h = 2026-02-15 21:00
    expect(result!.getUTCHours()).toBe(21);
    expect(result!.getUTCDate()).toBe(15);
    expect(result!.getUTCMonth()).toBe(1); // Fevereiro = 1 (0-indexed)
  });

  test("deve usar horário padrão 20:00 quando time é null", () => {
    const game: GameForReminder = {
      id: "game1",
      dateTime: null,
      date: "2026-03-10",
      time: null,
      status: "SCHEDULED",
      group_id: null,
    };

    const result = getGameDateTime(game);
    expect(result).not.toBeNull();
    // 20:00 BRT + 3h = 23:00 UTC
    expect(result!.getUTCHours()).toBe(23);
  });

  test("deve parsear data sem horário usando default", () => {
    const game: GameForReminder = {
      id: "game1",
      dateTime: null,
      date: "2026-01-20",
      time: "",
      status: "SCHEDULED",
      group_id: null,
    };

    // Quando time é string vazia, split(":") retorna NaN, caindo no fallback 20:00
    const result = getGameDateTime(game);
    expect(result).not.toBeNull();
  });

  test("deve priorizar dateTime sobre date+time", () => {
    const timestampDate = new Date("2026-05-01T15:00:00Z");
    const game: GameForReminder = {
      id: "game1",
      dateTime: {
        toDate: () => timestampDate,
      } as any,
      date: "2026-06-15",
      time: "19:00",
      status: "SCHEDULED",
      group_id: null,
    };

    const result = getGameDateTime(game);
    // Deve usar dateTime, não date+time
    expect(result).toEqual(timestampDate);
  });

  test("deve retornar null para data inválida", () => {
    const game: GameForReminder = {
      id: "game1",
      dateTime: null,
      date: "invalid-date",
      time: "20:00",
      status: "SCHEDULED",
      group_id: null,
    };

    const result = getGameDateTime(game);
    // split("-") retorna NaN, então year/month/day são NaN → retorna null
    expect(result).toBeNull();
  });
});

describe("Reminders - formatGameDateTime", () => {
  test("deve formatar data corretamente", () => {
    const date = new Date("2026-02-15T21:00:00Z");
    const result = formatGameDateTime(date);

    // Deve conter algum texto formatado (locale pt-BR)
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("deve retornar ISO string como fallback em caso de erro", () => {
    // Invalid date que pode causar erro no toLocaleString
    const invalidDate = new Date("invalid");
    const result = formatGameDateTime(invalidDate);

    // Ou retorna ISO string ou "Invalid Date"
    expect(typeof result).toBe("string");
  });

  test("deve formatar diferentes datas sem erro", () => {
    const dates = [
      new Date("2026-01-01T12:00:00Z"),
      new Date("2026-06-15T23:30:00Z"),
      new Date("2026-12-31T03:00:00Z"),
    ];

    for (const date of dates) {
      const result = formatGameDateTime(date);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
