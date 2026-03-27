import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { LoadingScreen } from './LoadingScreen';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('LoadingScreen', () => {
  it('renderiza indicador de carregamento (skeleton cards por padrão)', () => {
    renderWithTheme(<LoadingScreen />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renderiza mensagem de loading quando fornecida', () => {
    renderWithTheme(<LoadingScreen message="Carregando jogos..." variant="spinner" />);
    expect(screen.getByText('Carregando jogos...')).toBeInTheDocument();
  });

  it('possui atributo role="status" para acessibilidade', () => {
    renderWithTheme(<LoadingScreen />);
    const statusElement = screen.getByRole('status');
    expect(statusElement).toBeInTheDocument();
  });

  it('possui aria-label adequado', () => {
    renderWithTheme(<LoadingScreen message="Carregando dados" />);
    const statusElement = screen.getByRole('status');
    expect(statusElement).toHaveAttribute('aria-label', 'Carregando dados');
  });
});
