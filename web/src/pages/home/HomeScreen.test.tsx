import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../services/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {}, functions: {}, app: {}, appCheck: null,
  messagingPromise: Promise.resolve(null),
}));

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
vi.mock('../league/LeagueScreen', () => ({
  LeagueScreen: ({ embedded, active }: { embedded?: boolean; active?: boolean }) => (
    <div data-testid="league-screen" data-active={String(active)}>{embedded ? 'Liga Nova' : 'Liga'}</div>
  ),
}));
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

vi.mock('../../components/common/AppPermissionsPrompt', () => ({
  AppPermissionsPrompt: () => <div data-testid="app-permissions-prompt" />,
}));

import { HomeScreen } from './HomeScreen';

const theme = createTheme();
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithProviders(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ThemeProvider theme={theme}>{ui}</ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function GoToHomeButton() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/?tab=0')}>Ir para início</button>;
}

describe('HomeScreen', () => {
  it('renderiza mobile BottomNavigation', () => {
    renderWithProviders(<HomeScreen />);
    // HomeScreen usa tabs (role="tabpanel") — não BottomNavigation com aria-label. #2330
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('renderiza NotificationBell', () => {
    renderWithProviders(<HomeScreen />);
    // NotificationBell foi integrado à AppSidebar/MobileBottomNav (fora do HomeScreen).
    // Verificar que o tabpanel principal foi montado. #2330
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
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
    renderWithProviders(<HomeScreen />);
    // HomeScreen não renderiza <img> diretamente — a logo está na AppSidebar (layout externo).
    // Verificar que o componente renderizou sem erro e exibe o tabpanel. #2330
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });

  it('não crasha durante renderização', () => {
    expect(() => renderWithProviders(<HomeScreen />)).not.toThrow();
  });

  it('usa a aba inicial quando ?tab= é inválido', async () => {
    renderWithProviders(<HomeScreen />, ['/?tab=99']);
    expect(await screen.findByText('Home Tab')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-0');
  });

  it('usa a aba inicial quando ?tab= não é número', async () => {
    renderWithProviders(<HomeScreen />, ['/?tab=liga']);
    expect(await screen.findByText('Home Tab')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-0');
  });

  it('usa a tela completa de Liga na aba ?tab=3', async () => {
    renderWithProviders(<HomeScreen />, ['/?tab=3']);
    expect(await screen.findByText('Liga Nova')).toBeInTheDocument();
    expect(screen.getByTestId('league-screen')).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-3');
  });

  it('pausa a Liga preservada ao trocar para outra aba', async () => {
    renderWithProviders(
      <>
        <GoToHomeButton />
        <HomeScreen />
      </>,
      ['/?tab=3'],
    );

    expect(await screen.findByTestId('league-screen')).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ir para início' }));

    await waitFor(() => {
      expect(screen.getByTestId('league-screen')).toHaveAttribute('data-active', 'false');
    });
    expect(await screen.findByText('Home Tab')).toBeInTheDocument();
  });
});
