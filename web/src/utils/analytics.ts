/**
 * Helper type-safe para rastreamento de eventos.
 * Centraliza todos os eventos de analytics em um único lugar.
 */

// Definição de todos os eventos possíveis
interface AnalyticsEventMap {
  // Auth
  login: { method: 'email' | 'google' };
  signup: { method: 'email' | 'google' };
  logout: Record<string, never>;
  password_reset: Record<string, never>;

  // Games
  game_created: { fieldType: string; groupId?: string };
  game_viewed: { gameId: string; status: string };
  game_confirmed: { gameId: string; position: string };
  game_cancelled: { gameId: string };

  // Groups
  group_created: { type: 'PUBLIC' | 'PRIVATE' };
  group_viewed: { groupId: string };
  group_joined: { groupId: string };

  // Votes
  mvp_voted: { gameId: string };

  // Navigation
  screen_viewed: { screen: string };
  tab_changed: { tab: string };
  search_performed: { query: string; results: number };

  // Gamification
  level_up: { level: number; xp: number };
  badge_unlocked: { badgeId: string };

  // Performance — Web Vitals (#1088)
  // FID está deprecated em web-vitals 4.x (substituído por INP), mas tipo ainda lista
  web_vital: {
    name: 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB' | 'FID';
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
  };
}

type EventName = keyof AnalyticsEventMap;

/**
 * Registra um evento de analytics de forma type-safe.
 *
 * @example
 * trackEvent('game_created', { fieldType: 'SOCIETY' });
 * trackEvent('login', { method: 'google' });
 */
export function trackEvent<E extends EventName>(
  event: E,
  params: AnalyticsEventMap[E]
): void {
  if (import.meta.env.DEV) {
    console.debug(`[Analytics] ${event}`, params);
  }

  // Integração futura: Firebase Analytics, Amplitude, Mixpanel etc.
  // analytics.logEvent(event, params);
}

/**
 * Registra visualização de tela.
 */
export function trackScreenView(screenName: string): void {
  trackEvent('screen_viewed', { screen: screenName });
}
