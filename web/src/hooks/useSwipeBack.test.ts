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
  let mediaListener: ((event: { matches: boolean }) => void) | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) => {
        mediaListener = listener;
      },
      removeEventListener: vi.fn(),
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    mediaListener = undefined;
    navigate.mockReset();
  });

  it('interrompe e limpa o feedback quando reduced-motion muda durante a sessão', () => {
    const { result } = renderHook(() => useSwipeBack({ distanceThreshold: 100 }));

    act(() => window.dispatchEvent(touchEvent('touchstart', 10, 20)));
    expect(result.current.isSwiping).toBe(true);

    act(() => {
      window.dispatchEvent(touchEvent('touchmove', 60, 22));
    });
    expect(result.current.dragProgress).toBe(0.5);

    act(() => mediaListener?.({ matches: true }));
    expect(result.current.dragProgress).toBe(0);
    expect(result.current.isSwiping).toBe(false);

    act(() => mediaListener?.({ matches: false }));
    expect(result.current.dragProgress).toBe(0);
  });
});
