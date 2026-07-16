import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollRestoration } from './useScrollRestoration';

const mockLocation = { pathname: '/home', search: '' };
let mockNavigationType: 'POP' | 'PUSH' | 'REPLACE' = 'PUSH';
const originalMatchMedia = window.matchMedia;
let viewportChangeListener: ((event: MediaQueryListEvent) => void) | undefined;
let desktopViewport = false;

function setDesktopViewport(matches: boolean) {
  desktopViewport = matches;
  window.matchMedia = vi.fn((query: string): MediaQueryList => ({
    get matches() {
      return query === '(min-width:900px)' ? desktopViewport : false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (query === '(min-width:900px)') {
        viewportChangeListener = listener as (event: MediaQueryListEvent) => void;
      }
    },
    removeEventListener: vi.fn(),
    addListener: (listener: (event: MediaQueryListEvent) => void) => {
      if (query === '(min-width:900px)') viewportChangeListener = listener;
    },
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function appendDesktopMain() {
  setDesktopViewport(true);
  const main = document.createElement('main');
  main.id = 'main-content';
  main.style.overflowY = 'auto';
  document.body.appendChild(main);
  return main;
}

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
  useNavigationType: () => mockNavigationType,
}));

describe('useScrollRestoration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.scrollTo = vi.fn();
    mockLocation.pathname = '/home';
    mockLocation.search = '';
    mockNavigationType = 'PUSH';
    setDesktopViewport(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    viewportChangeListener = undefined;
    document.getElementById('main-content')?.remove();
  });

  it('rola para o topo quando não há posição salva', () => {
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('restaura scroll salvo quando existe posição em navegação POP', () => {
    mockNavigationType = 'POP';
    sessionStorage.setItem('scroll-positions', JSON.stringify({ '/home': 150 }));
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 150);
  });

  it('restaura scroll para zero quando posição salva é zero em navegação POP', () => {
    mockNavigationType = 'POP';
    sessionStorage.setItem('scroll-positions', JSON.stringify({ '/home': 0 }));
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('lida com JSON corrompido no sessionStorage', () => {
    sessionStorage.setItem('scroll-positions', 'invalid-json');
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('não quebra com sessionStorage vazio', () => {
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('não restaura novamente para mesmo pathname', () => {
    mockNavigationType = 'POP';
    sessionStorage.setItem('scroll-positions', JSON.stringify({ '/home': 150 }));
    const { rerender } = renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(40);
    const initialScrollCalls = vi.mocked(window.scrollTo).mock.calls.length;
    rerender();
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledTimes(initialScrollCalls);
  });

  it('agrupa eventos e persiste apenas a posição mais recente', () => {
    const main = appendDesktopMain();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = renderHook(() => useScrollRestoration());
    main.scrollTop = 10;
    main.dispatchEvent(new Event('scroll'));
    main.scrollTop = 40;
    main.dispatchEvent(new Event('scroll'));
    main.scrollTop = 90;
    main.dispatchEvent(new Event('scroll'));

    expect(setItemSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(149);
    expect(setItemSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem('scroll-positions') ?? '{}')).toEqual({ '/home': 90 });
    unmount();
  });

  it('faz flush da posição pendente ao desmontar antes do debounce', () => {
    const main = appendDesktopMain();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = renderHook(() => useScrollRestoration());
    main.scrollTop = 120;
    main.dispatchEvent(new Event('scroll'));
    expect(setItemSpy).not.toHaveBeenCalled();

    unmount();

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem('scroll-positions') ?? '{}')).toEqual({ '/home': 120 });
  });

  it('faz flush em pagehide sem gravar novamente pelo timer', () => {
    const main = appendDesktopMain();
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { unmount } = renderHook(() => useScrollRestoration());
    main.scrollTop = 75;
    main.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('pagehide'));

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(150);
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('observa window no mobile mesmo quando main declara overflow auto', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.style.overflowY = 'auto';
    document.body.appendChild(main);
    Object.defineProperty(window, 'scrollY', { value: 64, configurable: true });
    renderHook(() => useScrollRestoration());

    main.scrollTop = 20;
    main.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(150);
    expect(sessionStorage.getItem('scroll-positions')).toBeNull();

    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(150);
    expect(JSON.parse(sessionStorage.getItem('scroll-positions') ?? '{}')).toEqual({ '/home': 64 });
  });

  it('observa main no desktop onde sua altura é limitada pelo layout', () => {
    const main = appendDesktopMain();
    renderHook(() => useScrollRestoration());
    main.scrollTop = 88;
    main.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(150);
    expect(JSON.parse(sessionStorage.getItem('scroll-positions') ?? '{}')).toEqual({ '/home': 88 });
  });

  it('rebinda o listener sem saltar ao cruzar o breakpoint', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.style.overflowY = 'auto';
    document.body.appendChild(main);
    renderHook(() => useScrollRestoration());
    vi.advanceTimersByTime(40);
    const restorationCalls = vi.mocked(window.scrollTo).mock.calls.length;

    act(() => {
      desktopViewport = true;
      viewportChangeListener?.({ matches: true } as MediaQueryListEvent);
    });
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledTimes(restorationCalls);

    main.scrollTop = 52;
    main.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(150);
    expect(JSON.parse(sessionStorage.getItem('scroll-positions') ?? '{}')).toEqual({ '/home': 52 });
  });
});
