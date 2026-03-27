import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mocks
const mockOnSnapshot = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import { useBadges } from './useBadges';
import { BADGE_DEFINITIONS } from '../types/gamification';

describe('useBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockWhere.mockReturnValue('mock-where');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useBadges('user-1'));
    expect(result.current.loading).toBe(true);
  });

  it('retorna loading=false sem userId', async () => {
    const { result } = renderHook(() => useBadges(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('inclui definições de badges (BADGE_DEFINITIONS)', () => {
    const { result } = renderHook(() => useBadges('user-1'));
    expect(result.current.badges).toEqual(BADGE_DEFINITIONS);
    expect(result.current.badges.length).toBeGreaterThan(0);
  });

  it('marca badges desbloqueadas com unlockedIds', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          {
            id: 'ub-1',
            data: () => ({
              user_id: 'user-1',
              badge_id: 'first_game',
              count: 1,
              unlocked_at: { toDate: () => new Date() },
            }),
          },
          {
            id: 'ub-2',
            data: () => ({
              user_id: 'user-1',
              badge_id: 'streak_3',
              count: 2,
              unlocked_at: { toDate: () => new Date() },
            }),
          },
        ],
      });
      return vi.fn();
    });

    const { result } = renderHook(() => useBadges('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userBadges).toHaveLength(2);
    expect(result.current.unlockedIds.has('first_game')).toBe(true);
    expect(result.current.unlockedIds.has('streak_3')).toBe(true);
    expect(result.current.unlockedIds.has('mvp_1')).toBe(false);
  });

  it('trata badges vazias corretamente', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    const { result } = renderHook(() => useBadges('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.userBadges).toEqual([]);
    expect(result.current.unlockedIds.size).toBe(0);
  });

  it('trata erros do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('Badge error'));
      return vi.fn();
    });

    const { result } = renderHook(() => useBadges('user-1'));

    await waitFor(() => {
      expect(result.current.error).toBe('Badge error');
      expect(result.current.loading).toBe(false);
    });
  });
});
