import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignUp = vi.fn();
const mockSignInWithGoogle = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    signInWithGoogle: mockSignInWithGoogle,
    user: null,
    loading: false,
  }),
}));

vi.mock('../../utils/firebaseErrors', () => ({
  getAuthErrorMessage: (err: any, fallback: string) => {
    if (err?.code === 'auth/email-already-in-use') return 'Este email já está em uso';
    return fallback || 'Erro inesperado';
  },
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { RegisterScreen } from './RegisterScreen';

const theme = createTheme();

function renderRegisterScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <RegisterScreen />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('RegisterScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza campos de nome, email, senha e confirmação de senha', () => {
    renderRegisterScreen();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Dois campos de senha
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it('renderiza botão de criar conta', () => {
    renderRegisterScreen();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('mostra erro para nome vazio', async () => {
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText('Digite seu nome')).toBeInTheDocument();
  });

  it('mostra erro para nome curto (< 3 caracteres)', async () => {
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'AB');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));
    expect(await screen.findByText('Nome deve ter pelo menos 3 caracteres')).toBeInTheDocument();
  });

  it('mostra erro para senhas diferentes', async () => {
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123456');
    await user.type(screen.getByLabelText(/confirmar senha/i), '654321');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('As senhas não coincidem')).toBeInTheDocument();
  });

  it('mostra erro para senha curta (< 6 caracteres)', async () => {
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123');
    await user.type(screen.getByLabelText(/confirmar senha/i), '123');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('Senha deve ter pelo menos 6 caracteres')).toBeInTheDocument();
  });

  it('chama signUp ao submeter com dados válidos', async () => {
    mockSignUp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123456');
    await user.type(screen.getByLabelText(/confirmar senha/i), '123456');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@test.com', '123456', 'Jogador Teste');
    });
  });

  it('exibe erro quando registro falha', async () => {
    mockSignUp.mockRejectedValue({ code: 'auth/email-already-in-use' });
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123456');
    await user.type(screen.getByLabelText(/confirmar senha/i), '123456');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('Este email já está em uso')).toBeInTheDocument();
  });

  it('navega após registro bem-sucedido', async () => {
    mockSignUp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123456');
    await user.type(screen.getByLabelText(/confirmar senha/i), '123456');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('possui aria-label no formulário de cadastro', () => {
    renderRegisterScreen();
    expect(screen.getByRole('form', { name: /formulário de cadastro/i })).toBeInTheDocument();
  });

  it('toggle de visibilidade da senha funciona', async () => {
    const user = userEvent.setup();
    renderRegisterScreen();

    const senhaInput = screen.getByLabelText(/^senha$/i);
    expect(senhaInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByLabelText(/mostrar senha/i);
    await user.click(toggleButton);
    expect(senhaInput).toHaveAttribute('type', 'text');
  });

  it('mostra erro para email vazio', async () => {
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(await screen.findByText('Digite seu email')).toBeInTheDocument();
  });

  it('desabilita botão e campos e exibe spinner durante o envio', async () => {
    let resolveSignUp: () => void;
    mockSignUp.mockImplementation(() => new Promise<void>((resolve) => {
      resolveSignUp = resolve;
    }));
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123456');
    await user.type(screen.getByLabelText(/confirmar senha/i), '123456');
    await user.click(screen.getByRole('button', { name: /criar conta/i }));

    // CircularProgress (spinner) deve estar presente durante o loading
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Campos devem estar desabilitados durante o loading
    expect(screen.getByLabelText(/nome completo/i)).toBeDisabled();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/^senha$/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeDisabled();

    // Resolver a promise para limpar o estado
    resolveSignUp!();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('submete formulário ao pressionar Enter no campo de confirmar senha', async () => {
    mockSignUp.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderRegisterScreen();

    await user.type(screen.getByLabelText(/nome completo/i), 'Jogador Teste');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/^senha$/i), '123456');
    await user.type(screen.getByLabelText(/confirmar senha/i), '123456');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@test.com', '123456', 'Jogador Teste');
    });
  });
});
