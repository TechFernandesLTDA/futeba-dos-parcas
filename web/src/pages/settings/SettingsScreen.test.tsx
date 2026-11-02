/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockLogout = vi.hoisted(() => vi.fn());
const mockShowSuccess = vi.hoisted(() => vi.fn());
const mockShowError = vi.hoisted(() => vi.fn());
const mockDeleteAccount = vi.hoisted(() => vi.fn());
const mockExportMyData = vi.hoisted(() => vi.fn());
const mockShowWarning = vi.hoisted(() => vi.fn());
const mockQueryClientClear = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Usuário estável entre renders, como no AuthContext real: um objeto novo a
// cada render reabre o efeito [user] e faz o getDoc rodar em laço.
const mockUser = vi.hoisted(() => ({ id: 'test-id', name: 'Jogador Teste', email: 'test@test.com' }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    logout: mockLogout,
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: mockShowWarning,
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
  EmailAuthProvider: { credential: vi.fn() },
  reauthenticateWithCredential: vi.fn(),
  reauthenticateWithPopup: vi.fn(),
}));

vi.mock('../../services/cloudFunctions', () => ({
  deleteAccount: mockDeleteAccount,
  exportMyData: mockExportMyData,
}));

vi.mock('firebase/functions', () => ({
  getFunctions: vi.fn(() => ({})),
  connectFunctionsEmulator: vi.fn(),
  httpsCallable: vi.fn(() => vi.fn()),
}));

vi.mock('../../services/firebase', () => ({
  app: {},
  db: {},
  auth: {},
  googleProvider: {},
}));

vi.mock('../../services/queryClient', () => ({
  queryClient: { clear: mockQueryClientClear },
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

vi.mock('../../contexts/TeamsContext', () => ({
  useTeams: () => ({ teams: [], teamsById: new Map(), loading: false, error: null }),
  TeamsProvider: ({ children }: { children: React.ReactNode }) => children,
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
    mockDeleteAccount.mockResolvedValue({ data: { success: true } });
    mockLogout.mockResolvedValue(undefined);
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
    // i18n key: settings.gameReminders = 'Lembretes de Jogo' (singular). #2330
    expect(screen.getByText('Lembretes de Jogo')).toBeInTheDocument();
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

  describe('Baixar meus dados (#4482)', () => {
    beforeEach(() => {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(() => 'blob:export'),
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
      // O jsdom tenta navegar para a URL blob: ao clicar no <a download>; o
      // download em si é coberto em useExportMyData.test.ts
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    });

    it('exibe o botão com a descrição associada', async () => {
      renderSettingsScreen();
      const button = await screen.findByRole('button', { name: 'Baixar meus dados' });
      expect(button).toHaveAttribute('aria-describedby', 'export-my-data-desc');
      expect(document.getElementById('export-my-data-desc')).toHaveTextContent(
        /arquivo JSON/,
      );
    });

    it('baixa o arquivo e mostra toast de sucesso', async () => {
      mockExportMyData.mockResolvedValue({ data: { complete: true, data: {} } });
      renderSettingsScreen();
      fireEvent.click(await screen.findByRole('button', { name: 'Baixar meus dados' }));
      await waitFor(() => {
        expect(mockShowSuccess).toHaveBeenCalledWith('Arquivo com seus dados baixado.');
      });
      expect(mockExportMyData).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    });

    it('mostra o estado de carregamento enquanto a exportação roda', async () => {
      let resolveExport: (value: unknown) => void = () => undefined;
      mockExportMyData.mockReturnValue(
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
      );
      renderSettingsScreen();
      fireEvent.click(await screen.findByRole('button', { name: 'Baixar meus dados' }));
      const busy = await screen.findByRole('button', { name: 'Gerando arquivo...' });
      expect(busy).toBeDisabled();
      expect(busy).toHaveAttribute('aria-busy', 'true');
      resolveExport({ data: { complete: true, data: {} } });
      await screen.findByRole('button', { name: 'Baixar meus dados' });
    });

    it('mostra alerta e toast de erro quando o limite diário estoura', async () => {
      mockExportMyData.mockRejectedValue({ code: 'functions/resource-exhausted' });
      renderSettingsScreen();
      fireEvent.click(await screen.findByRole('button', { name: 'Baixar meus dados' }));
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('limite de 3 exportações por dia');
      expect(mockShowError).toHaveBeenCalledWith(
        'Você atingiu o limite de 3 exportações por dia. Tente de novo amanhã.',
      );
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  // NOTA: botão "Sair" foi removido do SettingsScreen — logout só ocorre após
  // exclusão de conta (fluxo LGPD). Testes antigos de logout removidos. #2330

});
