/**
 * TESTES DE HELPERS DO SISTEMA DE LEMBRETES
 *
 * Testa funções auxiliares de reminders.ts:
 * - getGameDateTime: parsing de data/hora do jogo
 * - formatGameDateTime: formatação para exibição
 * - Constantes de status
 */

// Mock firebase-admin antes de importar
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockStartAfter = jest.fn();

const queryChain: any = {
  where: mockWhere,
  limit: mockLimit,
  startAfter: mockStartAfter,
  get: mockCollectionGet,
};
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockStartAfter.mockReturnValue(queryChain);

jest.mock("firebase-admin", () => {
  const mockFirestore = {
    collection: jest.fn(() => queryChain),
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
  fetchGamesInReminderWindow,
  fetchPendingConfirmations,
  GameForReminder,
  EXCLUDED_GAME_STATUSES,
  CONFIRMED_STATUSES,
  REMINDER_PENDING_STATUSES,
  WINDOW_TOLERANCE_MS,
} from "../src/reminders";

beforeEach(() => {
  jest.clearAllMocks();
  mockWhere.mockReturnValue(queryChain);
  mockLimit.mockReturnValue(queryChain);
  mockStartAfter.mockReturnValue(queryChain);
});

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

  test("REMINDER_PENDING_STATUSES deve conter apenas status elegíveis para lembrete", () => {
    expect(REMINDER_PENDING_STATUSES).toEqual([
      "PENDING",
      "WAITLIST",
      "ON_THE_WAY",
      "CHECKED_IN",
    ]);
  });

  test("WINDOW_TOLERANCE_MS deve manter overlap defensivo entre execuções horárias", () => {
    expect(WINDOW_TOLERANCE_MS).toBe(40 * 60 * 1000);
    expect(WINDOW_TOLERANCE_MS).toBeGreaterThan(30 * 60 * 1000);
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

  // TODO #650-FU: tests assumem runner em UTC (CI Linux). Local BRT
  // (Mac dev) faz getTime() já em BRT, +3h dá UTC do dia seguinte.
  // Source comportamento OK em prod (Cloud Functions UTC). Tests skip
  // até pinar TZ='UTC' no jest setup.
  test.skip("deve parsear campos date + time separados", () => {
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
    expect(result!.getUTCHours()).toBe(21);
    expect(result!.getUTCDate()).toBe(15);
    expect(result!.getUTCMonth()).toBe(1);
  });

  test.skip("deve usar horário padrão 20:00 quando time é null", () => {
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

describe("Reminders - fetchGamesInReminderWindow", () => {
  test("inclui jogos modernos elegíveis e ignora status encerrado", async () => {
    const target = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "modern-game",
            data: () => ({
              dateTime: {toDate: () => target},
              status: "SCHEDULED",
              group_id: "group-1",
              locationName: "Arena Central",
            }),
          },
          {
            id: "cancelled-game",
            data: () => ({dateTime: {toDate: () => target}, status: "CANCELLED"}),
          },
        ],
      })
      .mockResolvedValueOnce({docs: [], size: 0});

    await expect(fetchGamesInReminderWindow(24)).resolves.toEqual([
      expect.objectContaining({
        id: "modern-game",
        status: "SCHEDULED",
        group_id: "group-1",
        location_name: "Arena Central",
      }),
    ]);
  });

  test("mantém jogos modernos quando a consulta legada falha", async () => {
    const target = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [{
          id: "modern-game",
          data: () => ({dateTime: {toDate: () => target}, status: "CONFIRMED"}),
        }],
      })
      .mockRejectedValueOnce(new Error("legacy index unavailable"));

    const games = await fetchGamesInReminderWindow(24);

    expect(games.map(({id}) => id)).toEqual(["modern-game"]);
  });

  test("ancora jogos legados sem dateTime na data real do jogo, nao em created_at", async () => {
    const realGameDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const realDateKey = realGameDate.toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const realTime = realGameDate.toLocaleTimeString("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    mockCollectionGet
      .mockResolvedValueOnce({docs: []})
      .mockResolvedValueOnce({
        size: 1,
        docs: [{
          id: "legacy-game",
          data: () => ({
            status: "SCHEDULED",
            dateTime: null,
            date: realDateKey,
            time: realTime,
            created_at: {
              toDate: () => new Date("2020-01-01T00:00:00Z"),
            },
          }),
        }],
      });

    await fetchGamesInReminderWindow(24);

    expect(mockWhere).not.toHaveBeenCalledWith("dateTime", "==", null);
    expect(mockWhere).toHaveBeenCalledWith("date", ">=", expect.any(String));
    expect(mockWhere).toHaveBeenCalledWith("date", "<=", expect.any(String));
  });

  test("filtra jogos modernos no fallback por date sem exigir indice composto", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
    try {
      const target = new Date("2026-07-11T12:00:00.000Z");
      const localSource = new Date(target.getTime() - 3 * 60 * 60 * 1000);
      const dateKey = [
        localSource.getFullYear(),
        String(localSource.getMonth() + 1).padStart(2, "0"),
        String(localSource.getDate()).padStart(2, "0"),
      ].join("-");
      const timeKey = [
        String(localSource.getHours()).padStart(2, "0"),
        String(localSource.getMinutes()).padStart(2, "0"),
      ].join(":");
      mockCollectionGet
        .mockResolvedValueOnce({docs: []})
        .mockResolvedValueOnce({
          size: 2,
          docs: [
            {
              id: "modern-game",
              data: () => ({
                status: "SCHEDULED",
                dateTime: {toDate: () => target},
                date: dateKey,
                time: timeKey,
              }),
            },
            {
              id: "legacy-game",
              data: () => ({
                status: "SCHEDULED",
                dateTime: null,
                date: dateKey,
                time: timeKey,
              }),
            },
          ],
        });

      const games = await fetchGamesInReminderWindow(24);

      expect(games.map(({id}) => id)).toEqual(["legacy-game"]);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("Reminders - fetchPendingConfirmations", () => {
  test("deve retornar vazio quando nao ha confirmacoes pendentes", async () => {
    mockCollectionGet.mockResolvedValueOnce({
      empty: true,
      size: 0,
      docs: [],
    });

    await expect(fetchPendingConfirmations("game-empty", "24h")).resolves.toEqual([]);
    expect(mockStartAfter).not.toHaveBeenCalled();
  });

  test("deve paginar e ignorar confirmacoes que ja receberam o lembrete", async () => {
    const page1Docs = Array.from({ length: 100 }, (_, index) => ({
      id: `conf-${index}`,
      data: () => ({
        user_id: index === 0 ? "skip-user" : `user-${index}`,
        status: index === 1 ? "WAITLIST" : "PENDING",
        reminder_24h_sent: index === 0,
        reminder_2h_sent: false,
      }),
    }));
    const page2Docs = [
      {
        id: "conf-100",
        data: () => ({
          userId: "user-100",
          status: "CHECKED_IN",
        }),
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

    const result = await fetchPendingConfirmations("game-1", "24h");

    expect(result).toHaveLength(100);
    expect(result.some((confirmation) => confirmation.user_id === "skip-user")).toBe(false);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "conf-1",
          user_id: "user-1",
          game_id: "game-1",
          status: "WAITLIST",
          reminder_24h_sent: false,
          reminder_2h_sent: false,
          reminder_1h_sent: false,
        }),
        expect.objectContaining({
          id: "conf-100",
          user_id: "user-100",
          status: "CHECKED_IN",
        }),
      ]),
    );
    expect(mockStartAfter).toHaveBeenCalledTimes(1);
    expect(mockStartAfter).toHaveBeenCalledWith(page1Docs[page1Docs.length - 1]);
  });
});
