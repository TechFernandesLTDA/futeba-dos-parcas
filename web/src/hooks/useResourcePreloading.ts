import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Route module cache to avoid re-importing
const routeModuleCache = new Map<string, boolean>();

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
      '/': ['/games', '/groups', '/profile'],
      '/games': ['/game/create', '/groups'],
      '/groups': ['/group/create', '/games'],
      '/profile': ['/profile/edit', '/level-journey'],
      '/ranking': ['/league', '/statistics'],
      '/league': ['/ranking', '/statistics'],
    };

    const currentPath = location.pathname;
    const routesToPrefetch = prefetchMap[currentPath] || [];

    routesToPrefetch.forEach((route) => {
      if (!prefetchedRoutes.current.has(route) && !routeModuleCache.has(route)) {
        // Import route modules dynamically
        import(/* @vite-ignore */ `../pages${route}/index.tsx`)
          .then(() => {
            routeModuleCache.set(route, true);
          })
          .catch(() => {
            // Route module not found or already loaded, ignore
          })
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
  if (routeModuleCache.has(route)) {
    return Promise.resolve();
  }

  return import(/* @vite-ignore */ `../pages${route}/index.tsx`)
    .then(() => {
      routeModuleCache.set(route, true);
    })
    .catch(() => {
      // Ignore errors - route may not exist or already loaded
    });
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
