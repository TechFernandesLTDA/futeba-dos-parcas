/**
 * XP PIPELINE - Tabelas de Nível e Milestones
 *
 * Contém a lógica de cálculo de nível por XP,
 * definições de milestones, e configurações
 * padrão de gamificação.
 *
 * Fonte de verdade para níveis:
 *   app/.../data/model/LevelTable.kt
 */

import {
  GamificationSettings,
  UserStatistics,
} from "../models";

// ==========================================
// CONSTANTS & LOGIC (Port from Kotlin)
// ==========================================

export const DEFAULT_SETTINGS: GamificationSettings = {
  xp_presence: 10,
  xp_per_goal: 10,
  xp_per_assist: 7,
  // Aumentado de 5 para 8 (balance goleiros)
  xp_per_save: 8,
  xp_win: 20,
  xp_draw: 10,
  xp_mvp: 30,
  xp_streak_3: 20,
  xp_streak_5: 35, // NOVO: Bonus intermediário
  xp_streak_7: 50,
  xp_streak_10: 100,
  // NOVO: Bonus goleiro clean sheet
  xp_clean_sheet: 15,
};

// Penalidade "Bola Murcha" (sync XPCalculator.kt)
export const XP_WORST_PLAYER_PENALTY = -10;

// LevelTable Logic (Synced with Kotlin LevelTable.kt)
// Formato: level, name, xpRequired (acumulado)
// Fonte de verdade:
//   app/.../data/model/LevelTable.kt
export const LEVELS = [
  {level: 0, name: "Novato", xpRequired: 0},
  {level: 1, name: "Iniciante", xpRequired: 100},
  {level: 2, name: "Amador", xpRequired: 350},
  {level: 3, name: "Regular", xpRequired: 850},
  {level: 4, name: "Experiente", xpRequired: 1850},
  {level: 5, name: "Habilidoso", xpRequired: 3850},
  {level: 6, name: "Profissional", xpRequired: 7350},
  {level: 7, name: "Expert", xpRequired: 12850},
  {level: 8, name: "Mestre", xpRequired: 20850},
  {level: 9, name: "Lenda", xpRequired: 32850},
  {level: 10, name: "Imortal", xpRequired: 52850},
];

/**
 * Retorna o nível correspondente ao XP.
 * @param {number} xp Total de XP do jogador.
 * @return {number} Nível do jogador.
 */
export function getLevelForXp(xp: number): number {
  const sorted = [...LEVELS].reverse();
  const found = sorted.find((l) => xp >= l.xpRequired);
  // Nível mínimo é 0 (Novato)
  return found ? found.level : 0;
}

// Milestone Logic (Synced with Kotlin Gamification.kt)
export type MilestoneDef = {
    name: string;
    xpReward: number;
    threshold: number;
    field: keyof UserStatistics;
};

export const MILESTONES: MilestoneDef[] = [
  // Jogos
  {
    name: "GAMES_10", xpReward: 50,
    threshold: 10, field: "totalGames",
  },
  {
    name: "GAMES_25", xpReward: 100,
    threshold: 25, field: "totalGames",
  },
  {
    name: "GAMES_50", xpReward: 200,
    threshold: 50, field: "totalGames",
  },
  {
    name: "GAMES_100", xpReward: 500,
    threshold: 100, field: "totalGames",
  },
  {
    name: "GAMES_250", xpReward: 1000,
    threshold: 250, field: "totalGames",
  },
  {
    name: "GAMES_500", xpReward: 2500,
    threshold: 500, field: "totalGames",
  },

  // Gols
  {
    name: "GOALS_10", xpReward: 50,
    threshold: 10, field: "totalGoals",
  },
  {
    name: "GOALS_25", xpReward: 100,
    threshold: 25, field: "totalGoals",
  },
  {
    name: "GOALS_50", xpReward: 200,
    threshold: 50, field: "totalGoals",
  },
  {
    name: "GOALS_100", xpReward: 500,
    threshold: 100, field: "totalGoals",
  },
  {
    name: "GOALS_250", xpReward: 1000,
    threshold: 250, field: "totalGoals",
  },

  // Assistencias
  {
    name: "ASSISTS_10", xpReward: 50,
    threshold: 10, field: "totalAssists",
  },
  {
    name: "ASSISTS_25", xpReward: 100,
    threshold: 25, field: "totalAssists",
  },
  {
    name: "ASSISTS_50", xpReward: 200,
    threshold: 50, field: "totalAssists",
  },
  {
    name: "ASSISTS_100", xpReward: 500,
    threshold: 100, field: "totalAssists",
  },

  // Defesas
  {
    name: "SAVES_25", xpReward: 50,
    threshold: 25, field: "totalSaves",
  },
  {
    name: "SAVES_50", xpReward: 100,
    threshold: 50, field: "totalSaves",
  },
  {
    name: "SAVES_100", xpReward: 200,
    threshold: 100, field: "totalSaves",
  },
  {
    name: "SAVES_250", xpReward: 500,
    threshold: 250, field: "totalSaves",
  },

  // MVPs
  {
    name: "MVP_5", xpReward: 100,
    threshold: 5, field: "bestPlayerCount",
  },
  {
    name: "MVP_10", xpReward: 300,
    threshold: 10, field: "bestPlayerCount",
  },
  {
    name: "MVP_25", xpReward: 750,
    threshold: 25, field: "bestPlayerCount",
  },
  {
    name: "MVP_50", xpReward: 1500,
    threshold: 50, field: "bestPlayerCount",
  },

  // Vitorias
  {
    name: "WINS_10", xpReward: 75,
    threshold: 10, field: "gamesWon",
  },
  {
    name: "WINS_25", xpReward: 150,
    threshold: 25, field: "gamesWon",
  },
  {
    name: "WINS_50", xpReward: 300,
    threshold: 50, field: "gamesWon",
  },
  {
    name: "WINS_100", xpReward: 750,
    threshold: 100, field: "gamesWon",
  },
];

/**
 * Verifica milestones alcançados pelo jogador.
 * @param {UserStatistics} stats Estatísticas atuais.
 * @param {string[]} achieved Milestones já alcançados.
 * @return {{ newMilestones: string[], xp: number }}
 *   Novos milestones e XP ganho.
 */
export function checkMilestones(
  stats: UserStatistics,
  achieved: string[]
): {newMilestones: string[], xp: number} {
  const newM: string[] = [];
  let xp = 0;

  for (const m of MILESTONES) {
    if (achieved.includes(m.name)) continue;
    if (stats[m.field] >= m.threshold) {
      newM.push(m.name);
      xp += m.xpReward;
    }
  }
  return {newMilestones: newM, xp};
}
