import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./AppSidebar', () => ({
  AppSidebar: () => <div data-testid="app-sidebar">Sidebar</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, Outlet: () => <div data-testid="outlet">Content</div> };
});

import { AppLayout } from './AppLayout';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { useAppBreadcrumbOverride } from '../../hooks/useAutoBreadcrumbs';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

function DetailBreadcrumb() {
  useAppBreadcrumbOverride();
  return (
    <AppBreadcrumbs
      items={[
        { label: 'Grupos', to: '/?tab=2' },
        { label: 'Parças da Vila' },
      ]}
    />
  );
}

describe('AppLayout', () => {
  it('renderiza sidebar', () => {
    renderWithTheme(<AppLayout />);
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
  });

  it('renderiza children via Outlet', () => {
    renderWithTheme(<AppLayout />);
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('renderiza children explícitos no lugar do Outlet', () => {
    renderWithTheme(<AppLayout><div data-testid="explicit-child">404</div></AppLayout>);
    expect(screen.getByTestId('explicit-child')).toBeInTheDocument();
    expect(screen.queryByTestId('outlet')).not.toBeInTheDocument();
  });

  it('renderiza main content com role main', () => {
    renderWithTheme(<AppLayout />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('main content tem id main-content', () => {
    renderWithTheme(<AppLayout />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('sidebar está dentro de nav com aria-label', () => {
    renderWithTheme(<AppLayout />);
    expect(screen.getByRole('navigation')).toHaveAttribute('aria-label', 'Menu principal');
  });

  it('possui layout flexível', () => {
    const { container } = renderWithTheme(<AppLayout />);
    expect(container.firstChild).toHaveStyle('display: flex');
  });

  it('renderiza sidebar e conteúdo em ordem correta', () => {
    const { container } = renderWithTheme(<AppLayout />);
    const sidebar = screen.getByTestId('app-sidebar');
    const main = screen.getByRole('main');

    expect(container.firstChild).toContainElement(sidebar);
    expect(container.firstChild).toContainElement(main);
  });

  it('mantém somente o breadcrumb da tela quando há override com nome real', async () => {
    renderWithTheme(
      <AppLayout><DetailBreadcrumb /></AppLayout>,
      ['/group/abcdefghijk'],
    );

    await waitFor(() => {
      expect(screen.getAllByLabelText('Navegação estrutural')).toHaveLength(1);
    });
    expect(screen.getByText('Parças da Vila')).toBeInTheDocument();
    expect(screen.queryByText('Detalhes')).not.toBeInTheDocument();
  });
});
