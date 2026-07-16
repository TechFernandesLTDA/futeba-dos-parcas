import { createContext, useContext, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { BreadcrumbItem } from '../components/layout/AppBreadcrumbs';

export type RegisterBreadcrumbOverride = () => () => void;

export const BreadcrumbOverrideContext = createContext<RegisterBreadcrumbOverride | null>(null);

/**
 * Registers a screen-owned breadcrumb trail. While registered, AppLayout hides
 * its path-derived trail so the document exposes exactly one breadcrumb nav.
 */
export function useAppBreadcrumbOverride(enabled = true) {
  const registerOverride = useContext(BreadcrumbOverrideContext);

  useEffect(() => {
    if (!enabled || !registerOverride) return;
    return registerOverride();
  }, [enabled, registerOverride]);
}

const ROUTE_LABEL_KEYS: Record<string, string> = {
  '/': 'nav.home',
  '/games': 'nav.games',
  '/groups': 'nav.groups',
  '/league': 'nav.league',
  '/badges': 'breadcrumbs.badges',
  '/profile': 'nav.profile',
  '/settings': 'nav.settings',
  '/statistics': 'nav.statistics',
  '/notifications': 'nav.notifications',
  '/search': 'nav.search',
  '/about': 'breadcrumbs.about',
  '/whats-new': 'breadcrumbs.whatsNew',
  '/locations': 'nav.locations',
  '/map': 'nav.map',
  '/public-games': 'breadcrumbs.publicGames',
  '/invite-friend': 'breadcrumbs.inviteFriend',
  '/dream-team': 'breadcrumbs.dreamTeam',
  '/weekly-ranking': 'breadcrumbs.weeklyRanking',
  '/weekly-recap': 'breadcrumbs.weeklyRecap',
  '/evolution': 'breadcrumbs.evolution',
  '/head-to-head': 'breadcrumbs.headToHead',
  '/messages': 'nav.messages',
  '/level-journey': 'breadcrumbs.levelJourney',
  '/feed': 'nav.feed',
  '/admin': 'breadcrumbs.admin',
  '/dev': 'breadcrumbs.devTools',
  '/players': 'breadcrumbs.players',
};

// Parent groupings without a route of their own must never become links. In
// particular, `/map` and `/admin` currently fall through to the 404 route.
const NON_LINKABLE_PATHS = new Set(['/map', '/admin', '/players']);

const DYNAMIC_LABEL_KEYS: Record<string, string> = {
  'game': 'breadcrumbs.game',
  'group': 'breadcrumbs.group',
  'location': 'breadcrumbs.location',
  'player': 'breadcrumbs.player',
  'user': 'breadcrumbs.user',
  'profile': 'nav.profile',
  'messages': 'nav.messages',
};

const SUB_ROUTE_LABEL_KEYS: Record<string, string> = {
  'edit': 'breadcrumbs.edit',
  'create': 'breadcrumbs.create',
  'settings': 'nav.settings',
  'cashbox': 'breadcrumbs.cashbox',
  'players': 'nav.players',
  'schedules': 'nav.schedules',
  'invite': 'breadcrumbs.invite',
  'league': 'nav.league',
  'challenges': 'breadcrumbs.challenges',
  'live': 'breadcrumbs.live',
  'vote': 'breadcrumbs.vote',
  'results': 'breadcrumbs.results',
  'teams': 'breadcrumbs.teams',
  'report': 'breadcrumbs.report',
  'blocked': 'breadcrumbs.blocked',
  'stats': 'nav.statistics',
  'events': 'breadcrumbs.events',
  'theme': 'breadcrumbs.theme',
  'notifications': 'nav.notifications',
  'gamification': 'breadcrumbs.gamification',
  'feedbacks': 'breadcrumbs.feedbacks',
  'verify': 'breadcrumbs.verify',
  'owner': 'breadcrumbs.owner',
  'discover': 'breadcrumbs.discover',
  'map': 'nav.map',
  'games': 'nav.games',
  'locations': 'nav.locations',
  'dashboard': 'breadcrumbs.dashboard',
  'onboarding': 'breadcrumbs.onboarding',
  'post': 'breadcrumbs.post',
  'users': 'breadcrumbs.users',
  'feedback': 'breadcrumbs.feedback',
  'game-reviews': 'breadcrumbs.gameReviews',
  'performance': 'breadcrumbs.performance',
  'nearby': 'breadcrumbs.nearby',
};

const DYNAMIC_DETAIL_LABEL_KEYS: Record<string, string> = {
  messages: 'breadcrumbs.conversation',
};

// The post itself is already represented by the static "Post" crumb. Its ID
// adds no useful information and must not produce a second generic detail item.
const OMIT_DYNAMIC_DETAIL_FOR = new Set(['post']);

export function useAutoBreadcrumbs(): BreadcrumbItem[] {
  const { t } = useTranslation();
  const location = useLocation();

  return useMemo(() => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '') return [];

    const segments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];
    let accumulatedPath = '';
    const pushItem = (item: BreadcrumbItem) => {
      const lastItem = items[items.length - 1];
      if (lastItem?.label === item.label && lastItem.to === item.to) return;
      items.push(item);
    };

    // `/dev` is a standalone route. Add a valid parent so the breadcrumb is
    // useful and survives AppBreadcrumbs' intentional single-item suppression.
    if (pathname === '/dev') {
      pushItem({ label: t('nav.home'), to: '/' });
    }

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      accumulatedPath += `/${segment}`;

      // Known paths/slugs must win over the length heuristic: static segments such
      // as "challenges" and "notifications" also look like Firebase IDs.
      const isId = /^[a-zA-Z0-9_-]{10,}$/.test(segment);

      if (ROUTE_LABEL_KEYS[accumulatedPath]) {
        pushItem({
          label: t(ROUTE_LABEL_KEYS[accumulatedPath]),
          to: NON_LINKABLE_PATHS.has(accumulatedPath) ? undefined : accumulatedPath,
        });
      } else if (SUB_ROUTE_LABEL_KEYS[segment]) {
        pushItem({
          label: t(SUB_ROUTE_LABEL_KEYS[segment]),
          to: accumulatedPath,
        });
      } else if (isId && i > 0) {
        // Dynamic values are never used as labels. Unknown parents are omitted
        // instead of leaking an internal ID or untranslated route slug.
        const parentSegment = segments[i - 1];
        const parentLabelKey = DYNAMIC_LABEL_KEYS[parentSegment];
        if (parentLabelKey && !OMIT_DYNAMIC_DETAIL_FOR.has(parentSegment)) {
          pushItem({
            label: t(DYNAMIC_DETAIL_LABEL_KEYS[parentSegment] ?? 'breadcrumbs.details'),
            to: accumulatedPath,
          });
        }
      } else if (DYNAMIC_LABEL_KEYS[segment]) {
        pushItem({
          label: t(DYNAMIC_LABEL_KEYS[segment]),
          to: accumulatedPath,
        });
      }
    }

    return items;
  }, [location.pathname, t]);
}
