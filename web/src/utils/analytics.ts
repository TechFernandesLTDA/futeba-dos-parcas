/**
 * Helper type-safe para rastreamento de eventos.
 * Centraliza todos os eventos de analytics em um único lugar.
 */

import { logFirebaseAnalyticsEvent } from '../services/firebaseAnalytics';

const ATTRIBUTION_STORAGE_KEY = 'futeba.analytics.acquisition.v1';
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

type UtmKey = (typeof UTM_KEYS)[number];
export type AcquisitionContext = Partial<Record<UtmKey, string>> & {
  referrer_host?: string;
};

let acquisitionContext: AcquisitionContext | null = null;

// Definição de todos os eventos possíveis
export interface AnalyticsEventMap {
  // Auth
  login: { method: 'email' | 'google' };
  signup: { method: 'email' | 'google' };
  logout: Record<string, never>;
  password_reset: Record<string, never>;

  // Acquisition / conversion
  landing_viewed: { page: 'launch' | 'home' };
  signup_cta_clicked: { location: string };
  support_cta_clicked: { channel: 'whatsapp' | 'email'; location: string };
  registration_completed: { method: 'email' | 'google' };

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

  // Novidades / What's New (spec feat-2026-05-22-version-control-release-notes §3.7)
  whats_new_popup_shown: { version: string; platform: string };
  whats_new_opened: { source: string };
  whats_new_dismissed: { version: string };
}

type EventName = keyof AnalyticsEventMap;

function normalizeCampaignValue(value: string | null): string | undefined {
  const normalized = value?.trim().slice(0, 100);
  return normalized || undefined;
}

function getReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) {
    return undefined;
  }

  try {
    return new URL(document.referrer).hostname.slice(0, 100) || undefined;
  } catch {
    return undefined;
  }
}

function readStoredAcquisitionContext(): AcquisitionContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const safeContext: AcquisitionContext = {};
    for (const key of UTM_KEYS) {
      const rawValue = (parsed as Record<string, unknown>)[key];
      const value = typeof rawValue === 'string' ? normalizeCampaignValue(rawValue) : undefined;
      if (value) {
        safeContext[key] = value;
      }
    }

    const rawReferrer = (parsed as Record<string, unknown>).referrer_host;
    if (typeof rawReferrer === 'string') {
      safeContext.referrer_host = normalizeCampaignValue(rawReferrer);
    }

    return safeContext;
  } catch {
    return null;
  }
}

function captureCurrentAcquisitionContext(): AcquisitionContext {
  if (typeof window === 'undefined') {
    return {};
  }

  const searchParams = new URLSearchParams(window.location.search);
  const captured: AcquisitionContext = {};

  for (const key of UTM_KEYS) {
    const value = normalizeCampaignValue(searchParams.get(key));
    if (value) {
      captured[key] = value;
    }
  }

  const referrerHost = getReferrerHost();
  if (referrerHost) {
    captured.referrer_host = referrerHost;
  }

  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }

  return captured;
}

/** Captura a atribuição da primeira página da sessão e a reutiliza nas conversões. */
export function getAcquisitionContext(): Readonly<AcquisitionContext> {
  acquisitionContext ??= readStoredAcquisitionContext() ?? captureCurrentAcquisitionContext();
  return acquisitionContext;
}

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
  const enrichedParams = { ...getAcquisitionContext(), ...params };

  if (import.meta.env.DEV) {
    console.debug(`[Analytics] ${event}`, enrichedParams);
  }

  logFirebaseAnalyticsEvent(event, enrichedParams);
}

/**
 * Registra visualização de tela.
 */
export function trackScreenView(screenName: string): void {
  trackEvent('screen_viewed', { screen: screenName });
}
