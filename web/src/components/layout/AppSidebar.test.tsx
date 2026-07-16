import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockLocation = vi.hoisted(() => ({ pathname: '/', search: '?tab=0' }));
const mockNotifications = vi.hoisted(() => ({ unreadCount: 0 }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
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
        'profile.editProfile': 'Editar Perfil',
        'settings.defaultUserName': 'Usuário',
        'common.appName': 'Futeba',
        'a11y.mainNav': 'Navegação principal',
      };
      if (key === 'nav.notificationsAria') {
        return `Notificações (${options?.count ?? 0} não lidas)`;
      }
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
  useUnreadNotificationCount: () => ({ unreadCount: mockNotifications.unreadCount, loading: false, error: null }),
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
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocation.pathname = '/';
    mockLocation.search = '?tab=0';
    mockNotifications.unreadCount = 0;
  });

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

  it('abre a edição do perfil ao clicar no usuário do rodapé', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const editProfileButtons = screen.getAllByRole('button', { name: 'Jogador — Editar Perfil' });
    expect(editProfileButtons).toHaveLength(2);
    for (const button of editProfileButtons) await user.click(button);

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/profile/edit');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/profile/edit');
  });

  it('mantém Mais ativo para rotas secundárias no rail', () => {
    mockLocation.pathname = '/settings';
    mockLocation.search = '';
    renderWithTheme(<AppSidebar />);

    expect(screen.getByRole('button', { name: 'Mais' })).toHaveAttribute('aria-current', 'page');
  });

  it('expõe e fecha o menu Mais com semântica acessível', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const moreButton = screen.getByRole('button', { name: 'Mais' });
    expect(moreButton).toHaveAttribute('aria-haspopup', 'menu');
    expect(moreButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(moreButton);

    expect(moreButton).toHaveAttribute('aria-expanded', 'true');
    expect(moreButton).toHaveAttribute('aria-controls', 'app-sidebar-more-menu');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(6);

    await user.click(screen.getByRole('menuitem', { name: 'Configurações' }));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('mantém não lidas visíveis e anunciadas no tablet e desktop', async () => {
    mockNotifications.unreadCount = 3;
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const moreButton = screen.getByRole('button', { name: 'Mais' });
    expect(within(moreButton).getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notificações (3 não lidas)' })).toBeInTheDocument();

    await user.click(moreButton);
    expect(screen.getByRole('menuitem', { name: 'Notificações (3 não lidas)' })).toBeInTheDocument();
  });

  it('renderiza drawer expanded em desktop (lg+)', () => {
    renderWithTheme(<AppSidebar />);

    const logoElements = screen.getAllByTestId('app-logo');
    expect(logoElements.length).toBe(2);
  });
});
