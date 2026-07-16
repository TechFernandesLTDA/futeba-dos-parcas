import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScrollRestoration } from './useScrollRestoration';

const mockLocation = { pathname: '/home', search: '' };
let mockNavigationType: 'POP' | 'PUSH' | 'REPLACE' = 'PUSH';

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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    vi.advanceTimersByTime(20);
    vi.advanceTimersByTime(20);
    const initialScrollCalls = vi.mocked(window.scrollTo).mock.calls.length;
    mockLocation.pathname = '/home';
    rerender();
    vi.advanceTimersByTime(20);
    expect(window.scrollTo).toHaveBeenCalledTimes(initialScrollCalls);
  });

  it('agrupa eventos de scroll e persiste apenas a posição mais recente', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.style.overflowY = 'auto';
    document.body.appendChild(main);
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
    main.remove();
  });

  it('faz flush da posição pendente ao desmontar antes do debounce', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.style.overflowY = 'auto';
    document.body.appendChild(main);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { unmount } = renderHook(() => useScrollRestoration());
    main.scrollTop = 120;
    main.dispatchEvent(new Event('scroll'));
    expect(setItemSpy).not.toHaveBeenCalled();

    unmount();

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem('scroll-positions') ?? '{}')).toEqual({ '/home': 120 });
    main.remove();
  });

  it('faz flush da posição pendente em pagehide sem gravar novamente pelo timer', () => {
    const main = document.createElement('main');
    main.id = 'main-content';
    main.style.overflowY = 'auto';
    document.body.appendChild(main);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const { unmount } = renderHook(() => useScrollRestoration());
    main.scrollTop = 75;
    main.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('pagehide'));

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(150);
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    unmount();
    main.remove();
  });
});
