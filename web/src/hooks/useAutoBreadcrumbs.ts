import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { BreadcrumbItem } from '../components/layout/AppBreadcrumbs';

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
};

const DYNAMIC_LABEL_KEYS: Record<string, string> = {
  'game': 'breadcrumbs.game',
  'group': 'breadcrumbs.group',
  'location': 'breadcrumbs.location',
  'player': 'breadcrumbs.player',
  'user': 'breadcrumbs.user',
  'profile': 'nav.profile',
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
};

export function useAutoBreadcrumbs(): BreadcrumbItem[] {
  const { t } = useTranslation();
  const location = useLocation();

  return useMemo(() => {
    const pathname = location.pathname;
    if (pathname === '/' || pathname === '') return [];

    const segments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [];
    let accumulatedPath = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      accumulatedPath += `/${segment}`;

      // Check if this segment looks like an ID (Firebase IDs are long alphanumeric)
      const isId = /^[a-zA-Z0-9_-]{10,}$/.test(segment);

      if (isId && i > 0) {
        // Use the previous segment's label + the ID as a shortened display
        const parentSegment = segments[i - 1];
        const parentLabelKey = DYNAMIC_LABEL_KEYS[parentSegment];
        const parentLabel = parentLabelKey ? t(parentLabelKey) : parentSegment;
        items.push({
          label: `${parentLabel}`,
          to: accumulatedPath,
        });
      } else if (SUB_ROUTE_LABEL_KEYS[segment]) {
        items.push({
          label: t(SUB_ROUTE_LABEL_KEYS[segment]),
          to: accumulatedPath,
        });
      } else if (ROUTE_LABEL_KEYS[accumulatedPath]) {
        items.push({
          label: t(ROUTE_LABEL_KEYS[accumulatedPath]),
          to: accumulatedPath,
        });
      } else if (DYNAMIC_LABEL_KEYS[segment]) {
        items.push({
          label: t(DYNAMIC_LABEL_KEYS[segment]),
          to: accumulatedPath,
        });
      }
    }

    return items;
  }, [location.pathname, t]);
}
