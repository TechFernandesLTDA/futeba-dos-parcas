import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Route module cache to avoid re-importing
const routeModuleCache = new Map<string, boolean>();

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/games': () => import('../pages/games/GamesScreen'),
  '/groups': () => import('../pages/groups/GroupsScreen'),
  '/profile': () => import('../pages/profile/ProfileScreen'),
  '/game/create': () => import('../pages/game/CreateGameScreen'),
  '/group/create': () => import('../pages/group/CreateGroupScreen'),
  '/profile/edit': () => import('../pages/profile/EditProfileScreen'),
  '/level-journey': () => import('../pages/profile/LevelJourneyScreen'),
  '/league': () => import('../pages/league/LeagueScreen'),
  '/statistics': () => import('../pages/statistics/StatisticsScreen'),
  '/ranking': () => import('../pages/ranking/RankingScreen'),
};

function preloadRouteModule(route: string): Promise<void> {
  if (routeModuleCache.has(route)) {
    return Promise.resolve();
  }

  const prefetcher = routePrefetchers[route];
  if (!prefetcher) {
    return Promise.resolve();
  }

  return prefetcher()
    .then(() => {
      routeModuleCache.set(route, true);
    })
    .catch(() => {
      // Ignore prefetch errors. Navigation lazy-load remains authoritative.
    });
}

/**
 * Preload critical resources for faster initial page load
 * - Preconnect to Firebase APIs
 * - Prefetch likely next routes based on current route
 */
export function useResourcePreloading() {
  const location = useLocation();
  const prefetchedRoutes = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Preconnect to Firebase APIs
    const preconnectLinks = [
      'https://firestore.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      'https://www.googleapis.com',
    ];

    preconnectLinks.forEach((href) => {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = href;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  }, []);

  useEffect(() => {
    // Prefetch likely next routes based on current route
    const prefetchMap: Record<string, string[]> = {
      '/': ['/game/create', '/groups', '/profile'],
      '/groups': ['/group/create', '/game/create'],
      '/profile': ['/profile/edit', '/level-journey'],
      '/ranking': ['/league', '/statistics'],
      '/league': ['/ranking', '/statistics'],
    };

    const currentPath = location.pathname;
    const routesToPrefetch = prefetchMap[currentPath] || [];

    routesToPrefetch.forEach((route) => {
      if (!prefetchedRoutes.current.has(route) && !routeModuleCache.has(route)) {
        preloadRouteModule(route)
          .finally(() => {
            prefetchedRoutes.current.add(route);
          });
      }
    });
  }, [location.pathname]);
}

/**
 * Prefetch a specific route when user hovers over a link
 * Call this on onMouseEnter/onFocus of navigation links
 */
export function prefetchRoute(route: string): Promise<void> {
  return preloadRouteModule(route);
}

/**
 * Hook to add prefetch behavior to navigation links
 * Returns event handlers for onMouseEnter and onFocus
 */
export function usePrefetchOnHover(route: string) {
  const prefetchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    // Delay prefetch by 100ms to avoid unnecessary prefetches on quick hovers
    prefetchTimeout.current = setTimeout(() => {
      prefetchRoute(route);
    }, 100);
  }, [route]);

  const handleMouseLeave = useCallback(() => {
    if (prefetchTimeout.current) {
      clearTimeout(prefetchTimeout.current);
      prefetchTimeout.current = null;
    }
  }, []);

  const handleFocus = useCallback(() => {
    prefetchRoute(route);
  }, [route]);

  useEffect(() => {
    return () => {
      if (prefetchTimeout.current) {
        clearTimeout(prefetchTimeout.current);
      }
    };
  }, []);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
  };
}
