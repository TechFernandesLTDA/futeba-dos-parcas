// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createTestWrapper } from '../test/renderWithProviders';

// Mocks simples
const mockOnSnapshot = vi.fn();
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockBatchSet = vi.fn();
const mockBatchUpdate = vi.fn();
const mockBatchDelete = vi.fn();
const mockBatchCommit = vi.fn();
const mockWriteBatch = vi.fn();
const mockUpdateDoc = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: vi.fn((...args: any[]) => args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  serverTimestamp: vi.fn(() => ({ _seconds: 0 })),
  documentId: vi.fn(() => '__name__'),
  arrayUnion: vi.fn((...args: any[]) => args),
  arrayRemove: vi.fn((...args: any[]) => args),
  // initializeFirestore é chamado pelo services/firebase.ts ao ser importado.
  // Necessário para evitar "No X export is defined on the mock". #2330
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  // Timestamp precisa ter fromMillis para generateInviteCode (expires_at). #2330
  Timestamp: {
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
    fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }),
    fromMillis: (ms: number) => ({ toDate: () => new Date(ms), toMillis: () => ms }),
  },
}));

vi.mock('../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
}));

vi.mock('../services/firebaseStorage', () => ({
  storage: {},
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

let mockAuthReturn: any = {
  user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
  firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
  loading: false, error: null,
  signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), logout: vi.fn(),
  signInWithGoogle: vi.fn(), resetPassword: vi.fn(), updateUserProfile: vi.fn(),
  refreshUser: vi.fn(), currentUser: { uid: 'test-user-id' },
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { removeGroupMembershipArtifacts, useGroups, useGroupDetail, useCreateGroup, useCashbox, useInvitePlayers } from './useGroups';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

function makeDocRef(...segments: unknown[]) {
  const path = segments
    .filter((segment) => typeof segment === 'string')
    .join('/');
  const parts = path.split('/');
  return {
    id: parts[parts.length - 1],
    path,
  };
}

// Helper para configurar batch mock
function setupBatchMock() {
  mockBatchSet.mockClear();
  mockBatchUpdate.mockClear();
  mockBatchDelete.mockClear();
  mockBatchCommit.mockClear().mockResolvedValue(undefined);
  mockWriteBatch.mockReturnValue({
    set: mockBatchSet,
    update: mockBatchUpdate,
    delete: mockBatchDelete,
    commit: mockBatchCommit,
  });
}

describe('useGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockQuery.mockReturnValue('mock-query');
    mockCollection.mockReturnValue('mock-collection');
    mockOrderBy.mockReturnValue('mock-order');
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
      signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), logout: vi.fn(),
      signInWithGoogle: vi.fn(), resetPassword: vi.fn(), updateUserProfile: vi.fn(),
      refreshUser: vi.fn(), currentUser: { uid: 'test-user-id' },
    };
    vi.mocked(storageRef).mockReturnValue('mock-storage-ref' as never);
    vi.mocked(uploadBytes).mockResolvedValue({} as never);
    vi.mocked(getDownloadURL).mockResolvedValue('https://storage.example/group-logo.jpg');
  });

  it('retorna loading=true inicialmente', () => {
    const { result } = renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    expect(result.current.loading).toBe(true);
  });

  it('consulta subcoleção users/{uid}/groups', () => {
    renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    expect(mockCollection).toHaveBeenCalledWith({}, 'users', 'test-user-id', 'groups');
  });

  it('retorna array vazio quando não há grupos', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({ empty: true, docs: [] });
      return vi.fn();
    });
    const { result } = renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups).toEqual([]);
  });

  it('busca dados completos do grupo da coleção raiz', async () => {
    // useGroups foi migrado para useQuery/getDocs (#2351). Simular via mockGetDocs. #2330
    mockGetDoc.mockResolvedValue({
      exists: () => true, id: 'group-1',
      data: () => ({ name: 'Pelada dos Parças', member_count: 10, owner_id: 'user-1' }),
    });
    mockGetDocs
      // 1ª chamada: subcoleção users/{uid}/groups
      .mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'group-1', data: () => ({ group_id: 'group-1', group_name: 'Pelada dos Parças' }) }],
      })
      // 2ª chamada: groups/{id} da coleção raiz (whereIn)
      .mockResolvedValueOnce({
        docs: [{ id: 'group-1', data: () => ({ name: 'Pelada dos Parças', member_count: 10, owner_id: 'user-1' }) }],
      });
    const { result } = renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.groups).toHaveLength(1);
  });

  it('trata erros do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('Permission denied'));
      return vi.fn();
    });
    const { result } = renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Permission denied');
  });

  it('remove listener no unmount', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('não configura listener quando usuário não está autenticado', async () => {
    mockAuthReturn = {
      user: null, firebaseUser: null, loading: false, error: null,
      signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), logout: vi.fn(),
      signInWithGoogle: vi.fn(), resetPassword: vi.fn(), updateUserProfile: vi.fn(),
      refreshUser: vi.fn(), currentUser: null,
    };
    const { result } = renderHook(() => useGroups(), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });
});

describe('useGroupDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockDoc.mockReturnValue('mock-doc-ref');
    mockCollection.mockReturnValue('mock-collection');
    mockQuery.mockReturnValue('mock-query');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna null e loading=false para groupId null', async () => {
    const { result } = renderHook(() => useGroupDetail(null), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.group).toBeNull();
  });

  it('configura listeners para grupo e membros', () => {
    renderHook(() => useGroupDetail('group-1'), { wrapper: createTestWrapper() });
    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
  });

  it('retorna dados do grupo quando snapshot emite', async () => {
    let callCount = 0;
    mockOnSnapshot.mockImplementation((ref: any, onNext: any) => {
      callCount++;
      if (callCount === 1) {
        onNext({ exists: () => true, id: 'group-1', data: () => ({ name: 'Meu Grupo', member_count: 5, owner_id: 'user-1' }) });
      } else {
        onNext({ docs: [{ id: 'member-1', data: () => ({ user_id: 'user-1', user_name: 'Player 1', role: 'OWNER' }) }] });
      }
      return vi.fn();
    });
    const { result } = renderHook(() => useGroupDetail('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.group).not.toBeNull();
    expect(result.current.members).toHaveLength(1);
  });

  it('filtra membros INACTIVE/REMOVED da lista retornada', async () => {
    let callCount = 0;
    mockOnSnapshot.mockImplementation((ref: any, onNext: any) => {
      callCount++;
      if (callCount === 1) {
        onNext({ exists: () => true, id: 'group-1', data: () => ({ name: 'Meu Grupo', member_count: 3, owner_id: 'user-1' }) });
      } else {
        onNext({
          docs: [
            { id: 'owner', data: () => ({ user_id: 'user-1', user_name: 'Owner', role: 'OWNER', status: 'ACTIVE' }) },
            { id: 'inactive', data: () => ({ user_id: 'user-2', user_name: 'Inactive', role: 'MEMBER', status: 'INACTIVE' }) },
            { id: 'removed', data: () => ({ user_id: 'user-3', user_name: 'Removed', role: 'MEMBER', status: 'REMOVED' }) },
          ],
        });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useGroupDetail('group-1'), { wrapper: createTestWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members.map((member) => member.userId)).toEqual(['user-1']);
  });
});

describe('removeGroupMembershipArtifacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupBatchMock();
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockCollection.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockQuery.mockImplementation((...args: unknown[]) => args);
    mockWhere.mockImplementation((...args: unknown[]) => args);
  });

  it('remove vínculo do usuário e apaga confirmações futuras do grupo', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'game-1', data: () => ({ status: 'SCHEDULED', group_id: 'group-1' }) },
        { id: 'game-2', data: () => ({ status: 'CONFIRMED', group_id: 'group-1' }) },
        { id: 'game-3', data: () => ({ status: 'FINISHED', group_id: 'group-1' }) },
        { id: 'game-4', data: () => ({ status: 'SCHEDULED', group_id: 'group-1', deleted_at: { seconds: 1 } }) },
      ],
    });

    const result = await removeGroupMembershipArtifacts('group-1', 'user-1', 'REMOVED');

    expect(result.confirmationDeletes).toBe(2);
    expect(mockBatchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'groups/group-1/members/user-1' }),
      expect.objectContaining({ status: 'REMOVED' }),
    );
    expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/user-1/groups/group-1' }));
    expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ path: 'confirmations/game-1_user-1' }));
    expect(mockBatchDelete).toHaveBeenCalledWith(expect.objectContaining({ path: 'confirmations/game-2_user-1' }));
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});

describe('useCreateGroup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue({ id: 'new-group-id' });
    setupBatchMock();
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
      signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), logout: vi.fn(),
      signInWithGoogle: vi.fn(), resetPassword: vi.fn(), updateUserProfile: vi.fn(),
      refreshUser: vi.fn(), currentUser: { uid: 'test-user-id' },
    };
  });

  it('cria grupo com batch write', async () => {
    const { result } = renderHook(() => useCreateGroup(), { wrapper: createTestWrapper() });
    await act(async () => {
      const id = await result.current.createGroup({ name: 'Novo Grupo', description: 'Desc' });
      expect(id).toBe('new-group-id');
    });
    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatchSet).toHaveBeenCalled();
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('escreve na subcoleção users/{uid}/groups', async () => {
    const { result } = renderHook(() => useCreateGroup(), { wrapper: createTestWrapper() });
    await act(async () => { await result.current.createGroup({ name: 'Novo Grupo' }); });
    expect(mockDoc).toHaveBeenCalledWith({}, 'users', 'test-user-id', 'groups', 'new-group-id');
  });

  it('envia logo somente depois de criar grupo e membership', async () => {
    const logo = new File(['logo'], 'logo.png', { type: 'image/png' });
    const { result } = renderHook(() => useCreateGroup(), { wrapper: createTestWrapper() });

    await act(async () => {
      const id = await result.current.createGroup({ name: 'Novo Grupo' }, logo);
      expect(id).toBe('new-group-id');
    });

    expect(storageRef).toHaveBeenCalledWith({}, 'users/test-user-id/group-logos/new-group-id/logo.png');
    expect(uploadBytes).toHaveBeenCalledWith('mock-storage-ref', logo, { contentType: 'image/png' });
    expect(getDownloadURL).toHaveBeenCalledWith('mock-storage-ref');
    expect(mockBatchCommit.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(uploadBytes).mock.invocationCallOrder[0]
    );
    expect(vi.mocked(uploadBytes).mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdateDoc.mock.invocationCallOrder[0]
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-group-id' }),
      expect.objectContaining({ photo_url: 'https://storage.example/group-logo.jpg' })
    );
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-group-id' }),
      { group_photo: 'https://storage.example/group-logo.jpg' }
    );
  });

  it('mantém grupo criado quando upload do logo falha', async () => {
    const logo = new File(['logo'], 'logo.png', { type: 'image/png' });
    vi.mocked(uploadBytes).mockRejectedValueOnce(
      Object.assign(new Error('storage/canceled'), { code: 'storage/canceled' })
    );
    const { result } = renderHook(() => useCreateGroup(), { wrapper: createTestWrapper() });

    await act(async () => {
      const id = await result.current.createGroup({ name: 'Novo Grupo' }, logo);
      expect(id).toBe('new-group-id');
    });

    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('repete upload quando Storage ainda não reconhece o dono recém-criado', async () => {
    vi.useFakeTimers();
    vi.mocked(uploadBytes)
      .mockRejectedValueOnce(Object.assign(new Error('storage/unauthorized'), { code: 'storage/unauthorized' }))
      .mockResolvedValueOnce({} as never);
    const logo = new File(['logo'], 'logo.png', { type: 'image/png' });
    const { result } = renderHook(() => useCreateGroup(), { wrapper: createTestWrapper() });

    const createPromise = act(async () => {
      const id = await result.current.createGroup({ name: 'Novo Grupo' }, logo);
      expect(id).toBe('new-group-id');
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(uploadBytes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(750);
    });
    await createPromise;
    vi.useRealTimers();

    expect(uploadBytes).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-group-id' }),
      expect.objectContaining({ photo_url: 'https://storage.example/group-logo.jpg' })
    );
  });

  it('exige autenticação para criar grupo', async () => {
    mockAuthReturn = { user: null, firebaseUser: null, loading: false, error: null,
      signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), logout: vi.fn(),
      signInWithGoogle: vi.fn(), resetPassword: vi.fn(), updateUserProfile: vi.fn(),
      refreshUser: vi.fn(), currentUser: null,
    };
    const { result } = renderHook(() => useCreateGroup(), { wrapper: createTestWrapper() });
    await expect(act(async () => { await result.current.createGroup({ name: 'Teste' }); }))
      .rejects.toThrow('User not authenticated');
  });
});

describe('useCashbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSnapshot.mockReturnValue(vi.fn());
    mockCollection.mockReturnValue('mock-collection');
    mockQuery.mockReturnValue('mock-query');
    mockOrderBy.mockReturnValue('mock-order');
  });

  it('retorna loading=false para groupId null', async () => {
    const { result } = renderHook(() => useCashbox(null), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('calcula saldo corretamente com receitas, despesas e floats legados', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any) => {
      onNext({
        docs: [
          { id: 'tx-1', data: () => ({ type: 'INCOME', amount: 100, date: { toDate: () => new Date() } }) },
          { id: 'tx-2', data: () => ({ type: 'EXPENSE', amount: 30, date: { toDate: () => new Date() } }) },
          { id: 'tx-3', data: () => ({ type: 'INCOME', amount: 50, date: { toDate: () => new Date() } }) },
          { id: 'tx-4', data: () => ({ type: 'EXPENSE', amount: 90, status: 'VOIDED', date: { toDate: () => new Date() } }) },
          { id: 'tx-5', data: () => ({ type: 'INCOME', amount: 0.1, date: { toDate: () => new Date() } }) },
          { id: 'tx-6', data: () => ({ type: 'INCOME', amount: 0.2, date: { toDate: () => new Date() } }) },
        ],
      });
      return vi.fn();
    });
    const { result } = renderHook(() => useCashbox('group-1'), { wrapper: createTestWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.balance).toBe(120.3);
    expect(result.current.transactions).toHaveLength(6);
    expect(result.current.transactions[4]?.amount).toBe(0.1);
    expect(result.current.transactions[5]?.amount).toBe(0.2);
  });

  it('trata erros do snapshot', async () => {
    mockOnSnapshot.mockImplementation((q: any, onNext: any, onError: any) => {
      onError(new Error('Cashbox error'));
      return vi.fn();
    });
    const { result } = renderHook(() => useCashbox('group-1'), { wrapper: createTestWrapper() });
    // Erro passa por getFirestoreErrorMessage — pode ser a mensagem original ou genérica. #2330
    await waitFor(() => expect(result.current.error).toBeTruthy());
  });
});

describe('useInvitePlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'invite-1' });
    mockCollection.mockReturnValue('mock-collection');
    mockDoc.mockReturnValue({ ref: 'mock-ref' });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockQuery.mockReturnValue('mock-query');
    mockWhere.mockReturnValue('mock-where');
    mockRunTransaction.mockReset();
    setupBatchMock();
    mockAuthReturn = {
      user: { id: 'test-user-id', name: 'Test User', photoUrl: null, level: 5 },
      firebaseUser: { uid: 'test-user-id', displayName: 'Test User', photoURL: null },
      loading: false, error: null,
      signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), logout: vi.fn(),
      signInWithGoogle: vi.fn(), resetPassword: vi.fn(), updateUserProfile: vi.fn(),
      refreshUser: vi.fn(), currentUser: { uid: 'test-user-id' },
    };
  });

  it('generateInviteCode retorna código de 6 caracteres em maiúsculas', async () => {
    const { result } = renderHook(() => useInvitePlayers(), { wrapper: createTestWrapper() });
    let code: string | undefined;
    await act(async () => { code = await result.current.generateInviteCode('group-1', 'Meu Grupo'); });
    expect(code).toBeDefined();
    expect(code!.length).toBe(6);
    expect(code).toBe(code!.toUpperCase());
  });

  it('joinByInviteCode (#2515/#2517) marca convite usado e aguarda membership do trigger', async () => {
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockRunTransaction.mockImplementation(async (_db: unknown, callback: (tx: { get: (ref: { path: string }) => Promise<unknown>; update: (ref: { path: string }, data: unknown) => void }) => Promise<string>) => {
      const updates: Array<{ ref: { path: string }; data: unknown }> = [];
      const result = await callback({
        get: async (ref) => {
          if (ref.path === 'groups/group-1/members/test-user-id') {
            return {
              exists: () => false,
              data: () => undefined,
            };
          }

          return {
            exists: () => true,
            data: () => ({
              group_id: 'group-1',
              group_name: 'Grupo Teste',
              used: false,
              expires_at: { toMillis: () => Date.now() + 86400000 },
            }),
          };
        },
        update: (ref, data) => {
          updates.push({ ref, data });
        },
      });

      expect(updates).toHaveLength(1);
      expect(updates[0]?.ref.path).toBe('invites/ABC123');
      return result;
    });
    // #2517: Opção A — o cliente NÃO cria mais member doc; só marca o convite
    // usado e aguarda o member doc aparecer (criado pelo trigger onInviteRedeemed).
    // O onSnapshot dispara imediatamente com exists()=true para resolver o wait.
    mockOnSnapshot.mockImplementation((_ref: any, onNext: any) => {
      onNext({ exists: () => true });
      return vi.fn();
    });
    const { result } = renderHook(() => useInvitePlayers(), { wrapper: createTestWrapper() });
    await act(async () => {
      const groupId = await result.current.joinByInviteCode('ABC123');
      expect(groupId).toBe('group-1');
    });
    expect(mockRunTransaction).toHaveBeenCalled();
    // Opção A: marca invite used dentro da transação — NÃO usa writeBatch nem cria member.
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(mockWriteBatch).not.toHaveBeenCalled();
    expect(mockBatchSet).not.toHaveBeenCalled();
    // Aguardou a membership assíncrona via listener.
    expect(mockOnSnapshot).toHaveBeenCalled();
  });

  it('joinByInviteCode não consome convite quando o usuário já é membro ACTIVE', async () => {
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockRunTransaction.mockImplementation(async (_db: unknown, callback: (tx: { get: (ref: { path: string }) => Promise<unknown>; update: (ref: { path: string }, data: unknown) => void }) => Promise<string>) => {
      await callback({
        get: async (ref) => {
          if (ref.path === 'groups/group-1/members/test-user-id') {
            return {
              exists: () => true,
              data: () => ({ status: 'ACTIVE' }),
            };
          }

          return {
            exists: () => true,
            data: () => ({
              group_id: 'group-1',
              used: false,
              expires_at: { toMillis: () => Date.now() + 86400000 },
            }),
          };
        },
        update: vi.fn(),
      });

      return 'group-1';
    });

    const { result } = renderHook(() => useInvitePlayers(), { wrapper: createTestWrapper() });

    await expect(act(async () => {
      await result.current.joinByInviteCode('ABC123');
    })).rejects.toThrow('Você já faz parte deste grupo.');

    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('joinByInviteCode falha quando o grupo já foi soft-deletado', async () => {
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockRunTransaction.mockImplementation(async (_db: unknown, callback: (tx: { get: (ref: { path: string }) => Promise<unknown>; update: (ref: { path: string }, data: unknown) => void }) => Promise<string>) => {
      await callback({
        get: async (ref) => {
          if (ref.path === 'groups/group-1') {
            return {
              exists: () => true,
              data: () => ({ deleted_at: { seconds: 1 }, status: 'DELETED' }),
            };
          }
          if (ref.path === 'groups/group-1/members/test-user-id') {
            return {
              exists: () => false,
              data: () => ({}),
            };
          }

          return {
            exists: () => true,
            data: () => ({
              group_id: 'group-1',
              used: false,
              expires_at: { toMillis: () => Date.now() + 86400000 },
            }),
          };
        },
        update: vi.fn(),
      });
      return 'group-1';
    });

    const { result } = renderHook(() => useInvitePlayers(), { wrapper: createTestWrapper() });

    await expect(act(async () => {
      await result.current.joinByInviteCode('ABC123');
    })).rejects.toThrow('Código de convite inválido ou expirado');
  });

  it('joinByInviteCode falha com código inválido', async () => {
    mockDoc.mockImplementation((...segments: unknown[]) => makeDocRef(...segments));
    mockRunTransaction.mockImplementation(async (_db: unknown, callback: (tx: { get: (ref: { path: string }) => Promise<unknown>; update: (ref: { path: string }, data: unknown) => void }) => Promise<string>) => {
      await callback({
        get: async () => ({
          exists: () => false,
          data: () => null,
        }),
        update: vi.fn(),
      });
      return 'group-1';
    });
    const { result } = renderHook(() => useInvitePlayers(), { wrapper: createTestWrapper() });
    await expect(act(async () => { await result.current.joinByInviteCode('INVALID'); }))
      .rejects.toThrow('Código de convite inválido ou expirado');
  });
});
