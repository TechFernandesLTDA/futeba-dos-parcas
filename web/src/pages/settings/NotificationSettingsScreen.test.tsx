import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSetPreference = vi.fn();
const mockSetMuteUntil = vi.fn();
const mockClearMute = vi.fn();

vi.mock('../../hooks/useNotificationSettings', () => ({
  useNotificationSettings: () => ({
    settings: {
      pushEnabled: true,
      gameReminders: true,
      gameInvites: true,
      groupInvites: true,
      achievements: true,
      mvpVotes: true,
      levelUp: true,
      systemAnnouncements: true,
      reminderTime: 30,
      muteUntil: null,
    },
    loading: false,
    error: null,
    setPreference: mockSetPreference,
    setMuteUntil: mockSetMuteUntil,
    clearMute: mockClearMute,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }),
}));

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'settings.notifications.pushTitle': 'Notificações Push',
        'settings.notifications.gameInvites': 'Convites de jogo',
        'settings.notifications.gameInvitesDescription': 'Receber convites',
        'settings.notifications.gameRemindersDescription': 'Lembretes de jogo',
        'settings.notifications.groupsTitle': 'Grupos',
        'settings.notifications.achievementsTitle': 'Conquistas',
        'settings.notifications.systemTitle': 'Sistema',
        'settings.notifications.reminderTitle': 'Lembrete',
        'settings.notifications.muteTitle': 'Silenciar',
        'settings.notifications.muteFor': 'Silenciar por {period}',
        'common.back': 'Voltar',
        'common.retry': 'Tentar novamente',
      };
      return map[key] || key;
    },
  }),
}));

import { NotificationSettingsScreen } from './NotificationSettingsScreen';

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

describe('NotificationSettingsScreen', () => {
  it('renderiza título', () => {
    renderWithTheme(<NotificationSettingsScreen />);
    expect(screen.getByText('Notificações')).toBeInTheDocument();
  });

  it('renderiza switches de notificação', () => {
    renderWithTheme(<NotificationSettingsScreen />);
    const switches = screen.getAllByRole('checkbox');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('toggle pushEnabled chama setPreference', async () => {
    const user = userEvent.setup();
    renderWithTheme(<NotificationSettingsScreen />);

    const pushSwitch = screen.getAllByRole('checkbox')[0];
    await user.click(pushSwitch);

    expect(mockSetPreference).toHaveBeenCalled();
  });

  it('mostra botão de voltar', () => {
    renderWithTheme(<NotificationSettingsScreen />);
    const backButtons = screen.getAllByLabelText('Voltar');
    expect(backButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza opções de mute', () => {
    renderWithTheme(<NotificationSettingsScreen />);
    expect(screen.getByText('1 hora')).toBeInTheDocument();
    expect(screen.getByText('24 horas')).toBeInTheDocument();
  });

  it('mostra botões de mute com labels corretos', () => {
    renderWithTheme(<NotificationSettingsScreen />);
    expect(screen.getByText('1 hora')).toBeInTheDocument();
    expect(screen.getByText('4 horas')).toBeInTheDocument();
    expect(screen.getByText('8 horas')).toBeInTheDocument();
  });
});
