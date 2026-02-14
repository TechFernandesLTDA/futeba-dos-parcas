/**
 * Constantes centralizadas - Futeba dos Parças
 *
 * Limites do Firestore, FCM, e regras de negócio
 * reutilizadas em múltiplos módulos.
 *
 * Regra: Se um número aparece em 2+ arquivos,
 * ele DEVE estar aqui.
 */

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

/** Thresholds das divisões de liga */
export const LEAGUE_THRESHOLDS = {
  BRONZE_MAX: 30,
  PRATA_MAX: 50,
  OURO_MAX: 70,
  DIAMANTE_MAX: 100,
} as const;

/**
 * Pesos da fórmula de League Rating.
 * Formula: 40% PPJ + 30% WR + 20% GD + 10% MVP
 */
export const LEAGUE_RATING_WEIGHTS = {
  PPJ: 0.40,
  WIN_RATE: 0.30,
  GOAL_DIFF: 0.20,
  MVP_RATE: 0.10,
} as const;

/** XP máximo para normalização do PPJ */
export const LEAGUE_MAX_AVG_XP = 500;

/** MVP rate cap para normalização */
export const LEAGUE_MVP_RATE_CAP = 0.5;

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
