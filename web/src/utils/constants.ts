/**
 * Constantes centralizadas para evitar magic numbers/strings no código.
 */

// Layout
export const MOBILE_MAX_WIDTH = 480;
export const BOTTOM_NAV_HEIGHT = 64;
export const FAB_BOTTOM_OFFSET = 80;

// Firestore
export const FIRESTORE_BATCH_LIMIT = 400; // margem segura (máximo é 500)
export const FIRESTORE_WHERE_IN_LIMIT = 10;
export const FIRESTORE_DEFAULT_PAGE_SIZE = 20;

// Debounce
export const DEBOUNCE_SEARCH_MS = 300;
export const DEBOUNCE_INPUT_MS = 500;

// Toast
export const TOAST_DURATION_DEFAULT = 4000;
export const TOAST_DURATION_ERROR = 6000;
export const TOAST_DURATION_WARNING = 5000;

// Auth
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_NAME_LENGTH = 50;

// Game
export const DEFAULT_MAX_PLAYERS = 14;
export const DEFAULT_MAX_GOALKEEPERS = 2;
export const DEFAULT_GAME_DURATION_MINUTES = 60;

// Pagination
export const ITEMS_PER_PAGE = 20;
export const NOTIFICATIONS_LIMIT = 5;
export const ACTIVITIES_LIMIT = 5;

// Cache
export const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutos

// XP System
export const XP_PARTICIPATION = 10;
export const XP_GOAL = 5;
export const XP_ASSIST = 3;
export const XP_SAVE = 2;
export const XP_MVP = 50;
export const XP_WIN = 20;
export const XP_STREAK_3 = 10;
export const XP_STREAK_7 = 20;
export const XP_STREAK_10 = 30;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  GAMES: '/games',
  GAME_DETAIL: '/game/:gameId',
  GAME_CREATE: '/game/create',
  GROUPS: '/groups',
  GROUP_DETAIL: '/group/:groupId',
  GROUP_CREATE: '/group/create',
  PROFILE: '/profile',
  PROFILE_EDIT: '/profile/edit',
  SETTINGS: '/settings',
  BADGES: '/badges',
  RANKING: '/ranking',
  LEAGUE: '/league',
  STATISTICS: '/statistics',
  SEARCH: '/search',
  NOTIFICATIONS: '/notifications',
  LEVEL_JOURNEY: '/level-journey',
} as const;
