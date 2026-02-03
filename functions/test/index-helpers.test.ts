/**
 * TESTES DE FUNÇÕES AUXILIARES DO INDEX.TS
 *
 * Testa funções puras exportadas de index.ts:
 * - getLevelForXp: Determina nível baseado em XP acumulado
 * - checkMilestones: Verifica milestones desbloqueados
 * - getWeekKey: Gera chave de semana (YYYY-W##)
 * - toGameConfirmation: Converte dados brutos para GameConfirmation
 * - toTeam: Converte dados brutos para Team
 * - toLiveScore: Converte dados brutos para LiveGameScore
 * - getGameDate: Extrai data do jogo
 */

// Mock firebase-admin
jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
    arrayUnion: jest.fn((...args: any[]) => ({ _type: "ArrayUnion", elements: args })),
    increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
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

  const mockFieldPath = {
    documentId: jest.fn(() => "__name__"),
  };

  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn(),
        }),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn(),
      }),
      batch: jest.fn(() => ({
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      })),
      runTransaction: jest.fn(),
    })),
    initializeApp: jest.fn(),
    auth: jest.fn(() => ({
      setCustomUserClaims: jest.fn(),
    })),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = mockTimestamp;
  mockAdmin.firestore.FieldPath = mockFieldPath;

  return mockAdmin;
});

// Mock firebase-functions v2
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((path: string, handler: any) => handler),
  onDocumentDeleted: jest.fn((path: string, handler: any) => handler),
  onDocumentCreated: jest.fn((path: string, handler: any) => handler),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((config: any, handler: any) => handler || config),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock notifications
jest.mock("../src/notifications", () => ({
  sendStreakNotificationIfMilestone: jest.fn().mockResolvedValue(undefined),
  sendNotificationToUser: jest.fn(),
  saveNotificationToFirestore: jest.fn(),
  NotificationType: { GAME_REMINDER: "GAME_REMINDER" },
}));

// Mock league
jest.mock("../src/league", () => ({
  calculateLeaguePromotion: jest.fn(),
  calculateLeagueRating: jest.fn(),
  PROMOTION_GAMES_REQUIRED: 5,
  RELEGATION_GAMES_REQUIRED: 3,
}));

// Mock firebase-functions v2 (scheduler, storage)
jest.mock("firebase-functions/v2", () => ({
  scheduler: {
    onSchedule: jest.fn(() => jest.fn()),
  },
  https: {
    onCall: jest.fn((config: any, handler: any) => handler || config),
    HttpsError: class HttpsError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
    onRequest: jest.fn((config: any, handler: any) => handler || config),
  },
  storage: {
    onObjectFinalized: jest.fn(() => jest.fn()),
  },
}));

// Mock firebase-functions/v2/scheduler
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

// Mock módulos re-exportados por index.ts
jest.mock("../src/activities", () => ({}));
jest.mock("../src/reminders", () => ({}));
jest.mock("../src/season", () => ({}));
jest.mock("../src/seeding", () => ({}));
jest.mock("../src/user-management", () => ({}));
jest.mock("../src/maintenance/cleanup-old-logs", () => ({}));
jest.mock("../src/maintenance/soft-delete", () => ({}));
jest.mock("../src/monitoring/collect-metrics", () => ({}));
jest.mock("../src/storage/generate-thumbnails", () => ({}));
jest.mock("../src/auth/custom-claims", () => ({}));
jest.mock("../src/middleware/rate-limiter", () => ({}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  },
}));

import {
  getLevelForXp,
  checkMilestones,
  getWeekKey,
  toGameConfirmation,
  toTeam,
  toLiveScore,
  getGameDate,
  LEVELS,
  MILESTONES,
  UserStatistics,
} from "../src/index";

// ==========================================
// getLevelForXp
// ==========================================

describe("Index - getLevelForXp", () => {
  test("deve retornar nível 0 para XP 0", () => {
    expect(getLevelForXp(0)).toBe(0);
  });

  test("deve retornar nível 0 para XP abaixo de 100", () => {
    expect(getLevelForXp(50)).toBe(0);
    expect(getLevelForXp(99)).toBe(0);
  });

  test("deve retornar nível 1 para XP = 100", () => {
    expect(getLevelForXp(100)).toBe(1);
  });

  test("deve retornar nível 1 para XP entre 100 e 349", () => {
    expect(getLevelForXp(200)).toBe(1);
    expect(getLevelForXp(349)).toBe(1);
  });

  test("deve retornar nível 2 para XP = 350", () => {
    expect(getLevelForXp(350)).toBe(2);
  });

  test("deve retornar nível 5 para XP = 3850", () => {
    expect(getLevelForXp(3850)).toBe(5);
  });

  test("deve retornar nível 10 para XP = 52850", () => {
    expect(getLevelForXp(52850)).toBe(10);
  });

  test("deve retornar nível 10 para XP acima de 52850", () => {
    expect(getLevelForXp(100000)).toBe(10);
  });

  test("deve retornar nível 0 para XP negativo", () => {
    expect(getLevelForXp(-10)).toBe(0);
  });

  test("deve cobrir todos os limites de nível", () => {
    const expectedLevels = [
      { xp: 0, level: 0 },
      { xp: 100, level: 1 },
      { xp: 350, level: 2 },
      { xp: 850, level: 3 },
      { xp: 1850, level: 4 },
      { xp: 3850, level: 5 },
      { xp: 7350, level: 6 },
      { xp: 12850, level: 7 },
      { xp: 20850, level: 8 },
      { xp: 32850, level: 9 },
      { xp: 52850, level: 10 },
    ];

    for (const { xp, level } of expectedLevels) {
      expect(getLevelForXp(xp)).toBe(level);
    }
  });
});

// ==========================================
// checkMilestones
// ==========================================

describe("Index - checkMilestones", () => {
  const baseStats: UserStatistics = {
    totalGames: 0,
    totalGoals: 0,
    totalAssists: 0,
    totalSaves: 0,
    totalYellowCards: 0,
    totalRedCards: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
    bestPlayerCount: 0,
    worstPlayerCount: 0,
    currentMvpStreak: 0,
  };

  test("deve retornar vazio quando nenhum milestone atingido", () => {
    const result = checkMilestones(baseStats, []);
    expect(result.newMilestones).toEqual([]);
    expect(result.xp).toBe(0);
  });

  test("deve desbloquear GAMES_10 com 10 jogos", () => {
    const stats = { ...baseStats, totalGames: 10 };
    const result = checkMilestones(stats, []);
    expect(result.newMilestones).toContain("GAMES_10");
    expect(result.xp).toBeGreaterThan(0);
  });

  test("deve desbloquear múltiplos milestones simultaneamente", () => {
    const stats = { ...baseStats, totalGames: 50, totalGoals: 25 };
    const result = checkMilestones(stats, []);

    expect(result.newMilestones).toContain("GAMES_10");
    expect(result.newMilestones).toContain("GAMES_25");
    expect(result.newMilestones).toContain("GAMES_50");
    expect(result.newMilestones).toContain("GOALS_10");
    expect(result.newMilestones).toContain("GOALS_25");
  });

  test("não deve desbloquear milestones já alcançados", () => {
    const stats = { ...baseStats, totalGames: 50 };
    const result = checkMilestones(stats, ["GAMES_10", "GAMES_25"]);

    expect(result.newMilestones).not.toContain("GAMES_10");
    expect(result.newMilestones).not.toContain("GAMES_25");
    expect(result.newMilestones).toContain("GAMES_50");
  });

  test("deve calcular XP correto para milestone GAMES_100", () => {
    const stats = { ...baseStats, totalGames: 100 };
    const achieved = ["GAMES_10", "GAMES_25", "GAMES_50"];
    const result = checkMilestones(stats, achieved);

    expect(result.newMilestones).toContain("GAMES_100");
    // GAMES_100 = 500 XP
    const games100Milestone = MILESTONES.find(m => m.name === "GAMES_100");
    expect(games100Milestone?.xpReward).toBe(500);
  });

  test("deve desbloquear milestones de MVP", () => {
    const stats = { ...baseStats, bestPlayerCount: 10 };
    const result = checkMilestones(stats, ["MVP_5"]);

    expect(result.newMilestones).toContain("MVP_10");
    expect(result.newMilestones).not.toContain("MVP_5");
  });

  test("deve desbloquear milestones de vitórias", () => {
    const stats = { ...baseStats, gamesWon: 25 };
    const result = checkMilestones(stats, []);

    expect(result.newMilestones).toContain("WINS_10");
    expect(result.newMilestones).toContain("WINS_25");
  });

  test("deve desbloquear milestones de defesas", () => {
    const stats = { ...baseStats, totalSaves: 100 };
    const result = checkMilestones(stats, []);

    expect(result.newMilestones).toContain("SAVES_25");
    expect(result.newMilestones).toContain("SAVES_50");
    expect(result.newMilestones).toContain("SAVES_100");
  });
});

// ==========================================
// getWeekKey
// ==========================================

describe("Index - getWeekKey", () => {
  test("deve retornar formato YYYY-W## correto", () => {
    const date = new Date("2026-01-15");
    const result = getWeekKey(date);

    expect(result).toMatch(/^\d{4}-W\d{2}$/);
    expect(result.startsWith("2026-W")).toBe(true);
  });

  test("deve retornar semana diferente para datas em semanas diferentes", () => {
    const week1 = getWeekKey(new Date("2026-01-05"));
    const week2 = getWeekKey(new Date("2026-01-12"));

    expect(week1).not.toBe(week2);
  });

  test("deve retornar mesma semana para datas na mesma semana", () => {
    const monday = getWeekKey(new Date("2026-01-05"));
    const tuesday = getWeekKey(new Date("2026-01-06"));

    expect(monday).toBe(tuesday);
  });

  test("deve lidar com virada de ano", () => {
    const result = getWeekKey(new Date("2026-12-31"));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  test("deve pad com zero para semanas < 10", () => {
    const result = getWeekKey(new Date("2026-01-05"));
    // Deve ter W seguido de 2 dígitos
    const weekPart = result.split("-W")[1];
    expect(weekPart.length).toBe(2);
  });
});

// ==========================================
// toGameConfirmation
// ==========================================

describe("Index - toGameConfirmation", () => {
  test("deve converter dados com formato snake_case", () => {
    const raw = {
      user_id: "user1",
      status: "CONFIRMED",
      position: "STRIKER",
      goals: 3,
      assists: 1,
      saves: 0,
      yellow_cards: 1,
      red_cards: 0,
      game_id: "game1",
      is_worst_player: false,
    };

    const result = toGameConfirmation(raw);
    expect(result.userId).toBe("user1");
    expect(result.status).toBe("CONFIRMED");
    expect(result.position).toBe("STRIKER");
    expect(result.goals).toBe(3);
    expect(result.assists).toBe(1);
    expect(result.saves).toBe(0);
    expect(result.yellowCards).toBe(1);
    expect(result.redCards).toBe(0);
    expect(result.game_id).toBe("game1");
    expect(result.is_worst_player).toBe(false);
  });

  test("deve converter dados com formato camelCase", () => {
    const raw = {
      userId: "user2",
      status: "CONFIRMED",
      position: "GOALKEEPER",
      goals: 0,
      assists: 0,
      saves: 5,
      yellowCards: 0,
      redCards: 0,
      gameId: "game2",
      isWorstPlayer: true,
    };

    const result = toGameConfirmation(raw);
    expect(result.userId).toBe("user2");
    expect(result.saves).toBe(5);
    expect(result.game_id).toBe("game2");
    expect(result.is_worst_player).toBe(true);
  });

  test("deve usar valores padrão para campos ausentes", () => {
    const raw = {};
    const result = toGameConfirmation(raw);

    expect(result.userId).toBe("");
    expect(result.status).toBe("CONFIRMED");
    expect(result.position).toBe("");
    expect(result.goals).toBe(0);
    expect(result.assists).toBe(0);
    expect(result.saves).toBe(0);
    expect(result.yellowCards).toBe(0);
    expect(result.redCards).toBe(0);
    expect(result.game_id).toBe("");
    expect(result.is_worst_player).toBe(false);
  });

  test("deve converter strings numéricas para Number", () => {
    const raw = {
      user_id: "user3",
      goals: "2",
      assists: "1",
      saves: "0",
    };

    const result = toGameConfirmation(raw);
    expect(result.goals).toBe(2);
    expect(result.assists).toBe(1);
    expect(result.saves).toBe(0);
  });
});

// ==========================================
// toTeam
// ==========================================

describe("Index - toTeam", () => {
  test("deve converter dados com formato snake_case", () => {
    const raw = {
      player_ids: ["user1", "user2", "user3"],
      score: 3,
    };

    const result = toTeam("team1", raw);
    expect(result.id).toBe("team1");
    expect(result.playerIds).toEqual(["user1", "user2", "user3"]);
    expect(result.score).toBe(3);
  });

  test("deve converter dados com formato camelCase", () => {
    const raw = {
      playerIds: ["user4", "user5"],
      score: 1,
    };

    const result = toTeam("team2", raw);
    expect(result.playerIds).toEqual(["user4", "user5"]);
    expect(result.score).toBe(1);
  });

  test("deve usar id do documento se raw.id não existir", () => {
    const raw = { player_ids: [], score: 0 };
    const result = toTeam("doc_id", raw);
    expect(result.id).toBe("doc_id");
  });

  test("deve usar raw.id se existir", () => {
    const raw = { id: "custom_id", player_ids: [], score: 0 };
    const result = toTeam("doc_id", raw);
    expect(result.id).toBe("custom_id");
  });

  test("deve usar valores padrão para campos ausentes", () => {
    const raw = {};
    const result = toTeam("team3", raw);

    expect(result.id).toBe("team3");
    expect(result.playerIds).toEqual([]);
    expect(result.score).toBe(0);
  });
});

// ==========================================
// toLiveScore
// ==========================================

describe("Index - toLiveScore", () => {
  test("deve retornar null para undefined", () => {
    expect(toLiveScore(undefined)).toBeNull();
  });

  test("deve retornar null para null", () => {
    expect(toLiveScore(null)).toBeNull();
  });

  test("deve converter dados com formato snake_case", () => {
    const raw = {
      game_id: "game1",
      team1_id: "team1",
      team2_id: "team2",
      team1_score: 3,
      team2_score: 1,
    };

    const result = toLiveScore(raw);
    expect(result).not.toBeNull();
    expect(result!.gameId).toBe("game1");
    expect(result!.team1Id).toBe("team1");
    expect(result!.team2Id).toBe("team2");
    expect(result!.team1Score).toBe(3);
    expect(result!.team2Score).toBe(1);
  });

  test("deve converter dados com formato camelCase", () => {
    const raw = {
      gameId: "game2",
      team1Id: "teamA",
      team2Id: "teamB",
      team1Score: 2,
      team2Score: 2,
    };

    const result = toLiveScore(raw);
    expect(result!.gameId).toBe("game2");
    expect(result!.team1Score).toBe(2);
    expect(result!.team2Score).toBe(2);
  });

  test("deve usar valores padrão para campos ausentes", () => {
    const raw = {};
    const result = toLiveScore(raw);

    expect(result!.gameId).toBe("");
    expect(result!.team1Id).toBe("");
    expect(result!.team2Id).toBe("");
    expect(result!.team1Score).toBe(0);
    expect(result!.team2Score).toBe(0);
  });
});

// ==========================================
// getGameDate
// ==========================================

describe("Index - getGameDate", () => {
  test("deve retornar data atual quando game é undefined", () => {
    const before = Date.now();
    const result = getGameDate(undefined);
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  test("deve usar dateTime (Timestamp) quando disponível", () => {
    const fixedDate = new Date("2026-06-15T20:00:00Z");
    const game: any = {
      dateTime: { toDate: () => fixedDate },
      date: "2026-01-01",
      owner_id: "owner1",
      status: "FINISHED",
    };

    const result = getGameDate(game);
    expect(result).toEqual(fixedDate);
  });

  test("deve usar campo date quando dateTime não disponível", () => {
    const game: any = {
      dateTime: undefined,
      date: "2026-03-20",
      owner_id: "owner1",
      status: "FINISHED",
    };

    const result = getGameDate(game);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(2); // Março = 2 (0-indexed)
    expect(result.getUTCDate()).toBe(20);
  });

  test("deve retornar data atual para data inválida", () => {
    const game: any = {
      dateTime: undefined,
      date: "invalid",
      owner_id: "owner1",
      status: "FINISHED",
    };

    const before = Date.now();
    const result = getGameDate(game);
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  test("deve priorizar dateTime sobre date", () => {
    const timestampDate = new Date("2026-05-01T15:00:00Z");
    const game: any = {
      dateTime: { toDate: () => timestampDate },
      date: "2026-12-31",
      owner_id: "owner1",
      status: "FINISHED",
    };

    const result = getGameDate(game);
    expect(result).toEqual(timestampDate);
  });
});

// ==========================================
// LEVELS & MILESTONES Constants
// ==========================================

describe("Index - Constants", () => {
  test("LEVELS deve ter 11 níveis (0-10)", () => {
    expect(LEVELS).toHaveLength(11);
    expect(LEVELS[0].level).toBe(0);
    expect(LEVELS[10].level).toBe(10);
  });

  test("LEVELS deve estar ordenado por xpRequired", () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xpRequired).toBeGreaterThan(LEVELS[i - 1].xpRequired);
    }
  });

  test("LEVELS deve ter nomes únicos", () => {
    const names = LEVELS.map(l => l.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  test("MILESTONES deve ter xpReward positivo", () => {
    for (const m of MILESTONES) {
      expect(m.xpReward).toBeGreaterThan(0);
    }
  });

  test("MILESTONES deve ter thresholds positivos", () => {
    for (const m of MILESTONES) {
      expect(m.threshold).toBeGreaterThan(0);
    }
  });

  test("MILESTONES deve ter nomes únicos", () => {
    const names = MILESTONES.map(m => m.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
