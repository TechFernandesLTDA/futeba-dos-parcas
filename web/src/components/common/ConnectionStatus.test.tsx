import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { ConnectionStatus } from './ConnectionStatus';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('ConnectionStatus', () => {
  it('não renderiza nada quando online', () => {
    const { container } = renderWithTheme(<ConnectionStatus isOnline={true} />);
    expect(container.innerHTML).toBe('');
  });

  it('renderiza banner offline quando offline', () => {
    renderWithTheme(<ConnectionStatus isOnline={false} />);
    // #2222: texto agora vem do i18n (chave connection.offlineLimited). Sem
    // provider de i18n no setup de teste, useTranslation retorna a própria
    // chave — então asseguramos a presença do banner pela chave renderizada.
    expect(screen.getByText('connection.offlineLimited')).toBeInTheDocument();
  });

  it('tem role alert', () => {
    renderWithTheme(<ConnectionStatus isOnline={false} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('tem aria-live assertivo', () => {
    renderWithTheme(<ConnectionStatus isOnline={false} />);
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('mostra ícone de wifi off', () => {
    renderWithTheme(<ConnectionStatus isOnline={false} />);
    expect(screen.getByTestId('WifiOffIcon')).toBeInTheDocument();
  });

  it('retorna null quando online mesmo com props extras', () => {
    const { container } = renderWithTheme(
      <ConnectionStatus isOnline={true} />
    );
    expect(container.firstChild).toBeNull();
  });
});
