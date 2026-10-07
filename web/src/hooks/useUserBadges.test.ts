// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const mockGetDocs = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: vi.fn((...args: any[]) => args),
  orderBy: vi.fn((...args: any[]) => args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  Timestamp: class TimestampMock {},
}));

vi.mock('../services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
  app: {},
  appCheck: null,
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User' },
  firebaseUser: null,
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

import { useUserBadges } from './useUserBadges';

function badgeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCollection.mockImplementation((_db: unknown, ...parts: string[]) => parts.join('/'));
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User' },
    firebaseUser: null,
    loading: false,
    error: null,
  };
});

describe('useUserBadges', () => {
  it('sem userId e sem usuário: query desabilitada, não consulta Firestore', () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null };
    const { result } = renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });

    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('consulta users/{uid}/badges ordenado por earned_at desc', async () => {
    renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'test-user-id', 'badges');
    const queryArgs = mockGetDocs.mock.calls[0][0] as unknown[];
    expect(queryArgs[0]).toBe('users/test-user-id/badges');
    expect(queryArgs[1]).toEqual(['earned_at', 'desc']);
  });

  it('userId explícito tem prioridade sobre o id do usuário autenticado', async () => {
    renderHook(() => useUserBadges('other-user-9'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(mockGetDocs).toHaveBeenCalled());

    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'other-user-9', 'badges');
  });

  it('mapeia badge completa (badge_id, nome, ícone, earned_at como Date)', async () => {
    const earnedAt = new Date('2026-03-01T10:00:00Z');
    mockGetDocs.mockResolvedValue({
      docs: [
        badgeDoc('b-1', {
          badge_id: 'goal-machine',
          name: 'Artilheiro',
          icon: '⚽',
          description: '10 gols na temporada',
          type: 'GOAL',
          earned_at: { toDate: () => earnedAt },
          earned: true,
        }),
      ],
    });
    const { result } = renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data![0]).toEqual({
      badgeId: 'goal-machine',
      name: 'Artilheiro',
      icon: '⚽',
      description: '10 gols na temporada',
      type: 'GOAL',
      earnedAt,
      earned: true,
    });
  });

  it('badge_id ausente: usa o id do documento como fallback', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [badgeDoc('doc-fallback', { name: 'X' })],
    });
    const { result } = renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data![0].badgeId).toBe('doc-fallback');
  });

  it('defaults: campos de texto vazios e earned true quando earned não é false', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [badgeDoc('b-2', {})],
    });
    const { result } = renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    const badge = result.current.data![0];
    expect(badge.name).toBe('');
    expect(badge.icon).toBe('');
    expect(badge.description).toBe('');
    expect(badge.type).toBe('');
    expect(badge.earned).toBe(true);
    // earned_at ausente → fallback Date "agora"
    const now = Date.now();
    expect(badge.earnedAt.getTime()).toBeGreaterThanOrEqual(now - 5000);
    expect(badge.earnedAt.getTime()).toBeLessThanOrEqual(now + 5000);
  });

  it('earned=false é preservado', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [badgeDoc('b-3', { earned: false })],
    });
    const { result } = renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(result.current.data![0].earned).toBe(false);
  });

  it('expõe erro bruto do TanStack quando getDocs falha', async () => {
    mockGetDocs.mockRejectedValue(new Error('permission-denied'));
    const { result } = renderHook(() => useUserBadges(), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect((result.current.error as Error).message).toBe('permission-denied');
    expect(result.current.data).toBeUndefined();
  });
});