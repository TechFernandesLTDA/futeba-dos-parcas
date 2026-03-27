import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
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
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  signInWithPopup: (...args: any[]) => mockSignInWithPopup(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordResetEmail(...args),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  GoogleAuthProvider: vi.fn(),
}));

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
}));

vi.mock('../services/firebase', () => ({
  auth: { currentUser: null },
  googleProvider: {},
  db: {},
}));

vi.mock('../utils/firestoreHelpers', () => ({
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

// Helper para simular onAuthStateChanged
function triggerAuthStateChange(user: any) {
  const callback = mockOnAuthStateChanged.mock.calls[0]?.[1];
  if (callback) {
    act(() => {
      callback(user);
    });
  }
}

// Componente auxiliar para acessar o contexto
function AuthConsumer() {
  const { user, firebaseUser, loading, error, signIn, signUp, logout, signInWithGoogle } = useAuth();
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
    let signInFn: any;
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
      await signInFn('test@test.com', '123456');
    });

    expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@test.com',
      '123456'
    );
  });

  it('signOut chama Firebase signOut', async () => {
    mockSignOut.mockResolvedValue(undefined);

    let logoutFn: any;
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
      await logoutFn();
    });

    expect(mockSignOut).toHaveBeenCalled();
  });

  it('signUp cria conta e documento do usuário', async () => {
    const mockResult = { user: { uid: 'new-uid', email: 'new@test.com' } };
    mockCreateUserWithEmailAndPassword.mockResolvedValue(mockResult);
    mockUpdateProfile.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    let signUpFn: any;
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
      await signUpFn('new@test.com', 'password123', 'Novo Jogador');
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

    let signInFn: any;
    let getError: any;
    function Extractor() {
      const auth = useAuth();
      signInFn = auth.signIn;
      getError = () => auth.error;
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
        await signInFn('test@test.com', 'wrong');
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

    let signInWithGoogleFn: any;
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
      await signInWithGoogleFn();
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

  it('resetPassword envia email de recuperação de senha', async () => {
    mockSendPasswordResetEmail.mockResolvedValue(undefined);

    let resetPasswordFn: any;
    function Extractor() {
      const auth = useAuth();
      resetPasswordFn = auth.resetPassword;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(resetPasswordFn).toBeDefined());

    await act(async () => {
      await resetPasswordFn('recover@test.com');
    });

    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.anything(),
      'recover@test.com'
    );
  });

  it('resetPassword trata erros definindo error state', async () => {
    mockSendPasswordResetEmail.mockRejectedValue({
      code: 'auth/user-not-found',
      message: 'User not found',
    });

    let resetPasswordFn: any;
    function Extractor() {
      const auth = useAuth();
      resetPasswordFn = auth.resetPassword;
      return <span data-testid="reset-err">{auth.error || 'none'}</span>;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(resetPasswordFn).toBeDefined());

    await act(async () => {
      try {
        await resetPasswordFn('nonexistent@test.com');
      } catch {
        // Esperado
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('reset-err').textContent).not.toBe('none');
    });
  });

  it('updateUserProfile atualiza displayName e photoURL', async () => {
    const mockFirebaseUser = { uid: 'profile-uid', email: 'profile@test.com', displayName: 'Old Name' };

    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'profile-uid',
      data: () => ({ name: 'Old Name', email: 'profile@test.com' }),
    });

    mockUpdateProfile.mockResolvedValue(undefined);

    let updateUserProfileFn: any;
    function Extractor() {
      const auth = useAuth();
      updateUserProfileFn = auth.updateUserProfile;
      return null;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    await waitFor(() => expect(updateUserProfileFn).toBeDefined());

    // Aguardar o auth state change carregar o firebaseUser
    await waitFor(() => expect(mockGetDoc).toHaveBeenCalled());

    await act(async () => {
      await updateUserProfileFn({ displayName: 'New Name', photoURL: 'https://photo.url/new.jpg' });
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith(
      mockFirebaseUser,
      { displayName: 'New Name', photoURL: 'https://photo.url/new.jpg' }
    );
  });

  it('refreshUser recarrega dados do usuário do Firestore', async () => {
    const mockFirebaseUser = { uid: 'refresh-uid', email: 'refresh@test.com' };

    mockOnAuthStateChanged.mockImplementation((_auth: any, callback: any) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'refresh-uid',
      data: () => ({ name: 'Original Name', email: 'refresh@test.com' }),
    });

    let refreshUserFn: any;
    function Extractor() {
      const auth = useAuth();
      refreshUserFn = auth.refreshUser;
      return <span data-testid="refresh-user">{auth.user?.name || 'null'}</span>;
    }

    render(
      <AuthProvider>
        <Extractor />
      </AuthProvider>
    );

    // Aguardar carregamento inicial
    await waitFor(() => {
      expect(screen.getByTestId('refresh-user').textContent).toBe('Original Name');
    });

    // Atualizar o mock para retornar dados diferentes
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'refresh-uid',
      data: () => ({ name: 'Updated Name', email: 'refresh@test.com' }),
    });

    await act(async () => {
      await refreshUserFn();
    });

    await waitFor(() => {
      expect(screen.getByTestId('refresh-user').textContent).toBe('Updated Name');
    });
  });
});
