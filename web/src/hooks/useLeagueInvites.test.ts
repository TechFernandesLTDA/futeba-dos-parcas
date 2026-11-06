// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

const SERVER_TIMESTAMP = { __serverTimestamp: true } as any;

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  query: vi.fn((base: unknown, ...constraints: unknown[]) => ({ base, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ type: 'where', field, op, value })),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => SERVER_TIMESTAMP),
  // Timestamp com classe real para expires_at (toMillis na asserção).
  Timestamp: class TimestampMock {
    ms: number;
    constructor(ms: number) {
      this.ms = ms;
    }
    toDate(): Date {
      return new Date(this.ms);
    }
    toMillis(): number {
      return this.ms;
    }
    static fromDate(d: Date) {
      return new TimestampMock(d.getTime());
    }
    static fromMillis(ms: number) {
      return new TimestampMock(ms);
    }
    static now() {
      return new TimestampMock(Date.now());
    }
  },
  // services/firebase.ts precisa existir no mock. #2330
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
}));

vi.mock('../services/firebase', () => ({ db: {} }));

const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  }),
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User' },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

// useGroups é mockado: o contrato deste hook só usa { groups, loading }.
let mockUseGroupsReturn: any = { groups: [], loading: false };

vi.mock('./useGroups', () => ({
  useGroups: () => mockUseGroupsReturn,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../utils/firebaseErrors', () => ({
  getFirestoreErrorMessage: (err: any) => `fb:${err?.code ?? err?.message ?? 'unknown'}`,
}));

import { useLeagueInvites, type LeagueInviteOption, type LeagueInviteTarget } from './useLeagueInvites';

function makeDocRef(...segments: unknown[]) {
  const path = segments.filter((s) => typeof s === 'string').join('/');
  const parts = path.split('/');
  return { id: parts[parts.length - 1], path };
}

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g-1',
    name: 'Pelada Liga',
    ownerId: 'test-user-id',
    memberCount: 12,
    photoUrl: null,
    ...overrides,
  };
}

const TARGET: LeagueInviteTarget = { userId: 'u-2', userName: 'Player Dois' };

const EMPTY_PENDING = { empty: true, size: 0, docs: [] as any[] };

beforeEach(() => {
  vi.clearAllMocks();
  mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
  // 1ª getDocs: pendentes (sender, grupo, alvo); 2ª: pendentes totais do sender.
  mockGetDocs.mockResolvedValue(EMPTY_PENDING);
  mockGetDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  mockSetDoc.mockResolvedValue(undefined);
  mockAuthReturn = {
    user: { id: 'test-user-id', name: 'Test User' },
    firebaseUser: { uid: 'test-user-id', displayName: 'Test User' },
  };
  mockUseGroupsReturn = { groups: [makeGroup()], loading: false };
});

describe('useLeagueInvites — opções de convite', () => {
  it('expõe somente grupos gerenciados (ownerId === uid)', () => {
    mockUseGroupsReturn = {
      groups: [makeGroup(), makeGroup({ id: 'g-2', ownerId: 'outro' })],
      loading: false,
    };
    const { result } = renderHook(() => useLeagueInvites());
    expect(result.current.inviteOptions).toHaveLength(1);
    const option = result.current.inviteOptions[0];
    expect(option.id).toBe('group:g-1');
    expect(option.label).toBe('Pelada Liga');
    expect(option.helper).toBe('12 membros');
    expect(option.group.ownerId).toBe('test-user-id');
  });

  it('helper usa 0 membros quando memberCount está ausente', () => {
    mockUseGroupsReturn = { groups: [makeGroup({ memberCount: undefined })], loading: false };
    const { result } = renderHook(() => useLeagueInvites());
    expect(result.current.inviteOptions[0].helper).toBe('0 membros');
  });

  it('prefere firebaseUser.uid sobre user.id para filtrar os grupos', () => {
    mockAuthReturn = {
      user: { id: 'app-1', name: 'App User' },
      firebaseUser: { uid: 'fb-1', displayName: 'FB User' },
    };
    mockUseGroupsReturn = {
      groups: [makeGroup({ ownerId: 'fb-1' }), makeGroup({ id: 'g-2', ownerId: 'app-1' })],
      loading: false,
    };
    const { result } = renderHook(() => useLeagueInvites());
    expect(result.current.inviteOptions.map((o) => o.id)).toEqual(['group:g-1']);
  });

  it('sem firebaseUser: cai para user.id', () => {
    mockAuthReturn = { user: { id: 'app-1', name: 'App User' }, firebaseUser: null };
    mockUseGroupsReturn = { groups: [makeGroup({ ownerId: 'app-1' })], loading: false };
    const { result } = renderHook(() => useLeagueInvites());
    expect(result.current.inviteOptions).toHaveLength(1);
  });

  it('loading reflete o loading de useGroups', () => {
    mockUseGroupsReturn = { groups: [], loading: true };
    const { result } = renderHook(() => useLeagueInvites());
    expect(result.current.loading).toBe(true);
  });
});

describe('useLeagueInvites — sendInvite', () => {
  function optionFor(group = makeGroup()): LeagueInviteOption {
    return {
      id: `group:${group.id}`,
      label: group.name,
      helper: `${group.memberCount || 0} membros`,
      group: group as unknown as LeagueInviteOption['group'],
    };
  }

  it('feliz: cria convite PENDING com expiração de 48h e toast de sucesso', async () => {
    const { result } = renderHook(() => useLeagueInvites());
    const before = Date.now();
    await act(async () => {
      await result.current.sendInvite(TARGET, optionFor());
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      group_id: 'g-1',
      group_name: 'Pelada Liga',
      group_photo: null,
      invited_by_id: 'test-user-id',
      invited_by_name: 'Test User',
      invited_user_id: 'u-2',
      invited_user_name: 'Player Dois',
      invited_user_photo: null,
      status: 'PENDING',
      created_at: SERVER_TIMESTAMP,
      updated_at: SERVER_TIMESTAMP,
    });
    const expiresAt = payload.expires_at as { toMillis: () => number };
    const fortyEightHours = 48 * 60 * 60 * 1000;
    expect(expiresAt.toMillis()).toBeGreaterThanOrEqual(before + fortyEightHours - 5_000);
    expect(expiresAt.toMillis()).toBeLessThanOrEqual(Date.now() + fortyEightHours + 5_000);
    expect(mockShowSuccess).toHaveBeenCalledWith('Convite enviado.');
    expect(result.current.sending).toBe(false);
  });

  it('displayName prefere firebaseUser.displayName e cai para user.name/Organizador', async () => {
    mockAuthReturn = { user: { id: 'test-user-id', name: 'Nome do App' }, firebaseUser: null };
    const { result } = renderHook(() => useLeagueInvites());
    await act(async () => {
      await result.current.sendInvite(TARGET, optionFor());
    });
    expect(mockSetDoc.mock.calls[0][1].invited_by_name).toBe('Nome do App');

    mockAuthReturn = { user: { id: 'test-user-id' }, firebaseUser: null };
    const second = renderHook(() => useLeagueInvites());
    await act(async () => {
      await second.result.current.sendInvite(TARGET, optionFor());
    });
    expect(mockSetDoc.mock.calls[1][1].invited_by_name).toBe('Organizador');
  });

  it('convidando a si mesmo: erro e sem escrita', async () => {
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(
          { userId: 'test-user-id', userName: 'Eu' },
          optionFor(),
        );
      }),
    ).rejects.toThrow('Não é possível convidar você mesmo.');
    expect(mockSetDoc).not.toHaveBeenCalled();
    expect(mockShowError).toHaveBeenCalledWith('Não é possível convidar você mesmo.');
  });

  it('grupo não gerenciado: apenas o dono pode convidar', async () => {
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor(makeGroup({ ownerId: 'outro' })));
      }),
    ).rejects.toThrow('Apenas o dono do grupo pode convidar jogadores.');
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('membro com vínculo ativo: erro e sem convite', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'ACTIVE' }) });
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor());
      }),
    ).rejects.toThrow('Este jogador já possui vínculo ativo ou bloqueado neste grupo.');
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('membro REMOVED pode ser reconvidado (validação continua até o fim)', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'REMOVED' }) });
    const { result } = renderHook(() => useLeagueInvites());
    await act(async () => {
      await result.current.sendInvite(TARGET, optionFor());
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('convite pendente existente para o mesmo par: erro e sem escrita', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ empty: false, size: 1, docs: [{ id: 'invite-1' }] })
      .mockResolvedValueOnce(EMPTY_PENDING);
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor());
      }),
    ).rejects.toThrow('Já existe um convite pendente para este jogador neste grupo.');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('limite de 20 convites pendentes do sender no grupo: erro', async () => {
    // 1ª getDocs: pendentes do (sender, grupo, alvo) — vazios; 2ª: total do
    // sender no grupo — exatamente no limite (>= 20).
    const pendingSnapshots = [EMPTY_PENDING, { empty: false, size: 20, docs: [] }];
    let pendingCall = 0;
    mockGetDocs.mockReset().mockImplementation(
      () => Promise.resolve(pendingSnapshots[pendingCall++] ?? EMPTY_PENDING),
    );
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor());
      }),
    ).rejects.toThrow('Você já tem 20 convites pendentes neste grupo');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('sem uid: sendInvite lança Usuário não autenticado', async () => {
    mockAuthReturn = { user: null, firebaseUser: null };
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor());
      }),
    ).rejects.toThrow('Usuário não autenticado.');
  });

  it('erro sem code: toast com a mensagem do erro e repropaga', async () => {
    mockGetDoc.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor());
      }),
    ).rejects.toThrow('boom');
    expect(mockShowError).toHaveBeenCalledWith('boom');
    expect(result.current.sending).toBe(false);
  });

  it('erro com code do Firestore: toast via getFirestoreErrorMessage', async () => {
    mockGetDoc.mockRejectedValue(
      Object.assign(new Error('permission'), { code: 'permission-denied' }),
    );
    const { result } = renderHook(() => useLeagueInvites());
    await expect(
      act(async () => {
        await result.current.sendInvite(TARGET, optionFor());
      }),
    ).rejects.toThrow('permission');
    expect(mockShowError).toHaveBeenCalledWith('fb:permission-denied');
  });
});
