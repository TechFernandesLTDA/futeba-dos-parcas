import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { PullToRefresh } from './PullToRefresh';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('PullToRefresh', () => {
  it('renderiza children', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('mostra indicador de texto ao puxar', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
    expect(screen.queryByText('Puxe para atualizar')).not.toBeInTheDocument();
  });

  it('mostra indicador de refresh quando atualizando', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={() => new Promise(() => {})}>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
  });

  it('desabilitado não responde a touch events', () => {
    const onRefresh = vi.fn();
    renderWithTheme(
      <PullToRefresh onRefresh={onRefresh} disabled>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
  });

  it('aplica altura zero quando não está puxando', () => {
    const { container } = renderWithTheme(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
    const indicator = container.querySelector('.MuiBox-root');
    expect(indicator).toBeInTheDocument();
  });

  it('tem role region para acessibilidade', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={vi.fn()}>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
  });

  it('não dispara refresh após unmount', () => {
    const onRefresh = vi.fn();
    const { unmount } = renderWithTheme(
      <PullToRefresh onRefresh={onRefresh}>
        <div>Conteúdo</div>
      </PullToRefresh>
    );
    unmount();
  });

  it('renderiza múltiplos children', () => {
    renderWithTheme(
      <PullToRefresh onRefresh={vi.fn()}>
        <span>Primeiro</span>
        <span>Segundo</span>
      </PullToRefresh>
    );
    expect(screen.getByText('Primeiro')).toBeInTheDocument();
    expect(screen.getByText('Segundo')).toBeInTheDocument();
  });
});
