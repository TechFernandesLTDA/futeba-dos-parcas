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

describe('useSwipeBack', () => {
  const originalMatchMedia = window.matchMedia;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  let frameId: number;
  let frames: Map<number, FrameRequestCallback>;
  let target: HTMLDivElement;
  let targetRef: { current: HTMLElement | null };

  const flushFrames = () => {
    const pending = [...frames.entries()];
    frames.clear();
    pending.forEach(([, callback]) => callback(16));
  };

  const completeSwipe = (startTarget: EventTarget = window) => {
    startTarget.dispatchEvent(touchEvent('touchstart', 10, 20));
    window.dispatchEvent(touchEvent('touchmove', 120, 22));
    window.dispatchEvent(touchEvent('touchend', 120, 22));
  };

  beforeEach(() => {
    reducedMotion = false;
    mediaListeners.clear();
    navigate.mockReset();
    window.matchMedia = vi.fn(mockMatchMedia);

    frameId = 0;
    frames = new Map();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
    window.cancelAnimationFrame = vi.fn((id: number) => {
      frames.delete(id);
    });

    target = document.createElement('div');
    document.body.appendChild(target);
    targetRef = { current: target };
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    document.body.replaceChildren();
  });

  it('atualiza o DOM por frame sem re-renderizar durante touchmove', () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount += 1;
      useSwipeBack({ targetRef, distanceThreshold: 100 });
    });

    const initialRenderCount = renderCount;
    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    act(() => window.dispatchEvent(touchEvent('touchmove', 60, 22)));

    expect(renderCount).toBe(initialRenderCount);
    expect(target.style.transform).toBe('');
    expect(target.style.willChange).toBe('transform, opacity');

    act(flushFrames);
    expect(renderCount).toBe(initialRenderCount);
    expect(target.style.transform).toBe('translateX(40px)');
    expect(target.style.opacity).toBe('0.925');
  });

  it('desabilita integralmente o gesto quando movimento reduzido está ativo', () => {
    reducedMotion = true;
    renderHook(() => useSwipeBack({ targetRef }));

    act(() => completeSwipe());

    expect(navigate).not.toHaveBeenCalled();
    expect(target.getAttribute('style')).toBeNull();
  });

  it('interrompe, limpa e não navega quando reduced-motion muda em runtime', () => {
    renderHook(() => useSwipeBack({ targetRef, distanceThreshold: 100 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    act(() => window.dispatchEvent(touchEvent('touchmove', 60, 22)));
    act(flushFrames);
    expect(target.style.transform).toBe('translateX(40px)');

    act(() => {
      reducedMotion = true;
      for (const listener of mediaListeners) listener({ matches: true } as MediaQueryListEvent);
    });
    act(() => window.dispatchEvent(touchEvent('touchend', 120, 22)));

    expect(target.getAttribute('style')).toBe('');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('não rouba swipe iniciado dentro de um contêiner horizontal rolável', () => {
    const scroller = document.createElement('div');
    const touchTarget = document.createElement('button');
    scroller.style.overflowX = 'auto';
    Object.defineProperty(scroller, 'clientWidth', { value: 100 });
    Object.defineProperty(scroller, 'scrollWidth', { value: 300 });
    scroller.appendChild(touchTarget);
    document.body.appendChild(scroller);
    renderHook(() => useSwipeBack({ targetRef }));

    act(() => completeSwipe(touchTarget));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('respeita opt-out explícito para componentes virtualizados', () => {
    const container = document.createElement('div');
    const interactiveTarget = document.createElement('span');
    container.setAttribute('data-swipe-back-ignore', '');
    container.appendChild(interactiveTarget);
    document.body.appendChild(container);
    renderHook(() => useSwipeBack({ targetRef }));

    act(() => completeSwipe(interactiveTarget));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('mantém swipe-back em conteúdo comum e limpa o feedback', () => {
    const touchTarget = document.createElement('div');
    document.body.appendChild(touchTarget);
    renderHook(() => useSwipeBack({ targetRef }));

    act(() => completeSwipe(touchTarget));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(target.getAttribute('style')).toBe('');
  });

  it('cancela o gesto sem navegar e remove o feedback', () => {
    renderHook(() => useSwipeBack({ targetRef, distanceThreshold: 80 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    act(() => window.dispatchEvent(touchEvent('touchmove', 70, 22)));
    act(flushFrames);
    act(() => window.dispatchEvent(new Event('touchcancel')));

    expect(navigate).not.toHaveBeenCalled();
    expect(target.getAttribute('style')).toBe('');
  });

  it('cancela frame pendente e limpa estilos ao desmontar', () => {
    const { unmount } = renderHook(() => useSwipeBack({ targetRef, distanceThreshold: 100 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    act(() => window.dispatchEvent(touchEvent('touchmove', 60, 22)));
    expect(frames.size).toBe(1);

    unmount();

    expect(frames.size).toBe(0);
    expect(target.getAttribute('style')).toBe('');
  });
});
