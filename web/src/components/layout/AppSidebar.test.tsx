import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
const mockLocation = vi.hoisted(() => ({ pathname: '/', search: '?tab=0' }));
const mockNotifications = vi.hoisted(() => ({ unreadCount: 0 }));
const mockAuth = vi.hoisted(() => ({ role: 'PLAYER' as 'PLAYER' | 'FIELD_OWNER' | 'ADMIN' }));
const mockTriggerHaptic = vi.hoisted(() => vi.fn());
const mockPrefetchFocus = vi.hoisted(() => vi.fn());

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
        'shortcuts.openLabel': 'Abrir atalhos de teclado',
        'shortcuts.searchKeyApple': '⌘K',
        'shortcuts.searchKeyDefault': 'Ctrl+K',
        'shortcuts.title': 'Atalhos de teclado',
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
    user: { id: 'user-1', name: 'Jogador', photoUrl: null, role: mockAuth.role },
  }),
}));

vi.mock('../../contexts/UnreadNotificationContext', () => ({
  useUnreadNotificationSummary: () => ({ unreadCount: mockNotifications.unreadCount, loading: false, error: null }),
}));

vi.mock('../../hooks/useResourcePreloading', () => ({
  usePrefetchOnHover: () => ({
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    onFocus: mockPrefetchFocus,
  }),
}));

vi.mock('../../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ trigger: mockTriggerHaptic }),
}));

vi.mock('../common/AppLogo', () => ({
  AppLogo: ({ alt, size, sx }: { alt: string; size: string; sx?: { width?: number; height?: number } }) => (
    <div
      data-testid="app-logo"
      data-size={size}
      data-width={sx?.width}
      data-height={sx?.height}
    >
      {alt}
    </div>
  ),
}));

import {
  appSidebarLayoutTokens,
  appSidebarStyles,
  getAppSidebarOverlayPlacement,
} from './AppSidebar.styles';
import { getSearchShortcutTranslationKey } from '../../utils/platformShortcut';
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
    mockAuth.role = 'PLAYER';
    mockTriggerHaptic.mockClear();
    mockPrefetchFocus.mockClear();
  });

  it('posiciona overlays no lado lógico correto em LTR e RTL', () => {
    expect(getAppSidebarOverlayPlacement('ltr')).toEqual({
      tooltipPlacement: 'right',
      menuAnchorHorizontal: 'right',
      menuTransformHorizontal: 'left',
    });
    expect(getAppSidebarOverlayPlacement('rtl')).toEqual({
      tooltipPlacement: 'left',
      menuAnchorHorizontal: 'left',
      menuTransformHorizontal: 'right',
    });
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
    expect(mockTriggerHaptic).toHaveBeenCalledWith('light');
  });

  it('expõe destinos de prefetch nas ações de navegação', () => {
    renderWithTheme(<AppSidebar />);

    const jogos = screen.getAllByRole('button', { name: 'Jogos' })[0];
    expect(jogos).toHaveAttribute('data-prefetch-route', '/?tab=1');
    jogos.focus();
    expect(mockPrefetchFocus).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['PLAYER', '/map/locations'],
    ['FIELD_OWNER', '/locations'],
    ['ADMIN', '/locations'],
  ] as const)('envia %s ao destino permitido de Quadras', async (role, expected) => {
    mockAuth.role = role;
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const locationsButtons = screen.getAllByRole('button', { name: 'Quadras' });
    await user.click(locationsButtons.at(-1)!);

    expect(mockNavigate).toHaveBeenCalledWith(expected);
  });

  it('usa o destino permitido no menu Mais do rail e fecha o menu', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    await user.click(screen.getByRole('button', { name: 'Mais' }));
    await user.click(screen.getByRole('menuitem', { name: 'Quadras' }));

    expect(mockNavigate).toHaveBeenCalledWith('/map/locations');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('seleciona a dica de busca adequada à plataforma', () => {
    expect(getSearchShortcutTranslationKey('MacIntel')).toBe('shortcuts.searchKeyApple');
    expect(getSearchShortcutTranslationKey('iPhone')).toBe('shortcuts.searchKeyApple');
    expect(getSearchShortcutTranslationKey('Win32')).toBe('shortcuts.searchKeyDefault');
    expect(getSearchShortcutTranslationKey('Linux x86_64')).toBe('shortcuts.searchKeyDefault');
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

  it('opera o menu Mais com setas, Home, End e Escape', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const moreButton = screen.getByRole('button', { name: 'Mais' });
    await user.click(moreButton);

    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(menuItems[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(menuItems.at(-1)).toHaveFocus();
    await user.keyboard('{Home}');
    expect(menuItems[0]).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(moreButton).toHaveFocus();
  });

  it('mantém não lidas visíveis e anunciadas em item próprio no tablet e desktop', async () => {
    mockNotifications.unreadCount = 3;
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const notificationButtons = screen.getAllByRole('button', { name: 'Notificações (3 não lidas)' });
    expect(notificationButtons).toHaveLength(2);
    expect(within(notificationButtons[0]).getByText('3')).toBeInTheDocument();

    const moreButton = screen.getByRole('button', { name: 'Mais' });
    expect(within(moreButton).queryByText('3')).not.toBeInTheDocument();
    await user.click(moreButton);
    expect(screen.queryByRole('menuitem', { name: /Notificações/ })).not.toBeInTheDocument();
  });

  it('navega diretamente pelas Notificações do rail e expõe o estado ativo', async () => {
    mockLocation.pathname = '/notifications';
    mockLocation.search = '';
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    const notificationButtons = screen.getAllByRole('button', { name: 'Notificações' });
    expect(notificationButtons[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Mais' })).not.toHaveAttribute('aria-current');

    await user.click(notificationButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('abre os atalhos pelo menu Mais e fecha o menu', async () => {
    const user = userEvent.setup();
    const shortcutsListener = vi.fn();
    window.addEventListener('open-shortcuts', shortcutsListener);
    renderWithTheme(<AppSidebar />);

    await user.click(screen.getByRole('button', { name: 'Mais' }));
    await user.click(screen.getByRole('menuitem', { name: 'Abrir atalhos de teclado' }));

    expect(shortcutsListener).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    window.removeEventListener('open-shortcuts', shortcutsListener);
  });

  it('expõe o menu com limite de altura e rolagem para viewports baixos', async () => {
    const user = userEvent.setup();
    renderWithTheme(<AppSidebar />);

    await user.click(screen.getByRole('button', { name: 'Mais' }));

    const menu = screen.getByRole('menu');
    const paper = menu.parentElement;
    expect(paper).toHaveStyle({ maxHeight: 'min(70vh, 480px)', overflowY: 'auto' });
  });

  it('renderiza drawer expanded em desktop (lg+)', () => {
    renderWithTheme(<AppSidebar />);

    const logoElements = screen.getAllByTestId('app-logo');
    expect(logoElements.length).toBe(2);
  });

  it('mantém os logos do rail e drawer no mesmo token de tamanho', () => {
    renderWithTheme(<AppSidebar />);

    for (const logo of screen.getAllByTestId('app-logo')) {
      expect(logo).toHaveAttribute('data-size', 'small');
      expect(logo).toHaveAttribute('data-width', '28');
      expect(logo).toHaveAttribute('data-height', '28');
    }
  });

  it('aplica cantos arredondados e cor ativa também ao botão Mais do rail', () => {
    mockLocation.pathname = '/settings';
    mockLocation.search = '';
    renderWithTheme(<AppSidebar />);

    const moreButton = screen.getByRole('button', { name: 'Mais' });
    expect(moreButton).toHaveClass('Mui-selected');
    expect(appSidebarStyles.railNavigationButton).toMatchObject({
      borderRadius: 2,
      '&.Mui-selected': {
        '& .MuiListItemIcon-root': { color: 'primary.main' },
      },
    });
  });

  it('aplica cantos arredondados aos itens primários do rail', () => {
    renderWithTheme(<AppSidebar />);

    const railHomeButton = screen.getAllByText('Início')[0].closest('[role="button"]');
    expect(railHomeButton).toHaveClass('MuiListItemButton-root');
    expect(appSidebarStyles.railNavigationButton.borderRadius).toBe(2);
  });

  it('mantém o texto da busca desktop em uma linha com truncamento', () => {
    renderWithTheme(<AppSidebar />);

    const searchLabel = screen.getByText('Buscar...');
    expect(searchLabel).toBeInTheDocument();
    expect(searchLabel.tagName).toBe('SPAN');
    expect(searchLabel.closest('button')).toBeInTheDocument();
    expect(appSidebarStyles.desktopSearchLabel).toMatchObject({
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
  });

  it('usa tipografia válida e fundo opaco nos cabeçalhos sticky', () => {
    renderWithTheme(<AppSidebar />);

    const primaryHeader = screen.getByText('Principal');
    expect(appSidebarStyles.drawerSubheader).toMatchObject({
      typography: 'caption',
      backgroundColor: 'background.paper',
      fontWeight: 600,
    });
    expect(primaryHeader).toHaveClass('MuiListSubheader-sticky');
  });

  it('padroniza o espaçamento horizontal de todas as áreas do rail', () => {
    expect(appSidebarLayoutTokens.railPaddingX).toBe(1);
  });
});
