import {
  useEffect,
  useRef,
  useCallback,
  type FocusEvent as ReactFocusEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useLocation } from 'react-router-dom';

// Route module cache to avoid re-importing
const routeModuleCache = new Map<string, boolean>();

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  '/game/create': () => import('../pages/game/CreateGameScreen'),
  '/group/create': () => import('../pages/group/CreateGroupScreen'),
  '/profile/edit': () => import('../pages/profile/EditProfileScreen'),
  '/level-journey': () => import('../pages/profile/LevelJourneyScreen'),
  '/league': () => import('../pages/league/LeagueScreen'),
  '/statistics': () => import('../pages/statistics/StatisticsScreen'),
  '/badges': () => import('../pages/badges/BadgesScreen'),
  '/locations': () => import('../pages/locations/ManageLocationsScreen'),
  '/map/locations': () => import('../pages/map/LocationsMapScreen'),
  '/settings': () => import('../pages/settings/SettingsScreen'),
  '/notifications': () => import('../pages/ranking/NotificationsScreen'),
  '/messages': () => import('../pages/messages/DirectMessagesScreen'),
};

function canPrefetchOnCurrentNetwork(): boolean {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;

  if (!connection) return true;
  if (connection.saveData) return false;
  return !['slow-2g', '2g'].includes(connection.effectiveType ?? '');
}

function scheduleIdle(callback: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(callback, 1200);
  return () => globalThis.clearTimeout(id);
}

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
      '/': ['/league'],
      '/profile/edit': ['/level-journey'],
      '/league': ['/statistics'],
      '/statistics': ['/league'],
    };

    if (!canPrefetchOnCurrentNetwork()) return;

    const currentPath = location.pathname;
    const routesToPrefetch = prefetchMap[currentPath] || [];

    return scheduleIdle(() => {
      routesToPrefetch.forEach((route) => {
        if (!prefetchedRoutes.current.has(route) && !routeModuleCache.has(route)) {
          preloadRouteModule(route)
            .finally(() => {
              prefetchedRoutes.current.add(route);
            });
        }
      });
    });
  }, [location.pathname]);
}

/**
 * Prefetch a specific route when user hovers over a link
 * Call this on onMouseEnter/onFocus of navigation links
 */
export function prefetchRoute(route: string): Promise<void> {
  if (!canPrefetchOnCurrentNetwork()) return Promise.resolve();
  return preloadRouteModule(route);
}

/**
 * Retorna handlers reutilizáveis que leem a rota de `data-prefetch-route`.
 * Deve ser chamado uma única vez por componente, nunca dentro de maps.
 */
export function usePrefetchOnHover(
  prefetch: (route: string) => Promise<void> = prefetchRoute,
) {
  const prefetchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingPrefetch = useCallback(() => {
    if (prefetchTimeout.current !== null) {
      clearTimeout(prefetchTimeout.current);
      prefetchTimeout.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const route = event.currentTarget.dataset.prefetchRoute;
    if (!route) return;
    clearPendingPrefetch();
    // Delay prefetch by 100ms to avoid unnecessary prefetches on quick hovers
    prefetchTimeout.current = setTimeout(() => {
      prefetchTimeout.current = null;
      void prefetch(route);
    }, 100);
  }, [clearPendingPrefetch, prefetch]);

  const handleMouseLeave = clearPendingPrefetch;

  const handleFocus = useCallback((event: ReactFocusEvent<HTMLElement>) => {
    const route = event.currentTarget.dataset.prefetchRoute;
    if (!route) return;
    clearPendingPrefetch();
    void prefetch(route);
  }, [clearPendingPrefetch, prefetch]);

  useEffect(() => clearPendingPrefetch, [clearPendingPrefetch]);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
  };
}
