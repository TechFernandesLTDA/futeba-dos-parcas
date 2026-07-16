import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

describe('useGlobalShortcuts', () => {
  afterEach(() => {
    navigate.mockReset();
    vi.restoreAllMocks();
  });

  it('mantém listeners estáveis e lê os estados mais recentes pelas refs', () => {
    const handlers = {
      onOpenPalette: vi.fn(),
      onClosePalette: vi.fn(),
      onOpenShortcuts: vi.fn(),
      onCloseShortcuts: vi.fn(),
    };
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { rerender, unmount } = renderHook(
      ({ paletteOpen, shortcutsOpen }) => useGlobalShortcuts({
        paletteOpen,
        shortcutsOpen,
        ...handlers,
      }),
      { initialProps: { paletteOpen: false, shortcutsOpen: false } }
    );
    const shortcutAdds = () => addSpy.mock.calls.filter(([type]) =>
      ['keydown', 'open-shortcuts', 'open-command-palette'].includes(type)
    );

    expect(shortcutAdds()).toHaveLength(3);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
    expect(handlers.onOpenPalette).toHaveBeenCalledTimes(1);

    rerender({ paletteOpen: true, shortcutsOpen: true });
    expect(shortcutAdds()).toHaveLength(3);
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(handlers.onClosePalette).toHaveBeenCalledTimes(1);
    expect(handlers.onCloseShortcuts).toHaveBeenCalledTimes(1);

    unmount();
    const shortcutRemovals = removeSpy.mock.calls.filter(([type]) =>
      ['keydown', 'open-shortcuts', 'open-command-palette'].includes(type)
    );
    expect(shortcutRemovals).toHaveLength(3);
  });
});
