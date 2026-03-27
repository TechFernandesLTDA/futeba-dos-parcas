import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { SearchOff } from '@mui/icons-material';
import { EmptyState } from './EmptyState';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('EmptyState (common)', () => {
  it('renderiza o título', () => {
    renderWithTheme(<EmptyState title="Nenhum jogo encontrado" icon={<SearchOff />} />);
    expect(screen.getByText('Nenhum jogo encontrado')).toBeInTheDocument();
  });

  it('renderiza a descrição quando fornecida', () => {
    renderWithTheme(
      <EmptyState
        title="Sem jogos"
        description="Crie um novo jogo para começar"
        icon={<SearchOff />}
      />
    );
    expect(screen.getByText('Crie um novo jogo para começar')).toBeInTheDocument();
  });

  it('renderiza o ícone quando fornecido', () => {
    renderWithTheme(
      <EmptyState title="Sem dados" icon={<SearchOff data-testid="empty-icon" />} />
    );
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });

  it('renderiza botão de ação quando actionLabel e onAction fornecidos', () => {
    const onAction = vi.fn();
    renderWithTheme(
      <EmptyState
        title="Sem jogos"
        actionLabel="Criar Jogo"
        onAction={onAction}
        icon={<SearchOff />}
      />
    );
    expect(screen.getByText('Criar Jogo')).toBeInTheDocument();
  });

  it('chama onAction quando botão é clicado', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderWithTheme(
      <EmptyState
        title="Sem jogos"
        actionLabel="Criar Jogo"
        onAction={onAction}
        icon={<SearchOff />}
      />
    );

    await user.click(screen.getByText('Criar Jogo'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('possui role="status" e aria-label acessível', () => {
    renderWithTheme(<EmptyState title="Sem resultados" icon={<SearchOff />} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Sem resultados');
  });
});
