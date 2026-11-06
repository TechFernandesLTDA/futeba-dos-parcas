import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const mockSaveDraft = vi.fn();
const mockLoadDraft = vi.fn((..._args: unknown[]) => null);
const mockClearDraft = vi.fn();

vi.mock('../utils/gameDraft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  loadDraft: (...args: unknown[]) => mockLoadDraft(...args),
  clearDraft: (...args: unknown[]) => mockClearDraft(...args),
}));

import { useGameDraft } from './useGameDraft';

describe('useGameDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persiste a última edição pendente ao desmontar antes do debounce', () => {
    const { result, unmount } = renderHook(() =>
      useGameDraft<{ title: string; field?: string }>({
        key: 'create_game',
        initialData: { title: '' },
        debounceMs: 2000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(500);
    });

    act(() => {
      result.current.saveDraftData({ title: 'Pelada de quinta', field: 'Arena' });
    });

    expect(mockSaveDraft).not.toHaveBeenCalled();

    unmount();

    expect(mockSaveDraft).toHaveBeenCalledWith('create_game', {
      title: 'Pelada de quinta',
      field: 'Arena',
    });
  });
});
