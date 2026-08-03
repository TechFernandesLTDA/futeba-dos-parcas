import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock Firebase modules
const mockOnAuthStateChanged = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignInWithRedirect = vi.fn();
const mockGetRedirectResult = vi.fn();
const mockGetAdditionalUserInfo = vi.fn(() => ({ isNewUser: false }));
const mockSignOut = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockUpdateProfile = vi.fn();
const mockClearWallMediaOutboxOwner = vi.fn();
const mockUnregisterBrowserFcmToken = vi.fn();
const mockTrackEvent = vi.fn();

vi.mock('../utils/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signInWithPopup: (...args: any[]) => mockSignInWithPopup(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signInWithRedirect: (...args: any[]) => mockSignInWithRedirect(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getRedirectResult: (...args: any[]) => mockGetRedirectResult(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signOut: (...args: any[]) => mockSignOut(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  // #3186: fluxo Google usa isNewUser pra decidir se deleta conta Auth rejeitada
  getAdditionalUserInfo: (...args: unknown[]) => mockGetAdditionalUserInfo(...args),
  GoogleAuthProvider: vi.fn(),
}));

const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockRunTransaction = vi.fn();
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

vi.mock('firebase/firestore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: (...args: any[]) => mockDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: (...args: any[]) => mockCollection(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (...args: any[]) => mockQuery(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: (...args: any[]) => mockWhere(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDoc: (...args: any[]) => mockGetDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDocs: (...args: any[]) => mockGetDocs(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDoc: (...args: any[]) => mockSetDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runTransaction: (...args: any[]) => mockRunTransaction(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  limit: vi.fn((...args) => args[0]),
}));

vi.mock('../services/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {},
  db: {},
  // #2430: cloudFunctions.ts importa `functions` em tempo de módulo;
  // sem este campo o Vitest lança "No 'functions' export" ao avaliar cloudFunctions.ts
  functions: {},
}));

vi.mock('../utils/groupWallMediaOutbox', () => ({
  clearGroupWallMediaOutboxOwner: (...args: unknown[]) => mockClearWallMediaOutboxOwner(...args),
}));

vi.mock('../services/firebaseMessaging', () => ({
  unregisterBrowserFcmToken: (...args: unknown[]) => mockUnregisterBrowserFcmToken(...args),
}));

// Mock de cloudFunctions para isolar o teste do Cloud Functions real
vi.mock('../services/cloudFunctions', () => ({
  syncFieldOwnerClaim: vi.fn().mockResolvedValue({ data: { synced: false, role: '', success: true, message: '' } }),
  validateInviteCode: vi.fn().mockResolvedValue({ data: { valid: true, inviteCode: 'ABC123', inviterName: 'Padrinho' } }),
}));

vi.mock('../utils/firestoreHelpers', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  snakeToCamel: (obj: any) => obj,
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Componente auxiliar para acessar o contexto
function AuthConsumer() {
  const { user, firebaseUser, loading, error } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.name || 'null'}</span>
      <span data-testid="total-games">{String(user?.totalGames ?? 'null')}</span>
      <span data-testid="total-goals">{String(user?.totalGoals ?? 'null')}</span>
      <span data-testid="firebase-user">{firebaseUser?.uid || 'null'}</span>
      <span data-testid="error">{error || 'null'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClearWallMediaOutboxOwner.mockResolvedValue(undefined);
    mockUnregisterBrowserFcmToken.mockResolvedValue(undefined);
    mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: false });
    mockDoc.mockImplementation((...args) => ({ type: 'doc', args }));
    mockCollection.mockImplementation((...args) => ({ type: 'collection', args }));
    mockQuery.mockImplementation((...args) => ({ type: 'query', args }));
    mockWhere.mockImplementation((...args) => ({ type: 'where', args }));
    mockGetDocs.mockResolvedValue({ docs: [], empty: true });
    mockOnSnapshot.mockImplementation(() => vi.fn());
    mockRunTransaction.mockImplementation(async (_db, callback) => {
      return callback({
        get: mockGetDoc,
        set: mockSetDoc,
        update: mockUpdateDoc,
      });
    });
    // Padrão: onAuthStateChanged retorna unsubscribe e não dispara
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      // Simular que não há usuário logado
      setTimeout(() => callback(null), 0);
      return vi.fn(); // unsubscribe
    });
    // #3192: getRedirectResult por padrão retorna null (sem redirect pendente)
    mockGetRedirectResult.mockResolvedValue(null);
    // signInWithRedirect por padrão resolve (simula navegação iniciada)
    mockSignInWithRedirect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fornece estado de loading inicial', () => {
    // Não dispara callback imediatamente
    mockOnAuthStateChanged.mockImplementation(() => vi.fn());

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');
  });

  it('define user como null quando não autenticado', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('destrava o loading quando o observer de auth não responde', async () => {
    vi.useFakeTimers();
    mockOnAuthStateChanged.mockImplementation(() => vi.fn());

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(8_000);
      await Promise.resolve();
    });

    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('firebase-user').textContent).toBe('null');
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('renova silenciosamente o ID token a cada 55 minutos sem tocar no FCM', async () => {
    vi.useFakeTimers();
    const getIdToken = vi.fn().mockResolvedValue('fresh-token');
    const mockFirebaseUser = {
      uid: 'session-uid',
      email: 'session@test.com',
      displayName: 'Sessão Ativa',
      getIdToken,
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    };
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'session-uid',
      data: () => ({ name: 'Sessão Ativa', email: 'session@test.com' }),
    });
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      void callback(mockFirebaseUser);
      return vi.fn();
    });

    const { unmount } = render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(55 * 60 * 1_000);
      await Promise.resolve();
    });

    expect(getIdToken).toHaveBeenCalledWith(false);
    expect(mockUnregisterBrowserFcmToken).not.toHaveBeenCalled();

    unmount();
    getIdToken.mockClear();
    vi.advanceTimersByTime(55 * 60 * 1_000);
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it('define usuário quando Firebase auth state muda', async () => {
    const mockFirebaseUser = { uid: 'test-uid', email: 'test@test.com', displayName: 'Test User' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'test-uid',
      data: () => ({ name: 'Test User', email: 'test@test.com', level: 5 }),
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Test User');
    });
  });

  it('busca dados do usuário do Firestore', async () => {
    const mockFirebaseUser = { uid: 'user-123', email: 'user@test.com' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'user-123',
      data: () => ({ name: 'Jogador', email: 'user@test.com' }),
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(mockGetDoc).toHaveBeenCalled();
    });
  });

  it('mescla statistics e user_streaks já no carregamento inicial da sessão', async () => {
    const mockFirebaseUser = {
      uid: 'stats-user',
      email: 'stats@test.com',
      displayName: 'Jogador Stats',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    };

    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'stats-user',
        data: () => ({
          name: 'Jogador Stats',
          email: 'stats@test.com',
          totalGames: 0,
          totalGoals: 0,
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'stats-user',
        data: () => ({
          totalGames: 12,
          totalGoals: 8,
        }),
      });
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          data: () => ({
            currentStreak: 3,
            longestStreak: 7,
          }),
        },
      ],
      empty: false,
    });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('Jogador Stats');
      expect(screen.getByTestId('total-games').textContent).toBe('12');
      expect(screen.getByTestId('total-goals').textContent).toBe('8');
    });
  });

  it('signIn chama signInWithEmailAndPassword do Firebase', async () => {
    mockSignInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'uid' } });

    // Renderiza e extrai o contexto via componente
    let signInFn: ((email: string, password: string) => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signInFn = auth.signIn;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signInFn).toBeDefined());

    await act(async () => {
      await signInFn!('test@test.com', '123456');
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@test.com',
      '123456'
    );
  });

  it('signOut chama Firebase signOut', async () => {
    mockSignOut.mockResolvedValue(undefined);
    const mockFirebaseUser = { uid: 'logout-uid', email: 'logout@test.com', displayName: 'Logout User' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'logout-uid',
      data: () => ({ name: 'Logout User', email: 'logout@test.com' }),
    });

    let logoutFn: (() => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      logoutFn = auth.logout;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());

    await act(async () => {
      await logoutFn!();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockClearWallMediaOutboxOwner).toHaveBeenCalledWith('logout-uid');
    expect(mockClearWallMediaOutboxOwner.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignOut.mock.invocationCallOrder[0],
    );
  });

  it('signUp cria conta e documento do usuário', async () => {
    const mockResult = {
      user: {
        uid: 'new-uid',
        email: 'new@test.com',
        displayName: null,
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token'),
      },
    };
    mockCreateUserWithEmailAndPassword.mockResolvedValue(mockResult);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    let signUpFn: ((email: string, password: string, name: string, inviteCode: string) => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signUpFn = auth.signUp;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signUpFn).toBeDefined());

    await act(async () => {
      await signUpFn!('new@test.com', 'password123', 'Novo Jogador', 'ABC123');
    });

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'new@test.com',
      'password123'
    );
    expect(mockUpdateProfile).toHaveBeenCalled();
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        invited_by_code: 'ABC123',
        invite_source: 'email_password',
      })
    );
    expect(mockTrackEvent).toHaveBeenCalledWith('registration_completed', { method: 'email' });
  });

  it('usa convite pendente se o observer criar o perfil durante o signUp', async () => {
    let authCallback: ((user: unknown) => Promise<void>) | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      authCallback = callback;
      return vi.fn();
    });

    const mockResult = {
      user: {
        uid: 'race-user',
        email: 'race@test.com',
        displayName: 'Jogador Corrida',
        photoURL: '',
        getIdToken: vi.fn().mockResolvedValue('token'),
        getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
      },
    };
    mockCreateUserWithEmailAndPassword.mockImplementation(async () => {
      await authCallback?.(mockResult.user);
      return mockResult;
    });
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    let signUpFn: ((email: string, password: string, name: string, inviteCode: string) => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signUpFn = auth.signUp;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signUpFn).toBeDefined());

    await act(async () => {
      await signUpFn!('race@test.com', 'password123', 'Jogador Corrida', 'ABC123');
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        invited_by_code: 'ABC123',
        invite_source: 'email_password_auth_observer',
      })
    );
  });

  it('signUp rejeita cadastro sem convite', async () => {
    let signUpFn: ((email: string, password: string, name: string, inviteCode?: string) => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signUpFn = auth.signUp;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signUpFn).toBeDefined());

    await expect(signUpFn!('new@test.com', 'password123', 'Novo Jogador')).rejects.toThrow(
      'Para criar sua conta'
    );
    expect(mockCreateUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it('remove conta Auth recém-criada quando criação do perfil falha', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    const mockResult = {
      user: {
        uid: 'orphan-uid',
        email: 'orphan@test.com',
        displayName: null,
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token'),
        delete: mockDelete,
      },
    };
    mockCreateUserWithEmailAndPassword.mockResolvedValue(mockResult);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockRunTransaction.mockRejectedValue(new Error('firestore-down'));

    let signUpFn: ((email: string, password: string, name: string, inviteCode: string) => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signUpFn = auth.signUp;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signUpFn).toBeDefined());

    await expect(signUpFn!('orphan@test.com', 'password123', 'Jogador Órfão', 'ABC123')).rejects.toThrow();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('trata erros de autenticação definindo error state', async () => {
    mockSignInWithEmailAndPassword.mockRejectedValue({
      code: 'auth/invalid-credential',
      message: 'Invalid credentials',
    });

    let signInFn: ((email: string, password: string) => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signInFn = auth.signIn;
      return <span data-testid="err">{auth.error || 'none'}</span>;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signInFn).toBeDefined());

    await act(async () => {
      try {
        await signInFn!('test@test.com', 'wrong');
      } catch {
        // Esperado
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('err').textContent).not.toBe('none');
    });
  });

  it('loading fica false após verificação de auth', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });
  });

  it('signInWithGoogle chama signInWithPopup', async () => {
    const mockResult = { user: { uid: 'google-uid', email: 'google@test.com', displayName: 'Google User' } };
    mockSignInWithPopup.mockResolvedValue(mockResult);
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'google-uid',
      data: () => ({ name: 'Google User', email: 'google@test.com' }),
    });
    mockSetDoc.mockResolvedValue(undefined);

    let signInWithGoogleFn: (() => Promise<void>) | undefined;
    function Extractor() {
      const auth = useAuth();
      signInWithGoogleFn = auth.signInWithGoogle;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signInWithGoogleFn).toBeDefined());

    await act(async () => {
      await signInWithGoogleFn!();
    });

    expect(mockSignInWithPopup).toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalledWith('registration_completed', { method: 'google' });
  });

  it('registra conversão quando o Google cria um perfil novo', async () => {
    const googleUser = {
      uid: 'new-google-uid',
      email: 'new-google@test.com',
      displayName: 'Novo Google',
      photoURL: null,
      delete: vi.fn(),
    };
    mockSignInWithPopup.mockResolvedValue({ user: googleUser });
    mockGetAdditionalUserInfo.mockReturnValue({ isNewUser: true });
    mockGetDoc.mockResolvedValue({ exists: () => false });

    let signInWithGoogleFn: ((inviteCode?: string) => Promise<void>) | undefined;
    function Extractor() {
      signInWithGoogleFn = useAuth().signInWithGoogle;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(signInWithGoogleFn).toBeDefined());
    await act(async () => {
      await signInWithGoogleFn!('ABC123');
    });

    expect(mockTrackEvent).toHaveBeenCalledWith('registration_completed', { method: 'google' });
  });

  it('useAuth lança erro quando usado fora do AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
