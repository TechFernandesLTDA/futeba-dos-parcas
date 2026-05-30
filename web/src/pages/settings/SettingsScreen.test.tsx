/* eslint-disable @typescript-eslint/no-explicit-any */
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

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-id', name: 'Jogador Teste', email: 'test@test.com' },
    loading: false,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
  }),
}));

const mockGetDoc = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(),
  limit: vi.fn((...args) => args[0]),
}));

const mockSignOut = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase/auth', () => ({
  signOut: (...args: any[]) => mockSignOut(...args),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
  auth: {},
  functions: {},
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../utils/firestoreHelpers', () => ({
  snakeToCamel: (obj: any) => obj,
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { SettingsScreen } from './SettingsScreen';

const theme = createTheme();

function renderSettingsScreen() {
  // Mock getDoc para retornar configurações
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({
      notifications: true,
      emailNotifications: true,
      gameReminders: true,
      streakAlerts: true,
    }),
  });

  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza título "Configurações"', async () => {
    renderSettingsScreen();
    await waitFor(() => {
      expect(screen.getByText('Configurações')).toBeInTheDocument();
    });
  });

  it('exibe opções de notificações', async () => {
    renderSettingsScreen();
    await waitFor(() => {
      expect(screen.getByText('Notificações Push')).toBeInTheDocument();
    });
    expect(screen.getByText('Notificações por Email')).toBeInTheDocument();
    expect(screen.getByText('Lembretes de Jogos')).toBeInTheDocument();
  });

  it('exibe link para Tema', async () => {
    renderSettingsScreen();
    await waitFor(() => {
      expect(screen.getByText('Tema')).toBeInTheDocument();
    });
  });

  it('exibe link para Sobre o App', async () => {
    renderSettingsScreen();
    await waitFor(() => {
      expect(screen.getByText('Sobre o App')).toBeInTheDocument();
    });
  });

  it('exibe botão de sair', async () => {
    renderSettingsScreen();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
    });
  });

  it('abre dialog de confirmação e chama signOut ao clicar em Sair', async () => {
    const user = userEvent.setup();
    renderSettingsScreen();

    // Esperar loading completar
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
    });

    // Clicar no botão Sair
    await user.click(screen.getByRole('button', { name: /sair/i }));

    // Dialog de confirmação deve aparecer
    expect(await screen.findByText('Sair da conta?')).toBeInTheDocument();

    // Confirmar logout
    const confirmButtons = screen.getAllByRole('button', { name: /sair/i });
    const confirmButton = confirmButtons.find(
      (btn) => btn.closest('[role="dialog"]') !== null
    );
    if (confirmButton) {
      await user.click(confirmButton);
    }

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
