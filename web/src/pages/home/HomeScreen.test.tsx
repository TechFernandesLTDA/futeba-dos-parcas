import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 3 }),
}));

vi.mock('../../hooks/usePrefetchHome', () => ({
  usePrefetchHome: vi.fn(),
}));

vi.mock('../../hooks/usePerformanceMonitoring', () => ({
  usePerformanceMonitoring: () => ({ metrics: null }),
  PerformanceOverlay: () => null,
}));

vi.mock('../../hooks/useNotificationPermission', () => ({
  useNotificationPermission: () => ({ permission: 'denied', requestPermission: vi.fn() }),
}));

vi.mock('./tabs/HomeTab', () => ({ HomeTab: () => <div>Home Tab</div> }));
vi.mock('./tabs/GamesTab', () => ({ GamesTab: () => <div>Jogos</div> }));
vi.mock('./tabs/GroupsTab', () => ({ GroupsTab: () => <div>Grupos</div> }));
vi.mock('./tabs/RankingsTab', () => ({ RankingsTab: () => <div>Rankings</div> }));
vi.mock('./tabs/ProfileTab', () => ({ ProfileTab: () => <div>Perfil</div> }));
vi.mock('../../pages/ranking/NotificationsScreen', () => ({
  NotificationsScreen: () => <div>Notificações</div>,
}));

vi.mock('../../components/common/NotificationBell', () => ({
  NotificationBell: ({ unreadCount }: { unreadCount: number }) => (
    <div data-testid="notification-bell">{unreadCount}</div>
  ),
}));

vi.mock('../../components/whatsnew/WhatsNewPopupHost', () => ({
  WhatsNewPopupHost: () => null,
}));

import { HomeScreen } from './HomeScreen';

const theme = createTheme();
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('HomeScreen', () => {
  it('renderiza mobile BottomNavigation', () => {
    renderWithProviders(<HomeScreen />);
    const navs = screen.getAllByLabelText('Navegação principal');
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza NotificationBell', () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('não mostra banner de notificação quando permission denied', () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.queryByText(/Ative as notificações/)).not.toBeInTheDocument();
  });

  it('renderiza role="tabpanel" no conteúdo principal', () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('renderiza logo do app', () => {
    const { container } = renderWithProviders(<HomeScreen />);
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBeGreaterThanOrEqual(1);
  });

  it('não crasha durante renderização', () => {
    expect(() => renderWithProviders(<HomeScreen />)).not.toThrow();
  });
});
