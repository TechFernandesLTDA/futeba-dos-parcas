import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'scroll-positions';

function getScrollPositions(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveScrollPosition(pathname: string, top: number) {
  try {
    const positions = getScrollPositions();
    positions[pathname] = top;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    /* sessionStorage unavailable */
  }
}

function getScrollPosition(pathname: string): number | null {
  const positions = getScrollPositions();
  return positions[pathname] ?? null;
}

export function useScrollRestoration(scrollContainerId?: string) {
  const location = useLocation();
  const restored = useRef(false);

  useEffect(() => {
    const container = scrollContainerId
      ? document.getElementById(scrollContainerId)
      : window;

    if (!restored.current) {
      const saved = getScrollPosition(location.pathname);
      if (saved !== null) {
        requestAnimationFrame(() => {
          if (container === window) {
            window.scrollTo(0, saved);
          } else if (container instanceof HTMLElement) {
            container.scrollTop = saved;
          }
        });
      }
      restored.current = true;
    }

    const handleScroll = () => {
      const top = container === window
        ? window.scrollY
        : (container instanceof HTMLElement ? container.scrollTop : 0);
      saveScrollPosition(location.pathname, top);
    };

    const target: EventTarget = (container === window ? document : container) ?? document;
    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => target.removeEventListener('scroll', handleScroll);
  }, [location.pathname, scrollContainerId]);

  useEffect(() => {
    restored.current = false;
  }, [location.pathname]);
}
