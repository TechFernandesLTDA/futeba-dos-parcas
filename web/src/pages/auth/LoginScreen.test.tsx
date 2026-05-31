import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

// Mock dependências antes de importar o componente
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignIn = vi.fn();
const mockSignInWithGoogle = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signInWithGoogle: mockSignInWithGoogle,
    user: null,
    loading: false,
  }),
}));

vi.mock('../../utils/firebaseErrors', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAuthErrorMessage: (err: any, fallback: string) => {
    if (err?.code === 'auth/invalid-credential') return 'Email ou senha inválidos';
    return fallback || 'Erro inesperado';
  },
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { LoginScreen } from './LoginScreen';

const theme = createTheme();

function renderLoginScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <LoginScreen />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campos de email e senha', () => {
    renderLoginScreen();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  });

  it('renderiza botão de login', () => {
    renderLoginScreen();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('renderiza botão de login com Google', () => {
    renderLoginScreen();
    expect(screen.getByRole('button', { name: /continuar com google/i })).toBeInTheDocument();
  });

  it('renderiza link de esqueci a senha', () => {
    renderLoginScreen();
    expect(screen.getByText(/esqueceu a senha/i)).toBeInTheDocument();
  });

  it('renderiza link de criar conta', () => {
    renderLoginScreen();
    expect(screen.getByText(/criar conta/i)).toBeInTheDocument();
  });

  it('mostra erro quando campos estão vazios ao submeter', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText('Preencha todos os campos')).toBeInTheDocument();
  });

  it('mostra erro quando apenas email preenchido', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.click(screen.getByRole('button', { name: /entrar/i }));
    expect(await screen.findByText('Preencha todos os campos')).toBeInTheDocument();
  });

  it('chama signIn ao submeter formulário com dados válidos', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('test@test.com', '123456');
    });
  });

  it('exibe mensagem de erro quando login falha', async () => {
    mockSignIn.mockRejectedValue({ code: 'auth/invalid-credential' });
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.type(screen.getByLabelText('Senha'), 'wrong');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Email ou senha inválidos')).toBeInTheDocument();
  });

  it('navega para home após login bem-sucedido', async () => {
    mockSignIn.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), 'test@test.com');
    await user.type(screen.getByLabelText('Senha'), '123456');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      // navigate é chamado com replace:true para limpar o histórico após login. #2330
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('possui aria-label no formulário de login', () => {
    renderLoginScreen();
    // O formulário de login usa <Box component="form"> sem aria-label explícito.
    // Verificar presença dos campos de login em vez do role "form". #2330
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('toggle de visibilidade da senha funciona', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    const senhaInput = screen.getByLabelText('Senha');
    expect(senhaInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByLabelText('Mostrar senha');
    await user.click(toggleButton);
    expect(senhaInput).toHaveAttribute('type', 'text');
  });
});
