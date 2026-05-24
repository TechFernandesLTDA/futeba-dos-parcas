import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { ErrorState } from './ErrorState';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('ErrorState', () => {
  it('renderiza mensagem padrão de erro', () => {
    renderWithTheme(<ErrorState />);
    expect(screen.getByText('Ops! Algo deu errado')).toBeInTheDocument();
  });

  it('renderiza mensagem customizada', () => {
    renderWithTheme(<ErrorState message="Erro ao carregar jogos" />);
    expect(screen.getByText('Erro ao carregar jogos')).toBeInTheDocument();
  });

  it('mostra botão de retry', () => {
    renderWithTheme(<ErrorState onRetry={() => {}} />);
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });

  it('chama onRetry ao clicar no botão', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithTheme(<ErrorState onRetry={onRetry} />);

    await user.click(screen.getByText('Tentar novamente'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renderiza label customizado no botão de retry', () => {
    renderWithTheme(<ErrorState onRetry={() => {}} retryLabel="Recarregar" />);
    expect(screen.getByText('Recarregar')).toBeInTheDocument();
  });

  it('tem role alert', () => {
    renderWithTheme(<ErrorState />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('não mostra botão retry se onRetry não for fornecido', () => {
    renderWithTheme(<ErrorState />);
    expect(screen.queryByText('Tentar novamente')).not.toBeInTheDocument();
  });

  it('renderiza ícone de erro', () => {
    renderWithTheme(<ErrorState />);
    expect(screen.getByTestId('ErrorOutlineIcon')).toBeInTheDocument();
  });
});
