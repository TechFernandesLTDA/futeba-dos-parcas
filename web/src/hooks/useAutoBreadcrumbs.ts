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
  '/messages': 'nav.messages',
  '/level-journey': 'breadcrumbs.levelJourney',
  '/feed': 'nav.feed',
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
  'games': 'nav.games',
  'locations': 'nav.locations',
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
    const pushItem = (item: BreadcrumbItem) => {
      const lastItem = items[items.length - 1];
      if (lastItem?.label === item.label) {
        items[items.length - 1] = item;
        return;
      }
      items.push(item);
    };

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      accumulatedPath += `/${segment}`;

      // Known paths/slugs must win over the length heuristic: static segments such
      // as "challenges" and "notifications" also look like Firebase IDs.
      const isId = /^[a-zA-Z0-9_-]{10,}$/.test(segment);

      if (ROUTE_LABEL_KEYS[accumulatedPath]) {
        pushItem({
          label: t(ROUTE_LABEL_KEYS[accumulatedPath]),
          to: accumulatedPath,
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
        if (parentLabelKey) {
          pushItem({
            label: t(parentLabelKey),
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
