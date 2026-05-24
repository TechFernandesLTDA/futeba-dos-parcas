import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
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
});
