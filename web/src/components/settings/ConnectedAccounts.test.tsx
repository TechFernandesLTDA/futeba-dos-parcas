/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { ConnectedAccounts } from './ConnectedAccounts';

const mockLinkGoogle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockUnlinkGoogle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());

// Holder mutável: controla o providerData do firebaseUser por teste.
const authState = vi.hoisted(() => ({
  providers: [] as Array<{ providerId: string; email?: string; phoneNumber?: string }>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'pt-BR' } }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { providerData: authState.providers },
    linkGoogleAccount: (...args: any[]) => mockLinkGoogle(...args),
    unlinkGoogleAccount: (...args: any[]) => mockUnlinkGoogle(...args),
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../../utils/firebaseErrors', () => ({
  getAuthErrorMessage: (_err: unknown, fallback?: string) => fallback ?? 'error',
}));

const theme = createTheme();

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <ConnectedAccounts />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('ConnectedAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkGoogle.mockResolvedValue(undefined);
    mockUnlinkGoogle.mockResolvedValue(undefined);
    authState.providers = [];
  });

  it('renderiza título e subtítulo', () => {
    renderWithProviders();
    expect(screen.getByText('settings.connectedAccounts.title')).toBeInTheDocument();
    expect(screen.getByText('settings.connectedAccounts.subtitle')).toBeInTheDocument();
  });

  it('mostra botão de vincular Google quando não há Google vinculado', () => {
    authState.providers = [{ providerId: 'password', email: 'u@t.com' }];
    renderWithProviders();
    expect(screen.getByRole('button', { name: 'settings.connectedAccounts.linkGoogle' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /unlinkGoogle/i })).not.toBeInTheDocument();
  });

  it('não confunde um providerId parecido com o provedor Google oficial', () => {
    authState.providers = [
      { providerId: 'password', email: 'u@t.com' },
      { providerId: 'google.com.attacker.example', email: 'u@t.com' },
    ];
    renderWithProviders();

    expect(screen.getByRole('button', { name: 'settings.connectedAccounts.linkGoogle' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /unlinkGoogle/i })).not.toBeInTheDocument();
  });

  it('chama linkGoogleAccount ao clicar em vincular e mostra toast de sucesso', async () => {
    const user = userEvent.setup();
    authState.providers = [{ providerId: 'password', email: 'u@t.com' }];
    renderWithProviders();
    await user.click(screen.getByRole('button', { name: 'settings.connectedAccounts.linkGoogle' }));
    await waitFor(() => expect(mockLinkGoogle).toHaveBeenCalledTimes(1));
    expect(mockShowSuccess).toHaveBeenCalledWith('settings.connectedAccounts.linkSuccess');
  });

  it('mostra erro quando linkGoogleAccount falha', async () => {
    const user = userEvent.setup();
    mockLinkGoogle.mockRejectedValueOnce(new Error('auth/credential-already-in-use'));
    authState.providers = [{ providerId: 'password', email: 'u@t.com' }];
    renderWithProviders();
    await user.click(screen.getByRole('button', { name: 'settings.connectedAccounts.linkGoogle' }));
    await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
  });

  it('mostra botão de desvincular Google habilitado quando há senha + Google', () => {
    authState.providers = [
      { providerId: 'password', email: 'u@t.com' },
      { providerId: 'google.com', email: 'u@t.com' },
    ];
    renderWithProviders();
    expect(screen.getByRole('button', { name: /unlinkGoogle/i })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'settings.connectedAccounts.linkGoogle' })).not.toBeInTheDocument();
  });

  it('desabilita desvincular Google quando não há senha (guard de método primário)', () => {
    authState.providers = [{ providerId: 'google.com', email: 'u@t.com' }];
    renderWithProviders();
    expect(screen.getByRole('button', { name: /unlinkGoogle/i })).toBeDisabled();
    expect(screen.getByText('settings.connectedAccounts.cannotUnlinkWithoutPrimary')).toBeInTheDocument();
  });

  it('abre dialog de confirmação e chama unlinkGoogleAccount ao confirmar', async () => {
    const user = userEvent.setup();
    authState.providers = [
      { providerId: 'password', email: 'u@t.com' },
      { providerId: 'google.com', email: 'u@t.com' },
    ];
    renderWithProviders();
    // Botão na lista (card)
    await user.click(screen.getByRole('button', { name: /unlinkGoogle/i }));
    expect(await screen.findByText('settings.connectedAccounts.unlinkConfirmTitle')).toBeInTheDocument();
    // Dialog aberto: há agora 2 botões "unlinkGoogle" — clicar o do dialog (último)
    const unlinkButtons = screen.getAllByRole('button', { name: /unlinkGoogle/i });
    await user.click(unlinkButtons[unlinkButtons.length - 1]);
    await waitFor(() => expect(mockUnlinkGoogle).toHaveBeenCalledTimes(1));
    expect(mockShowSuccess).toHaveBeenCalledWith('settings.connectedAccounts.unlinkSuccess');
  });

  it('mostra erro quando unlinkGoogleAccount falha com código genérico', async () => {
    const user = userEvent.setup();
    mockUnlinkGoogle.mockRejectedValueOnce(new Error('auth/requires-recent-login'));
    authState.providers = [
      { providerId: 'password', email: 'u@t.com' },
      { providerId: 'google.com', email: 'u@t.com' },
    ];
    renderWithProviders();
    await user.click(screen.getByRole('button', { name: /unlinkGoogle/i }));
    const unlinkButtons = await screen.findAllByRole('button', { name: /unlinkGoogle/i });
    await user.click(unlinkButtons[unlinkButtons.length - 1]);
    await waitFor(() => expect(mockShowError).toHaveBeenCalledTimes(1));
  });
});
