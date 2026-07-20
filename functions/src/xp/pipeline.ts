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
import {
  LEVEL_TABLE,
  MAX_XP_PER_GAME,
  MIN_XP_PER_GAME,
  XP_ACTIONS,
  STREAK_BONUSES,
  PERFORMANCE_BONUSES,
  BEHAVIOR_BONUSES,
  RETENTION_BONUSES,
} from "../constants";

// ==========================================
// CONSTANTS & LOGIC (Port from Kotlin)
// ==========================================

export const DEFAULT_SETTINGS: GamificationSettings = {
  xp_presence: XP_ACTIONS.PARTICIPATION,
  xp_per_goal: XP_ACTIONS.GOAL,
  xp_per_assist: XP_ACTIONS.ASSIST,
  xp_per_save: XP_ACTIONS.SAVE,
  xp_win: XP_ACTIONS.WIN,
  xp_draw: XP_ACTIONS.DRAW,
  xp_mvp: XP_ACTIONS.MVP,
  xp_streak_3: STREAK_BONUSES.STREAK_3,
  xp_streak_5: STREAK_BONUSES.STREAK_5,
  xp_streak_7: STREAK_BONUSES.STREAK_7,
  xp_streak_10: STREAK_BONUSES.STREAK_10,
  xp_clean_sheet: XP_ACTIONS.CLEAN_SHEET,
  xp_top_scorer: PERFORMANCE_BONUSES.TOP_SCORER,
  xp_hat_trick: PERFORMANCE_BONUSES.HAT_TRICK,
  xp_first_goal: PERFORMANCE_BONUSES.FIRST_GOAL,
  xp_goalkeeper_goal: PERFORMANCE_BONUSES.GOALKEEPER_GOAL,
  xp_fair_play: PERFORMANCE_BONUSES.FAIR_PLAY,
  xp_event_recorder_per_event:
    PERFORMANCE_BONUSES.EVENT_RECORDER_PER_EVENT,
  xp_event_recorder_min_events:
    PERFORMANCE_BONUSES.EVENT_RECORDER_MIN_EVENTS,
  xp_event_recorder_max_xp:
    PERFORMANCE_BONUSES.EVENT_RECORDER_MAX_XP,
  xp_early_confirmation:
    BEHAVIOR_BONUSES.EARLY_CONFIRMATION,
  xp_on_time_checkin:
    BEHAVIOR_BONUSES.ON_TIME_CHECKIN,
  xp_last_minute_saver:
    BEHAVIOR_BONUSES.LAST_MINUTE_SAVER,
  xp_waitlist_promoted:
    BEHAVIOR_BONUSES.WAITLIST_PROMOTED,
  xp_comeback_14d:
    RETENTION_BONUSES.COMEBACK_14D,
  xp_comeback_30d:
    RETENTION_BONUSES.COMEBACK_30D,
  comeback_14d_threshold_days:
    RETENTION_BONUSES.COMEBACK_14D_THRESHOLD_DAYS,
  comeback_30d_threshold_days:
    RETENTION_BONUSES.COMEBACK_30D_THRESHOLD_DAYS,
  comeback_max_per_month:
    RETENTION_BONUSES.COMEBACK_MAX_PER_MONTH,
  xp_first_game_of_month:
    RETENTION_BONUSES.FIRST_GAME_OF_MONTH,
  xp_monthly_streak_3:
    RETENTION_BONUSES.MONTHLY_STREAK_3,
  xp_monthly_streak_6:
    RETENTION_BONUSES.MONTHLY_STREAK_6,
  xp_monthly_streak_12:
    RETENTION_BONUSES.MONTHLY_STREAK_12,
  xpActions: XP_ACTIONS,
  performanceBonuses: PERFORMANCE_BONUSES,
  behaviorBonuses: BEHAVIOR_BONUSES,
  retentionBonuses: RETENTION_BONUSES,
};

// Penalidade "Bola Murcha" (sync XPCalculator.kt)
export const XP_WORST_PLAYER_PENALTY = -10;

// LevelTable Logic — Source of truth: shared/xp-constants.json
// Synced via constants.ts → LEVEL_TABLE (importado do JSON local).
//
// FIX #584/H14: era array hardcoded com 11 entries (cap level 10),
// mas xp-constants.json tem 21 níveis (0-20). Após 52850 XP server
// retornava cap level 10 incorreto. Agora deriva do JSON canônico.
export const LEVELS: Array<{
  level: number;
  name: string;
  xpRequired: number;
}> = LEVEL_TABLE.levels.map((l) => ({
  level: l.level,
  name: l.name,
  xpRequired: l.xpRequired,
}));

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
    if ((stats[m.field] ?? 0) >= m.threshold) {
      newM.push(m.name);
      xp += m.xpReward;
    }
  }
  return {newMilestones: newM, xp};
}

/**
 * Soma a recompensa configurada para os milestones informados.
 * @param {string[]} milestoneNames Nomes dos milestones.
 * @return {number} XP total dos milestones.
 */
export function getMilestoneXp(
  milestoneNames: string[]
): number {
  return milestoneNames.reduce((sum, name) => {
    const def = MILESTONES.find((milestone) =>
      milestone.name === name
    );
    return sum + (def?.xpReward || 0);
  }, 0);
}

/**
 * Seleciona quais milestones realmente cabem sob o teto de XP por jogo.
 * Quando um milestone grande estoura o teto, preserva milestones menores
 * que ainda caibam, evitando perda permanente de recompensa.
 *
 * @param {number} baseXp XP do jogo antes dos milestones.
 * @param {string[]} milestoneNames Milestones elegíveis para este jogo.
 * @return {object} Milestones aplicados e overflow pendente.
 */
export function fitMilestonesWithinGameXpCap(
  baseXp: number,
  milestoneNames: string[]
): {
  appliedMilestones: string[];
  appliedXp: number;
  overflowMilestones: string[];
} {
  if (milestoneNames.length === 0) {
    return {
      appliedMilestones: [],
      appliedXp: 0,
      overflowMilestones: [],
    };
  }

  const totalMilestoneXp =
    getMilestoneXp(milestoneNames);
  const baseClamped = Math.max(
    MIN_XP_PER_GAME,
    Math.min(baseXp, MAX_XP_PER_GAME)
  );
  const totalClamped = Math.max(
    MIN_XP_PER_GAME,
    Math.min(
      baseXp + totalMilestoneXp,
      MAX_XP_PER_GAME
    )
  );
  const effectiveMilestoneXp = Math.max(
    0,
    totalClamped - baseClamped
  );

  if (effectiveMilestoneXp <= 0) {
    return {
      appliedMilestones: [],
      appliedXp: 0,
      overflowMilestones: [...milestoneNames],
    };
  }

  const candidates = milestoneNames
    .map((name, index) => ({
      name,
      index,
      xpReward:
        MILESTONES.find((milestone) =>
          milestone.name === name
        )?.xpReward || 0,
    }))
    .sort((a, b) =>
      a.xpReward === b.xpReward ?
        a.index - b.index :
        a.xpReward - b.xpReward
    );

  const appliedNames = new Set<string>();
  let appliedXp = 0;

  for (const candidate of candidates) {
    if (candidate.xpReward <= 0) continue;
    if (
      appliedXp + candidate.xpReward >
      effectiveMilestoneXp
    ) {
      continue;
    }

    appliedNames.add(candidate.name);
    appliedXp += candidate.xpReward;
  }

  return {
    appliedMilestones: milestoneNames.filter(
      (name) => appliedNames.has(name)
    ),
    appliedXp,
    overflowMilestones: milestoneNames.filter(
      (name) => !appliedNames.has(name)
    ),
  };
}
