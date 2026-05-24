import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { AppBreadcrumbs } from './AppBreadcrumbs';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('AppBreadcrumbs', () => {
  it('renderiza trail de breadcrumbs', () => {
    renderWithTheme(
      <AppBreadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Jogos', to: '/?tab=1' },
          { label: 'Detalhes' },
        ]}
      />
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Jogos')).toBeInTheDocument();
    expect(screen.getByText('Detalhes')).toBeInTheDocument();
  });

  it('tem aria-label breadcrumb', () => {
    renderWithTheme(
      <AppBreadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Jogo' },
        ]}
      />
    );

    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
  });

  it('último item não é clicável', () => {
    renderWithTheme(
      <AppBreadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Jogos', to: '/?tab=1' },
          { label: 'Atual' },
        ]}
      />
    );

    const atual = screen.getByText('Atual');
    expect(atual.tagName).toBe('P');
  });

  it('itens intermediários são links', () => {
    renderWithTheme(
      <AppBreadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Jogos', to: '/?tab=1' },
          { label: 'Detalhes' },
        ]}
      />
    );

    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('retorna null quando items é vazio', () => {
    const { container } = renderWithTheme(
      <AppBreadcrumbs items={[]} />
    );

    expect(container.innerHTML).toBe('');
  });

  it('lida com item único', () => {
    renderWithTheme(
      <AppBreadcrumbs items={[{ label: 'Única Página' }]} />
    );

    expect(screen.getByText('Única Página')).toBeInTheDocument();
  });

  it('renderiza separador navigateNext', () => {
    const { container } = renderWithTheme(
      <AppBreadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Página' },
        ]}
      />
    );

    const separators = container.querySelectorAll('[data-testid="NavigateNextIcon"]');
    expect(separators.length).toBe(1);
  });
});
