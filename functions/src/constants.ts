/**
 * Constantes centralizadas - Futeba dos Parças
 *
 * Limites do Firestore, FCM, e regras de negócio
 * reutilizadas em múltiplos módulos.
 *
 * Regra: Se um número aparece em 2+ arquivos,
 * ele DEVE estar aqui.
 *
 * === XP & Level Table: DUAL-SOURCE SYNC (ISSUE #730) ===
 *
 * Source of truth: shared/xp-constants.json (KMP root).
 * Local copy:     src/_constants/xp-constants.json
 *
 * WHY a local copy? tsc rootDir=src forbids imports outside src/.
 * Web can import ../../../shared/xp-constants.json directly because
 * its rootDir is the monorepo root, but functions/ cannot.
 *
 * SYNC RULE: When you change shared/xp-constants.json, you MUST copy
 * the changes to src/_constants/xp-constants.json. A CI test
 * (test/xp-constants-sync.test.ts) enforces this automatically.
 *
 * Consumers of these constants:
 *   - functions/src/constants.ts (imports from _constants/)
 *   - web/src/types/gamification.ts (imports from shared/)
 *   - web/src/utils/constants.ts (imports from shared/)
 *   - shared/src/commonMain/.../XpAction.kt, LevelTable.kt, XPCalculator.kt
 */

// Importa constantes de XP do arquivo JSON local
// Mantido em sync com /shared/xp-constants.json (KMP)
import xpConstants from "./_constants/xp-constants.json";

// Re-exporta constantes de XP do JSON centralizado
export const XP_ACTIONS = xpConstants.xpActions;
export const STREAK_BONUSES = xpConstants.streakBonuses;
export const LEVEL_TABLE = xpConstants.levelTable;

// ==========================================
// CLOUD FUNCTIONS CONFIG
// ==========================================

/**
 * Região padrão para Cloud Functions.
 * Usuários no Brasil - southamerica-east1
 * (São Paulo) reduz latência vs us-central1.
 */
export const FUNCTION_REGION = "southamerica-east1";

// ==========================================
// FIRESTORE LIMITS
// ==========================================

/** Máximo de operações por batch write */
export const FIRESTORE_BATCH_LIMIT = 500;

/**
 * Margem de segurança para batch writes.
 * Usa 450 para evitar atingir o limite de 500
 * em operações que fazem múltiplos writes por
 * item (ex: update user + update stats + log).
 */
export const FIRESTORE_BATCH_SAFE_LIMIT = 450;

/** Limite de itens em queries whereIn() */
export const FIRESTORE_WHERE_IN_LIMIT = 10;

/**
 * Limite padrão para paginação de queries
 * em operações de manutenção/migração.
 */
export const FIRESTORE_PAGINATION_LIMIT = 500;

// ==========================================
// FCM (FIREBASE CLOUD MESSAGING)
// ==========================================

/**
 * Máximo de tokens por chamada
 * sendEachForMulticast().
 */
export const FCM_MULTICAST_LIMIT = 500;

/** Limite de caracteres no corpo da notificação */
export const FCM_BODY_MAX_LENGTH = 500;

/**
 * TTL de mensagens FCM em segundos (1 hora).
 * Usado em android.ttl e no header apns-expiration.
 * Centralizado aqui para evitar repetição em
 * batch-sender.ts e helpers.ts.
 */
export const FCM_TTL_SECONDS = 3600;

// ==========================================
// RATE LIMITING
// ==========================================

/** Janela padrão de rate limit (1 minuto) */
export const RATE_LIMIT_WINDOW_MS = 60_000;

/** Janela de rate limit longa (5 minutos) */
export const RATE_LIMIT_WINDOW_LONG_MS = 300_000;

/** Janela de rate limit de migração (1 hora) */
export const RATE_LIMIT_MIGRATION_MS = 60 * 60 * 1000;

// ==========================================
// CONCORRÊNCIA / PARALELISMO
// ==========================================

/**
 * Máximo de operações concorrentes ao
 * processar usuários em paralelo.
 */
export const MAX_CONCURRENT_OPS = 10;

/**
 * Intervalo de log para operações em massa
 * (logar progresso a cada N itens).
 */
export const BULK_LOG_INTERVAL = 100;

// ==========================================
// TEMPO / LEMBRETES
// ==========================================

/** 24 horas em milissegundos */
export const MS_24_HOURS = 24 * 60 * 60 * 1000;

/** 2 horas em milissegundos */
export const MS_2_HOURS = 2 * 60 * 60 * 1000;

/** 30 minutos em milissegundos */
export const MS_30_MINUTES = 30 * 60 * 1000;

/** Hora padrão de jogo quando não informada */
export const DEFAULT_GAME_HOUR = 20;

// ==========================================
// LEAGUE / DIVISÕES
// ==========================================

/** Thresholds das divisões de liga — source of truth: shared/xp-constants.json */
export const LEAGUE_THRESHOLDS = {
  BRONZE_MAX: xpConstants.leagueThresholds.BRONZE_MAX,
  PRATA_MAX: xpConstants.leagueThresholds.PRATA_MAX,
  OURO_MAX: xpConstants.leagueThresholds.OURO_MAX,
  DIAMANTE_MAX: xpConstants.leagueThresholds.DIAMANTE_MAX,
} as const;

/**
 * Pesos da fórmula de League Rating — source of truth: shared/xp-constants.json
 * Formula: 40% PPJ + 30% WR + 20% GD + 10% MVP
 */
export const LEAGUE_RATING_WEIGHTS = {
  PPJ: xpConstants.leagueRatingWeights.PPJ,
  WIN_RATE: xpConstants.leagueRatingWeights.WIN_RATE,
  GOAL_DIFF: xpConstants.leagueRatingWeights.GOAL_DIFF,
  MVP_RATE: xpConstants.leagueRatingWeights.MVP_RATE,
} as const;

/** XP máximo para normalização do PPJ — source of truth: shared/xp-constants.json antiCheatLimits */
export const LEAGUE_MAX_AVG_XP = xpConstants.antiCheatLimits.MAX_XP_PER_GAME;

/** MVP rate cap para normalização */
export const LEAGUE_MVP_RATE_CAP = 0.5;

/** Progression constants — source of truth: shared/xp-constants.json */
export const LEAGUE_PROMOTION_GAMES_REQUIRED = xpConstants.leagueProgression.PROMOTION_GAMES_REQUIRED;
export const LEAGUE_RELEGATION_GAMES_REQUIRED = xpConstants.leagueProgression.RELEGATION_GAMES_REQUIRED;
export const LEAGUE_PROTECTION_GAMES = xpConstants.leagueProgression.PROTECTION_GAMES;
export const LEAGUE_MAX_RECENT_GAMES = xpConstants.leagueProgression.MAX_RECENT_GAMES;

/** Division colors — source of truth: shared/xp-constants.json */
export const DIVISION_COLORS = xpConstants.divisionColors;

// ==========================================
// BADGES
// ==========================================

/** Thresholds de streak para badges */
export const BADGE_STREAK_THRESHOLDS = {
  IRON_MAN: 10,
  STREAK_30: 30,
} as const;

/** Thresholds de jogos para badges veterano */
export const BADGE_VETERAN_THRESHOLDS = {
  VETERAN_50: 50,
  VETERAN_100: 100,
} as const;

/** Thresholds de vitórias para badges */
export const BADGE_WINNER_THRESHOLDS = {
  WINNER_25: 25,
  WINNER_50: 50,
} as const;

/** Defesas mínimas para badge DEFENSIVE_WALL */
export const BADGE_DEFENSIVE_WALL_SAVES = 10;

// ==========================================
// VOTING
// ==========================================

// ==========================================
// XP LIMITS
// ==========================================

/**
 * XP máximo por jogo (anti-cheat)
 * source of truth: shared/xp-constants.json
 */
export const MAX_XP_PER_GAME = xpConstants.antiCheatLimits.MAX_XP_PER_GAME;

/**
 * XP mínimo possível por jogo (penalidades)
 * source of truth: shared/xp-constants.json
 */
export const MIN_XP_PER_GAME = xpConstants.antiCheatLimits.MIN_XP_PER_GAME;

// ==========================================
// ANTI-CHEAT LIMITS
// ==========================================

/**
 * Máximo de gols por jogo
 * source of truth: shared/xp-constants.json
 */
export const MAX_GOALS_PER_GAME =
  xpConstants.antiCheatLimits.MAX_GOALS_PER_GAME;

/**
 * Máximo de assistências por jogo
 * source of truth: shared/xp-constants.json
 */
export const MAX_ASSISTS_PER_GAME =
  xpConstants.antiCheatLimits.MAX_ASSISTS_PER_GAME;

/**
 * Máximo de defesas por jogo
 * source of truth: shared/xp-constants.json
 */
export const MAX_SAVES_PER_GAME =
  xpConstants.antiCheatLimits.MAX_SAVES_PER_GAME;

// ==========================================
// VOTING
// ==========================================

/** Janela de votação MVP em horas */
export const MVP_VOTE_WINDOW_HOURS = 24;

// ==========================================
// WAITLIST
// ==========================================

/**
 * Tempo que um jogador da waitlist tem para
 * responder à vaga (30 minutos).
 */
export const WAITLIST_RESPONSE_TIMEOUT_MS =
  30 * 60 * 1000;

/** Máximo de jogadores na waitlist a notificar */
export const WAITLIST_NOTIFY_LIMIT = 5;

// ==========================================
// CHECK-IN
// ==========================================

/** Raio padrao de check-in em metros (source of truth) */
export const CHECK_IN_RADIUS_METERS = 200;

/** Raio maximo de check-in em metros */
export const CHECK_IN_MAX_RADIUS_METERS = 2000;

/** Precisao GPS maxima (metros) para aceitar check-in */
export const CHECK_IN_MAX_GPS_ACCURACY_METERS = 100;
