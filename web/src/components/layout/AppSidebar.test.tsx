import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/', search: '?tab=0' }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'nav.home': 'Início',
        'nav.games': 'Jogos',
        'nav.groups': 'Grupos',
        'nav.league': 'Liga',
        'nav.notifications': 'Notificações',
        'nav.profile': 'Perfil',
        'nav.statistics': 'Estatísticas',
        'nav.badges': 'Conquistas',
        'nav.locations': 'Quadras',
        'nav.settings': 'Configurações',
        'nav.messages': 'Mensagens',
        'nav.sectionMore': 'Mais',
        'nav.sectionPrimary': 'Principal',
        'nav.search': 'Buscar',
        'common.appName': 'Futeba',
        'a11y.mainNav': 'Navegação principal',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Jogador', photoUrl: null },
  }),
}));

vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
  useUnreadNotificationCount: () => ({ unreadCount: 0, loading: false, error: null }),
}));

vi.mock('../common/AppLogo', () => ({
  AppLogo: ({ alt }: { alt: string }) => <div data-testid="app-logo">{alt}</div>,
}));

import { AppSidebar } from './AppSidebar';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('AppSidebar', () => {
  it('renderiza links de navegação', () => {
    renderWithTheme(<AppSidebar />);

    expect(screen.getAllByText('Início').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Jogos').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Grupos').length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza Liga e Perfil', () => {
    renderWithTheme(<AppSidebar />);

    expect(screen.getAllByText('Liga').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Perfil').length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza notificações', () => {
    renderWithTheme(<AppSidebar />);

    expect(screen.getAllByText('Notificações').length).toBeGreaterThanOrEqual(1);
  });

  it('tem aria-label na navegação', () => {
    renderWithTheme(<AppSidebar />);

    const navigations = screen.getAllByLabelText('Navegação principal');
    expect(navigations.length).toBeGreaterThanOrEqual(1);
  });

  it('navega ao clicar em item', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const jogosLinks = screen.getAllByText('Jogos');
    await user.click(jogosLinks[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/?tab=1');
  });

  it('logo é um link para a home', () => {
    renderWithTheme(<AppSidebar />);

    // #3733: logo agora é um <Link to="/"> real (não Box com onClick).
    const logos = screen.getAllByRole('link', { name: 'Início' });
    expect(logos.length).toBeGreaterThanOrEqual(1);
    expect(logos[0]).toHaveAttribute('href', '/');
  });

  it('renderiza drawer expanded em desktop (lg+)', () => {
    renderWithTheme(<AppSidebar />);

    const logoElements = screen.getAllByTestId('app-logo');
    expect(logoElements.length).toBe(2);
  });
});
