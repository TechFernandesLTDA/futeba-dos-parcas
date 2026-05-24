import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockResetPassword = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'auth.forgotPasswordTitle': 'Recuperar Senha',
        'auth.forgotPasswordSubtitle': 'Enviaremos um link para seu email',
        'auth.forgotPasswordEmailLabel': 'Email',
        'auth.forgotPasswordSendLink': 'Enviar Link',
        'auth.forgotPasswordFillEmail': 'Preencha seu email',
        'auth.forgotPasswordInvalidEmail': 'Email inválido',
        'auth.forgotPasswordEmailSent': 'Email enviado com sucesso',
        'auth.forgotPasswordBackToLogin': 'Voltar ao login',
        'auth.forgotPasswordRememberPassword': 'Lembrou sua senha?',
        'auth.forgotPasswordSignIn': 'Fazer login',
        'auth.forgotPasswordFormAriaLabel': 'Formulário de recuperação de senha',
        'auth.forgotPasswordBackAriaLabel': 'Voltar',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ resetPassword: mockResetPassword }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { ForgotPasswordScreen } from './ForgotPasswordScreen';

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>
  );
}

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    mockResetPassword.mockReset();
    mockNavigate.mockReset();
  });

  it('renderiza o título da página', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByText('Recuperar Senha')).toBeInTheDocument();
  });

  it('renderiza o subtítulo', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByText('Enviaremos um link para seu email')).toBeInTheDocument();
  });

  it('renderiza campo de email', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renderiza botão de enviar', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByText('Enviar Link')).toBeInTheDocument();
  });

  it('chama resetPassword com email válido', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue(undefined);
    renderWithProviders(<ForgotPasswordScreen />);
    await user.type(screen.getByLabelText('Email'), 'teste@email.com');
    await user.click(screen.getByText('Enviar Link'));
    expect(mockResetPassword).toHaveBeenCalledWith('teste@email.com');
  });

  it('mostra sucesso após enviar email', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue(undefined);
    renderWithProviders(<ForgotPasswordScreen />);
    await user.type(screen.getByLabelText('Email'), 'teste@email.com');
    await user.click(screen.getByText('Enviar Link'));
    expect(await screen.findByText('Email enviado com sucesso')).toBeInTheDocument();
  });

  it('mostra botão Voltar ao login após sucesso', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue(undefined);
    renderWithProviders(<ForgotPasswordScreen />);
    await user.type(screen.getByLabelText('Email'), 'teste@email.com');
    await user.click(screen.getByText('Enviar Link'));
    expect(await screen.findByText('Voltar ao login')).toBeInTheDocument();
  });

  it('Voltar ao login navega para /login após sucesso', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue(undefined);
    renderWithProviders(<ForgotPasswordScreen />);
    await user.type(screen.getByLabelText('Email'), 'teste@email.com');
    await user.click(screen.getByText('Enviar Link'));
    await screen.findByText('Voltar ao login');
    await user.click(screen.getByText('Voltar ao login'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('mostra link de voltar ao login no rodapé', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByText('Fazer login')).toBeInTheDocument();
  });

  it('mostra texto Lembrou sua senha?', () => {
    renderWithProviders(<ForgotPasswordScreen />);
    expect(screen.getByText('Lembrou sua senha?')).toBeInTheDocument();
  });

  it('esconde formulário após sucesso', async () => {
    const user = userEvent.setup();
    mockResetPassword.mockResolvedValue(undefined);
    renderWithProviders(<ForgotPasswordScreen />);
    await user.type(screen.getByLabelText('Email'), 'teste@email.com');
    await user.click(screen.getByText('Enviar Link'));
    expect(await screen.findByText('Email enviado com sucesso')).toBeInTheDocument();
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
  });
});
