// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

const { mockGetDoc, mockUpdateDoc, mockTrackEvent, mockLoggerWarn } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockTrackEvent: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => ({
    __path: args.filter((a) => typeof a === 'string').join('/'),
  }),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

let mockAuthReturn: any = {
  firebaseUser: { uid: 'user-1' },
  user: null,
  loading: false,
  error: null,
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ warn: mockLoggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import { useOnboarding } from './useOnboarding';

/**
 * jsdom deste host não expõe window.localStorage — injetamos um stub em memória
 * antes de cada teste (mesma convenção de utils/gameDraft.test.ts).
 */
function createFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => (store.has(key) ? (store.get(key) as string) : null),
    setItem: (key: string, value: string): void => void store.set(key, String(value)),
    removeItem: (key: string): void => void store.delete(key),
    key: (index: number): string | null =>
      index >= 0 && index < store.size ? (Array.from(store.keys())[index] as string) : null,
    get length(): number {
      return store.size;
    },
    clear: (): void => void store.clear(),
  };
}

type FakeStorage = ReturnType<typeof createFakeStorage>;

function installStorage(overrides: Record<string, unknown> = {}) {
  const storage = Object.create(createFakeStorage());
  Object.defineProperties(storage, Object.getOwnPropertyDescriptors(overrides));
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage as FakeStorage;
}

const LEGACY_KEY = 'appGuideShown';

function setAuth(uid: string | null) {
  mockAuthReturn = {
    firebaseUser: uid ? { uid } : null,
    user: null,
    loading: false,
    error: null,
  };
}

describe('useOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installStorage();
    setAuth('user-1');
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    installStorage().clear();
  });

  describe('carregamento do estado', () => {
    it('usuário autenticado carrega estado do Firestore (snake_case → OnboardingState)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        get: () => ({
          carousel_completed_at: { toMillis: () => 12345 },
          carousel_skipped: true,
          checklist_steps: { 'create-game': true },
          checklist_completed_at: 999,
          checklist_dismissed: true,
          reward_granted: true,
          version: 1,
        }),
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state).toEqual({
        carouselCompletedAt: 12345,
        carouselSkipped: true,
        checklistSteps: { 'create-game': true },
        checklistCompletedAt: 999,
        checklistDismissed: true,
        rewardGranted: true,
        version: 1,
      });
      expect(mockGetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-1' }),
      );
    });

    it('doc inexistente mantém estado default', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false, get: () => undefined });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state).toEqual({
        carouselCompletedAt: null,
        carouselSkipped: false,
        checklistSteps: {},
        checklistCompletedAt: null,
        checklistDismissed: false,
        rewardGranted: false,
        version: 1,
      });
    });

    it('doc sem campo onboarding mantém estado default', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, get: () => undefined });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselSkipped).toBe(false);
      expect(result.current.state.carouselCompletedAt).toBeNull();
    });

    it('timestamp Firestore sem toMillis e número são aceitos; valor inválido vira null', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        get: () => ({
          carousel_completed_at: 555, // número direto (legado)
          checklist_completed_at: { oops: true }, // sem toMillis → null
        }),
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselCompletedAt).toBe(555);
      expect(result.current.state.checklistCompletedAt).toBeNull();
    });

    it('erro do Firestore não bloqueia o usuário (warn + estado default)', async () => {
      mockGetDoc.mockRejectedValue(new Error('permission denied'));
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselSkipped).toBe(false);
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('usuário não autenticado usa fallback localStorage (flag legado)', async () => {
      setAuth(null);
      globalThis.localStorage.setItem(LEGACY_KEY, 'true');
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselSkipped).toBe(true);
      expect(result.current.state.carouselCompletedAt).not.toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('usuário não autenticado sem flag legado fica no default', async () => {
      setAuth(null);
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselSkipped).toBe(false);
      expect(result.current.state.carouselCompletedAt).toBeNull();
    });

    it('falha silenciosa ao ler localStorage (não autenticado)', async () => {
      setAuth(null);
      installStorage({
        getItem: () => {
          throw new DOMException('Blocked', 'SecurityError');
        },
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselSkipped).toBe(false);
      expect(mockLoggerWarn).not.toHaveBeenCalled(); // localStorage usa console.warn direto
    });

    it('carrega estado novo quando o uid muda (novo carregamento por usuário)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        get: () => ({ carousel_skipped: true, version: 1 }),
      });
      const { result, rerender } = renderHook(() => useOnboarding(), {
        wrapper: createTestWrapper(),
      });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.state.carouselSkipped).toBe(true);

      setAuth('user-2');
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        get: () => ({ carousel_skipped: false, version: 1 }),
      });
      rerender();
      await waitFor(() => expect(result.current.state.carouselSkipped).toBe(false));
      expect(mockGetDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-2' }),
      );
    });
  });

  describe('hasSeenCarousel', () => {
    it('true quando flag legado está ativa mesmo com estado default', async () => {
      globalThis.localStorage.setItem(LEGACY_KEY, 'true');
      mockGetDoc.mockResolvedValue({ exists: () => false, get: () => undefined });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasSeenCarousel()).toBe(true);
    });

    it('false sem flag legado e sem estado concluído', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false, get: () => undefined });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasSeenCarousel()).toBe(false);
    });

    it('true quando carrossel concluído na versão atual', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        get: () => ({ carousel_completed_at: { toMillis: () => 1 }, version: 1 }),
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasSeenCarousel()).toBe(true);
    });

    it('false quando estado é de versão antiga (version < atual)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        get: () => ({ carousel_completed_at: { toMillis: () => 1 }, version: 0 }),
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasSeenCarousel()).toBe(false);
    });

    it('true via carouselSkipped na versão atual (sem completed_at)', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        get: () => ({ carousel_skipped: true, version: 1 }),
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.hasSeenCarousel()).toBe(true);
    });
  });

  describe('carrossel', () => {
    it('onCarouselStarted registra evento e marca início', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      act(() => result.current.onCarouselStarted());
      expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_started', {});
    });

    it('onSlideViewed registra índice e id do slide', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      act(() => result.current.onSlideViewed(2, 'why-pelada'));
      expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_slide_viewed', {
        slide_index: 2,
        slide_id: 'why-pelada',
      });
    });

    it('onCarouselSkipped marca localStorage, estado e persiste em dot-notation', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.onCarouselSkipped(2);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_skipped', { at_slide_index: 2 });
      expect(globalThis.localStorage.getItem(LEGACY_KEY)).toBe('true');
      expect(result.current.state.carouselSkipped).toBe(true);
      expect(result.current.state.version).toBe(1);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-1' }),
        expect.objectContaining({
          'onboarding.carousel_skipped': true,
          'onboarding.version': 1,
        }),
      );
    });

    it('onCarouselCompleted grava serverTimestamp, reseta skipped e atualiza estado', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      act(() => result.current.onCarouselStarted());

      await act(async () => {
        await result.current.onCarouselCompleted();
      });

      expect(mockTrackEvent).toHaveBeenCalledWith(
        'onboarding_carousel_completed',
        expect.objectContaining({ duration_ms: expect.any(Number) }),
      );
      expect(globalThis.localStorage.getItem(LEGACY_KEY)).toBe('true');
      expect(result.current.state.carouselCompletedAt).not.toBeNull();
      expect(result.current.state.version).toBe(1);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-1' }),
        expect.objectContaining({
          'onboarding.carousel_completed_at': 'SERVER_TIMESTAMP',
          'onboarding.carousel_skipped': false,
          'onboarding.version': 1,
        }),
      );
    });

    it('persiste em dot-notation onboarding.* (merge parcial, não objeto inteiro)', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));
      await act(async () => {
        await result.current.onCarouselSkipped(0);
      });
      const payload = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
      expect(Object.keys(payload).every((k) => k.startsWith('onboarding.'))).toBe(true);
      expect(payload['onboarding.version']).toBeDefined();
    });
  });

  describe('checklist', () => {
    it('onChecklistVisible marca início e onChecklistStepCompleted registra tempo', () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      act(() => result.current.onChecklistVisible());
      act(() => result.current.onChecklistStepCompleted('create-game'));
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'checklist_step_completed',
        expect.objectContaining({ step_id: 'create-game', time_since_start_ms: expect.any(Number) }),
      );
    });

    it('onChecklistAllCompleted concede recompensa e persiste serverTimestamp', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.onChecklistAllCompleted(4500);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('checklist_completed', { total_duration_ms: 4500 });
      expect(mockTrackEvent).toHaveBeenCalledWith('onboarding_reward_granted', {
        reward_type: 'badge_welcome',
      });
      expect(result.current.state.rewardGranted).toBe(true);
      expect(result.current.state.checklistCompletedAt).not.toBeNull();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-1' }),
        expect.objectContaining({
          'onboarding.checklist_completed_at': 'SERVER_TIMESTAMP',
          'onboarding.reward_granted': true,
        }),
      );
    });

    it('onChecklistDismissed marca dismissed com contagem de steps', async () => {
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.onChecklistDismissed(2, 5);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith('checklist_dismissed', {
        steps_done: 2,
        steps_total: 5,
      });
      expect(result.current.state.checklistDismissed).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ __path: 'users/user-1' }),
        { 'onboarding.checklist_dismissed': true },
      );
    });
  });

  describe('persistência resiliente', () => {
    it('falha de updateDoc não propaga erro e mantém estado local', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('offline'));
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await expect(
        act(async () => {
          await result.current.onCarouselSkipped(1);
        }),
      ).resolves.toBeUndefined();

      expect(mockLoggerWarn).toHaveBeenCalled();
      expect(result.current.state.carouselSkipped).toBe(true);
      expect(globalThis.localStorage.getItem(LEGACY_KEY)).toBe('true');
    });

    it('persistUpdates é no-op sem autenticação (não chama updateDoc)', async () => {
      setAuth(null);
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.onCarouselSkipped(1);
      });

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(result.current.state.carouselSkipped).toBe(true);
      expect(globalThis.localStorage.getItem(LEGACY_KEY)).toBe('true');
    });

    it('falha ao gravar localStorage no skip não bloqueia o estado', async () => {
      installStorage({
        setItem: () => {
          throw new DOMException('QuotaExceeded', 'QuotaExceededError');
        },
      });
      const { result } = renderHook(() => useOnboarding(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.onCarouselSkipped(1);
      });

      expect(result.current.state.carouselSkipped).toBe(true);
      expect(mockUpdateDoc).toHaveBeenCalled();
    });
  });
});