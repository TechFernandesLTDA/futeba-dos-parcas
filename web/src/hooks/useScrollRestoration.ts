import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORAGE_KEY = 'scroll-positions';
const SAVE_DELAY_MS = 150;

function getScrollPositions(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('Failed to read scroll positions from sessionStorage:', error);
    return {};
  }
}

function saveScrollPosition(key: string, top: number) {
  try {
    const positions = getScrollPositions();
    positions[key] = top;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch (error) {
    console.warn('Failed to save scroll position to sessionStorage:', error);
  }
}

function getScrollPosition(key: string): number | null {
  const positions = getScrollPositions();
  return positions[key] ?? null;
}

function getScrollKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

type ScrollContainer = HTMLElement | Window;

function isWindow(container: ScrollContainer): container is Window {
  return container === window;
}

function getScrollContainer(scrollContainerId?: string): ScrollContainer {
  if (scrollContainerId) {
    return document.getElementById(scrollContainerId) ?? window;
  }

  const main = document.getElementById('main-content');
  if (main instanceof HTMLElement) {
    const overflowY = window.getComputedStyle(main).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return main;
    }
  }

  return window;
}

function readScrollTop(container: ScrollContainer): number {
  return isWindow(container) ? window.scrollY : container.scrollTop;
}

function writeScrollTop(container: ScrollContainer, top: number) {
  if (isWindow(container)) {
    window.scrollTo(0, top);
  } else {
    container.scrollTop = top;
  }
}

export function useScrollRestoration(scrollContainerId?: string) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const restored = useRef(false);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    const scrollKey = getScrollKey(location.pathname, location.search);
    const container = getScrollContainer(scrollContainerId);

    if (!restored.current) {
      const saved = navigationType === 'POP' ? getScrollPosition(scrollKey) : null;
      const top = saved ?? 0;
      requestAnimationFrame(() => {
        writeScrollTop(container, top);
        requestAnimationFrame(() => writeScrollTop(container, top));
      });
      restored.current = true;
    }

    let saveTimer: number | undefined;
    let pendingTop: number | null = null;

    const flushPendingPosition = () => {
      if (saveTimer !== undefined) {
        window.clearTimeout(saveTimer);
        saveTimer = undefined;
      }
      if (pendingTop === null) return;

      saveScrollPosition(scrollKey, pendingTop);
      pendingTop = null;
    };

    const handleScroll = () => {
      pendingTop = readScrollTop(container);
      if (saveTimer !== undefined) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(flushPendingPosition, SAVE_DELAY_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPendingPosition();
    };

    const target: EventTarget = isWindow(container) ? window : container;
    target.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', flushPendingPosition);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      target.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', flushPendingPosition);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushPendingPosition();
    };
  }, [location.pathname, location.search, navigationType, scrollContainerId]);

  useEffect(() => {
    restored.current = false;
  }, [location.pathname, location.search]);
}
