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
    useLocation: () => ({ pathname: '/nonexistent', search: '' }),
  };
});

vi.mock('../../utils/errorLogger', () => ({
  logError: vi.fn().mockResolvedValue('error-123'),
}));

vi.mock('../../components/common/ErrorDetailsButton', () => ({
  ErrorDetailsButton: () => <div data-testid="error-details">Detalhes</div>,
}));

import { NotFoundScreen } from './NotFoundScreen';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>
  );
}

describe('NotFoundScreen', () => {
  it('mostra mensagem 404', () => {
    renderWithTheme(<NotFoundScreen />);
    expect(screen.getByText('404 — Página não encontrada')).toBeInTheDocument();
  });

  it('mostra descrição de página não encontrada', () => {
    renderWithTheme(<NotFoundScreen />);
    expect(screen.getByText('O endereço que você tentou acessar não existe.')).toBeInTheDocument();
  });

  it('renderiza botão Voltar pro início', () => {
    renderWithTheme(<NotFoundScreen />);
    expect(screen.getByText('Voltar pro início')).toBeInTheDocument();
  });

  it('botão navega para /', async () => {
    const user = userEvent.setup();
    renderWithTheme(<NotFoundScreen />);

    await user.click(screen.getByText('Voltar pro início'));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renderiza ícone de insatisfação', () => {
    renderWithTheme(<NotFoundScreen />);
    expect(screen.getByTestId('SentimentDissatisfiedIcon')).toBeInTheDocument();
  });

  it('tem aria-labelledby no main', () => {
    renderWithTheme(<NotFoundScreen />);
    expect(screen.getByRole('main')).toHaveAttribute('aria-labelledby', 'not-found-title');
  });
});
