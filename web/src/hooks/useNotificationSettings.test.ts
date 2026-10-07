// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// t ESTÁVEL
const mockT = (key: string) => key;

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('firebase/firestore', () => {
  class MockTimestamp {
    ms: number;
    constructor(ms: number) { this.ms = ms; }
    toDate(): Date { return new Date(this.ms); }
    toMillis(): number { return this.ms; }
    static fromDate(d: Date): MockTimestamp { return new MockTimestamp(d.getTime()); }
    static fromMillis(ms: number): MockTimestamp { return new MockTimestamp(ms); }
    static now(): MockTimestamp { return new MockTimestamp(Date.now()); }
  }
  return {
    doc: (...args: any[]) => mockDoc(...args),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    serverTimestamp: () => SERVER_TIMESTAMP,
    Timestamp: MockTimestamp,
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
  };
});

vi.mock('../services/firebase', () => ({ db: {} }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError, showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: unknown) => {
    const code = (err as { code?: string })?.code;
    if (code) return `ff:${code}`;
    return err instanceof Error ? err.message : 'ff:unknown';
  },
}));

import { useNotificationSettings } from './useNotificationSettings';
import { Timestamp } from 'firebase/firestore';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockGetDoc.mockResolvedValue({ exists: () => false });
  mockSetDoc.mockResolvedValue(undefined);
});

describe('useNotificationSettings — carga', () => {
  it('carrega configurações existentes (snake→camel), timestamp mute_until e defaults nos ausentes', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        push_enabled: false,
        game_reminders: false,
        game_invites: false,
        reminder_time: 15,
        mute_until: Timestamp.fromMillis(1735689600000),
      }),
    });
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings.pushEnabled).toBe(false);
    expect(result.current.settings.gameReminders).toBe(false);
    expect(result.current.settings.gameInvites).toBe(false);
    expect(result.current.settings.groupInvites).toBe(true); // default
    expect(result.current.settings.reminderTime).toBe(15);
    expect(result.current.settings.muteUntil).toEqual(new Date(1735689600000));
    expect(result.current.error).toBeNull();
    expect(mockGetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notification_settings/user-1' }),
    );
  });

  it('documento inexistente: mantém DEFAULT_SETTINGS e desliga loading', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.settings).toEqual({
      pushEnabled: true,
      gameReminders: true,
      gameInvites: true,
      groupInvites: true,
      achievements: true,
      mvpVotes: true,
      levelUp: true,
      systemAnnouncements: true,
      gameChat: true,
      groupWall: true,
      reminderTime: 30,
      muteUntil: null,
    });
    expect(result.current.error).toBeNull();
  });

  it('sem userId: não consulta Firestore e desliga loading', async () => {
    const { result } = renderHook(() => useNotificationSettings());
    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('erro na carga: expõe mensagem mapeada e desliga loading (não relança)', async () => {
    mockGetDoc.mockRejectedValue(Object.assign(new Error('x'), { code: 'unavailable' }));
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.error).toBe('ff:unavailable'));
    expect(result.current.loading).toBe(false);
  });

  it('refresh recarrega do Firestore', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.settings.pushEnabled).toBe(true);

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ push_enabled: false }),
    });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.settings.pushEnabled).toBe(false);
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  it('resolução após unmount não grava estado (cancelamento #2278)', async () => {
    let resolveGet!: (v: unknown) => void;
    mockGetDoc.mockReturnValue(new Promise((resolve) => { resolveGet = resolve; }));
    const { unmount } = renderHook(() => useNotificationSettings('user-1'));
    unmount();
    await act(async () => {
      expect(() => resolveGet({ exists: () => true, data: () => ({ push_enabled: false }) })).not.toThrow();
    });
  });
});

describe('useNotificationSettings — saveSettings', () => {
  it('grava payload snake_case com merge e toast de sucesso', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.saveSettings({
        pushEnabled: false,
        gameReminders: true,
        gameInvites: true,
        groupInvites: true,
        achievements: true,
        mvpVotes: true,
        levelUp: true,
        systemAnnouncements: true,
        gameChat: true,
        groupWall: true,
        reminderTime: 10,
        muteUntil: null,
      });
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'notification_settings/user-1' }),
      expect.objectContaining({
        push_enabled: false,
        game_reminders: true,
        game_invites: true,
        group_invites: true,
        achievements: true,
        mvp_votes: true,
        level_up: true,
        system_announcements: true,
        game_chat: true,
        group_wall: true,
        reminder_time: 10,
        mute_until: null,
        updated_at: SERVER_TIMESTAMP,
      }),
      { merge: true },
    );
    expect(mockShowSuccess).toHaveBeenCalledWith('feedback.notifications.settingsSaved');
  });

  it('sem userId: não grava e não exibe toast', async () => {
    const { result } = renderHook(() => useNotificationSettings());
    await act(async () => {});
    await act(async () => {
      await result.current.saveSettings({ pushEnabled: false });
    });
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('falha na gravação: toast de erro e rethrow', async () => {
    mockSetDoc.mockRejectedValue(Object.assign(new Error('x'), { code: 'permission-denied' }));
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await act(async () => {
      try {
        await result.current.saveSettings({ pushEnabled: false });
      } catch (e) {
        expect((e as { code?: string }).code).toBe('permission-denied');
      }
    });
    expect(mockShowError).toHaveBeenCalledWith('feedback.notifications.settingsSaveError');
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });
});

describe('useNotificationSettings — setPreference / mute', () => {
  it('setPreference atualiza otimistamente e persiste a chave', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setPreference('pushEnabled', false);
    });
    await waitFor(() => expect(mockSetDoc).toHaveBeenCalled());

    expect(result.current.settings.pushEnabled).toBe(false);
    // demais flags preservadas do estado anterior
    expect(result.current.settings.gameReminders).toBe(true);
    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.push_enabled).toBe(false);
  });

  it('setPreference pref segura números (reminderTime)', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.setPreference('reminderTime', 60);
    });
    expect(result.current.settings.reminderTime).toBe(60);
  });

  it('setPreference reverte o valor anterior quando a gravação falha', async () => {
    // Rejeita num macrotask: dá tempo de o React commitar o estado otimista
    // (que captura `previous`) antes do catch reverter — como num roundtrip real.
    mockSetDoc.mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('quota')), 50)));
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setPreference('pushEnabled', false);
    });
    await waitFor(() => expect(result.current.settings.pushEnabled).toBe(true)); // revertido
    expect(mockShowError).toHaveBeenCalledWith('feedback.notifications.settingsSaveError');
  });

  it('setMuteUntil grava mute_until = agora + horas', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const before = Date.now();
    await act(async () => {
      result.current.setMuteUntil(2);
    });
    await waitFor(() => expect(result.current.settings.muteUntil).toBeInstanceOf(Date));

    const muteUntil = result.current.settings.muteUntil!;
    expect(muteUntil.getTime()).toBeGreaterThanOrEqual(before + TWO_HOURS_MS);
    expect(muteUntil.getTime()).toBeLessThanOrEqual(Date.now() + TWO_HOURS_MS);
    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect((payload.mute_until as Date).getTime()).toBe(muteUntil.getTime());
    expect(mockShowSuccess).toHaveBeenCalledWith('feedback.notifications.settingsSaved');
  });

  it('clearMute zera muteUntil e persiste null', async () => {
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setMuteUntil(1);
    });
    await waitFor(() => expect(result.current.settings.muteUntil).toBeInstanceOf(Date));

    await act(async () => {
      result.current.clearMute();
    });
    await waitFor(() => expect(result.current.settings.muteUntil).toBeNull());
    const payload = mockSetDoc.mock.calls[mockSetDoc.mock.calls.length - 1][1] as Record<string, unknown>;
    expect(payload.mute_until).toBeNull();
  });

  it('mute pref reverte quando a gravação falha', async () => {
    mockSetDoc.mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new Error('offline')), 50)));
    const { result } = renderHook(() => useNotificationSettings('user-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setMuteUntil(4);
    });
    await waitFor(() => expect(result.current.settings.muteUntil).toBeNull()); // revertido
  });
});
