import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSetMode = vi.fn();

vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', setMode: mockSetMode, toggleTheme: vi.fn() }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../contexts', () => ({
  useLanguage: () => ({ language: 'pt-BR', setLanguage: vi.fn() }),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  syncLanguageToFirestore: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'settings.theme.title': 'Aparência',
        'settings.theme.darkDesc': 'Modo escuro',
        'settings.theme.lightDesc': 'Modo claro',
        'settings.theme.systemDesc': 'Automático',
        'settings.theme.selection': 'Seleção de tema',
        'theme.light': 'Claro',
        'theme.dark': 'Escuro',
        'theme.system': 'Sistema',
        'settings.theme.pushNotifications': 'Notificações',
        'settings.theme.pushNotificationsDesc': 'Ativar notificações push',
        'settings.theme.emailNotifications': 'Notificações por email',
        'settings.theme.emailNotificationsDesc': 'Receber emails',
        'settings.language': 'Idioma',
        'settings.languageDesc': 'Selecione o idioma',
        'settings.theme.clearCache': 'Limpar cache',
        'settings.theme.clearCacheDesc': 'Remove dados locais',
        'settings.theme.syncData': 'Sincronizar dados',
        'settings.theme.syncDataDesc': 'Força atualização',
        'settings.theme.clearCacheSuccess': 'Cache limpo',
        'settings.theme.clearCacheError': 'Erro ao limpar',
        'settings.theme.syncDataSuccess': 'Dados sincronizados',
        'common.back': 'Voltar',
        'common.appearance': 'Aparência',
        'common.portuguese': 'Português',
        'common.english': 'Inglês',
        'common.spanish': 'Espanhol',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

import { ThemeSettingsScreen } from './ThemeSettingsScreen';

const theme = createTheme();
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>{ui}</MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('ThemeSettingsScreen', () => {
  it('renderiza título da tela', () => {
    renderWithTheme(<ThemeSettingsScreen />);
    expect(screen.getAllByText('Aparência').length).toBeGreaterThanOrEqual(1);
  });

  it('mostra opções de tema', () => {
    renderWithTheme(<ThemeSettingsScreen />);
    expect(screen.getByText('Claro')).toBeInTheDocument();
    expect(screen.getByText('Escuro')).toBeInTheDocument();
    expect(screen.getByText('Sistema')).toBeInTheDocument();
  });

  it('selecionar tema chama setMode', async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeSettingsScreen />);

    await user.click(screen.getByText('Escuro'));

    expect(mockSetMode).toHaveBeenCalledWith('dark');
  });

  it('mostra switches de notificação', () => {
    renderWithTheme(<ThemeSettingsScreen />);
    const switches = screen.getAllByRole('checkbox');
    expect(switches.length).toBeGreaterThanOrEqual(2);
  });

  it('mostra opções de idioma', () => {
    renderWithTheme(<ThemeSettingsScreen />);
    expect(screen.getByText('Português')).toBeInTheDocument();
    expect(screen.getByText('Inglês')).toBeInTheDocument();
    expect(screen.getByText('Espanhol')).toBeInTheDocument();
  });

  it('renderiza botão de voltar', () => {
    renderWithTheme(<ThemeSettingsScreen />);
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });
});
