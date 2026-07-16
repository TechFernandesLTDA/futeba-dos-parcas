import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';

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

function getScrollContainer(scrollContainerId: string | undefined, useMainContent: boolean): ScrollContainer {
  if (scrollContainerId) {
    return document.getElementById(scrollContainerId) ?? window;
  }

  // O layout só limita a altura de #main-content em md+; em xs/sm ele cresce
  // com o conteúdo e o scroller real é window (#3762).
  if (!useMainContent) return window;

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
  const useMainContent = useMediaQuery('(min-width:900px)', { noSsr: true });
  const restoredKey = useRef<string | null>(null);

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
    const container = getScrollContainer(scrollContainerId, useMainContent);

    if (restoredKey.current !== scrollKey) {
      const saved = navigationType === 'POP' ? getScrollPosition(scrollKey) : null;
      const top = saved ?? 0;
      requestAnimationFrame(() => {
        writeScrollTop(container, top);
        requestAnimationFrame(() => writeScrollTop(container, top));
      });
      restoredKey.current = scrollKey;
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

    const target: EventTarget = isWindow(container) ? window : container;
    target.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('pagehide', flushPendingPosition);
    return () => {
      target.removeEventListener('scroll', handleScroll);
      window.removeEventListener('pagehide', flushPendingPosition);
      flushPendingPosition();
    };
  }, [location.pathname, location.search, navigationType, scrollContainerId, useMainContent]);

}
