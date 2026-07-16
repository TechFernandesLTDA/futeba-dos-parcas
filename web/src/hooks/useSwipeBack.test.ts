import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSwipeBack } from './useSwipeBack';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({ key: 'route-key', pathname: '/game/123' }),
}));

function touchEvent(type: string, clientX: number, clientY: number) {
  const event = new Event(type);
  const touch = { clientX, clientY };
  Object.defineProperty(event, type === 'touchend' ? 'changedTouches' : 'touches', {
    value: [touch],
  });
  return event;
}

describe('useSwipeBack', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;
  let originalCancelAnimationFrame: typeof window.cancelAnimationFrame;
  let mediaListener: ((event: { matches: boolean }) => void) | undefined;
  let frameId: number;
  let frames: Map<number, FrameRequestCallback>;
  let target: HTMLDivElement;
  let targetRef: { current: HTMLElement | null };

  const flushFrames = () => {
    const pending = [...frames.entries()];
    frames.clear();
    pending.forEach(([, callback]) => callback(16));
  };

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        mediaListener = listener;
      },
      removeEventListener: vi.fn(),
    })) as typeof window.matchMedia;

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
    target.remove();
    window.matchMedia = originalMatchMedia;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    mediaListener = undefined;
    navigate.mockReset();
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

  it('interrompe e limpa o feedback quando reduced-motion muda em runtime', () => {
    renderHook(() => useSwipeBack({ targetRef, distanceThreshold: 100 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    act(() => window.dispatchEvent(touchEvent('touchmove', 60, 22)));
    act(flushFrames);
    expect(target.style.transform).toBe('translateX(40px)');

    act(() => mediaListener?.({ matches: true }));

    expect(target.style.transform).toBe('');
    expect(target.style.opacity).toBe('');
    expect(target.style.transition).toBe('');
    expect(target.style.willChange).toBe('');
  });

  it('navega ao concluir e remove todo feedback visual', () => {
    renderHook(() => useSwipeBack({ targetRef, distanceThreshold: 80 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    act(() => window.dispatchEvent(touchEvent('touchmove', 70, 22)));
    act(flushFrames);
    act(() => window.dispatchEvent(touchEvent('touchend', 110, 22)));

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
