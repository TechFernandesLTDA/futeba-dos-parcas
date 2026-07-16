import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRoute = vi.hoisted(() => ({ pathname: '/' }));
const mockAuth = vi.hoisted(() => ({ user: { id: 'user-1' } as { id: string } | null }));
const mockSwipeBack = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useLocation: () => mockRoute };
});

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
vi.mock('../../contexts/UnreadNotificationContext', () => ({
  useUnreadNotificationSummary: () => ({ unreadCount: 7, loading: false, error: null }),
}));
vi.mock('../../hooks/useAutoBreadcrumbs', () => ({
  useAutoBreadcrumbs: () => [{ label: 'Início', to: '/' }, { label: 'Jogo' }],
}));
vi.mock('../../hooks/useNavigateBack', () => ({ useNavigateBack: () => vi.fn() }));
vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
vi.mock('../../hooks/useSwipeBack', () => ({ useSwipeBack: mockSwipeBack }));
vi.mock('./MobileBottomNav', () => ({
  MobileBottomNav: ({ children }: { children?: React.ReactNode }) => <div data-testid="bottom-nav">{children}</div>,
}));
vi.mock('./MobileTopBar', () => ({
  MobileTopBar: ({ unreadCount, showBack }: { unreadCount: number; showBack?: boolean }) => (
    <div data-testid="top-bar" data-unread={unreadCount} data-show-back={String(showBack)} />
  ),
}));

import { MobileShell } from './MobileShell';

function renderShell() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MobileShell><main>Conteúdo</main></MobileShell>
    </ThemeProvider>,
  );
}

describe('MobileShell', () => {
  beforeEach(() => {
    mockRoute.pathname = '/';
    mockAuth.user = { id: 'user-1' };
    mockSwipeBack.mockClear();
  });

  it('mantém a top bar na raiz sem botão Voltar', () => {
    renderShell();

    expect(screen.getByTestId('top-bar')).toHaveAttribute('data-show-back', 'false');
    expect(screen.getByTestId('top-bar')).toHaveAttribute('data-unread', '7');
    expect(mockSwipeBack.mock.calls[0][0].disabled).toBe(true);
  });

  it('renderiza a top bar com botão Voltar em rotas secundárias', () => {
    mockRoute.pathname = '/game/game-1';
    renderShell();

    expect(screen.getByTestId('top-bar')).toHaveAttribute('data-show-back', 'true');
    expect(mockSwipeBack.mock.calls[0][0].disabled).toBe(false);
    expect(mockSwipeBack.mock.calls[0][0].targetRef.current).toHaveAttribute('id', 'mobile-shell');
  });

  it('não exibe navegação autenticada para visitante', () => {
    mockAuth.user = null;
    renderShell();

    expect(screen.queryByTestId('top-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bottom-nav')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });
});
