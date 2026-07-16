import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSwipeBack } from './useSwipeBack';

const navigate = vi.fn();
let reducedMotion = false;
const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ key: 'route-key', pathname: '/game/123' }),
}));

function mockMatchMedia(): MediaQueryList {
  return {
    matches: reducedMotion,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
      mediaListeners.add(listener as (event: MediaQueryListEvent) => void),
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
      mediaListeners.delete(listener as (event: MediaQueryListEvent) => void),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

function touchEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type, { bubbles: true });
  const touch = { clientX, clientY };
  Object.defineProperty(event, type === 'touchend' ? 'changedTouches' : 'touches', {
    value: [touch],
  });
  return event;
}

function completeSwipe(startTarget: EventTarget = window) {
  startTarget.dispatchEvent(touchEvent('touchstart', 10, 20));
  window.dispatchEvent(touchEvent('touchmove', 120, 22));
  window.dispatchEvent(touchEvent('touchend', 120, 22));
}

describe('useSwipeBack', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    reducedMotion = false;
    mediaListeners.clear();
    navigate.mockReset();
    window.matchMedia = vi.fn(mockMatchMedia);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.body.replaceChildren();
  });

  it('desabilita integralmente o gesto quando movimento reduzido está ativo', () => {
    reducedMotion = true;
    renderHook(() => useSwipeBack());

    act(() => completeSwipe());

    expect(navigate).not.toHaveBeenCalled();
  });

  it('promove a camada no toque e cancela quando movimento reduzido é ativado', () => {
    const { result } = renderHook(() => useSwipeBack({ distanceThreshold: 100 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    expect(result.current.isSwiping).toBe(true);
    act(() => window.dispatchEvent(touchEvent('touchmove', 60, 22)));
    expect(result.current.dragProgress).toBe(0.5);

    act(() => {
      reducedMotion = true;
      for (const listener of mediaListeners) {
        listener({ matches: true } as MediaQueryListEvent);
      }
    });
    act(() => window.dispatchEvent(touchEvent('touchend', 120, 22)));

    expect(result.current.dragProgress).toBe(0);
    expect(result.current.isSwiping).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('não rouba swipe iniciado dentro de um contêiner horizontal rolável', () => {
    const scroller = document.createElement('div');
    const target = document.createElement('button');
    scroller.style.overflowX = 'auto';
    Object.defineProperty(scroller, 'clientWidth', { value: 100 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 300 });
    scroller.appendChild(target);
    document.body.appendChild(scroller);
    renderHook(() => useSwipeBack());

    act(() => completeSwipe(target));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('respeita opt-out explícito para componentes virtualizados', () => {
    const container = document.createElement('div');
    const target = document.createElement('span');
    container.setAttribute('data-swipe-back-ignore', '');
    container.appendChild(target);
    document.body.appendChild(container);
    renderHook(() => useSwipeBack());

    act(() => completeSwipe(target));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('mantém swipe-back em conteúdo comum', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    renderHook(() => useSwipeBack());

    act(() => completeSwipe(target));

    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
