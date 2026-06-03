import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock Firebase modules
const mockOnAuthStateChanged = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignOut = vi.fn();
const mockSendPasswordResetEmail = vi.fn();
const mockUpdateProfile = vi.fn();

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
  signOut: (...args: any[]) => mockSignOut(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  GoogleAuthProvider: vi.fn(),
}));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: (...args: any[]) => mockDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDoc: (...args: any[]) => mockGetDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDoc: (...args: any[]) => mockSetDoc(...args),
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

// Mock de cloudFunctions para isolar o teste do Cloud Functions real
vi.mock('../services/cloudFunctions', () => ({
  syncFieldOwnerClaim: vi.fn().mockResolvedValue({ data: { synced: false, role: '', success: true, message: '' } }),
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
      <span data-testid="firebase-user">{firebaseUser?.uid || 'null'}</span>
      <span data-testid="error">{error || 'null'}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Padrão: onAuthStateChanged retorna unsubscribe e não dispara
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      // Simular que não há usuário logado
      setTimeout(() => callback(null), 0);
      return vi.fn(); // unsubscribe
    });
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

    await waitFor(() => expect(logoutFn).toBeDefined());

    await act(async () => {
      await logoutFn!();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signUp cria conta e documento do usuário', async () => {
    const mockResult = { user: { uid: 'new-uid', email: 'new@test.com' } };
    mockCreateUserWithEmailAndPassword.mockResolvedValue(mockResult);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    let signUpFn: ((email: string, password: string, name: string) => Promise<void>) | undefined;
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
      await signUpFn!('new@test.com', 'password123', 'Novo Jogador');
    });

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'new@test.com',
      'password123'
    );
    expect(mockUpdateProfile).toHaveBeenCalled();
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
    mockGetDoc.mockResolvedValue({ exists: () => false });
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
  });

  it('useAuth lança erro quando usado fora do AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<AuthConsumer />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
