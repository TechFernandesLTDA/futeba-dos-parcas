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

  // Onboarding Tour — Fase 1 (spec feat-2026-05-16-modern-onboarding-tour §3.7)
  onboarding_started: Record<string, never>;
  onboarding_slide_viewed: { slide_index: number; slide_id: string };
  onboarding_skipped: { at_slide_index: number };
  onboarding_carousel_completed: { duration_ms: number };
  checklist_step_completed: { step_id: string; time_since_start_ms: number };
  checklist_completed: { total_duration_ms: number };
  checklist_dismissed: { steps_done: number; steps_total: number };
  onboarding_reward_granted: { reward_type: string };
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
