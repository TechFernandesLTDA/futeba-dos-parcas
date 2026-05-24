import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { AdaptiveFormSheet } from './AdaptiveFormSheet';

vi.mock('../../hooks/useDirtyGuard', () => ({
  useDirtyGuard: () => ({
    isBlocked: false,
    attemptClose: vi.fn((fn) => fn()),
    proceed: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock('../../hooks/useNavigateBack', () => ({
  useNavigateBack: () => vi.fn(),
}));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('AdaptiveFormSheet', () => {
  it('renderiza children', () => {
    renderWithTheme(
      <AdaptiveFormSheet closeDestination="/">
        <div>Conteúdo do formulário</div>
      </AdaptiveFormSheet>
    );
    expect(screen.getByText('Conteúdo do formulário')).toBeInTheDocument();
  });

  it('passa closeDestination para useNavigateBack', () => {
    renderWithTheme(
      <AdaptiveFormSheet closeDestination="/groups">
        <div>Conteúdo</div>
      </AdaptiveFormSheet>
    );
  });

  it('mobile renderiza sem wrapper', () => {
    const { container } = renderWithTheme(
      <AdaptiveFormSheet closeDestination="/">
        <div data-testid="child">Direto</div>
      </AdaptiveFormSheet>
    );
    expect(screen.getByText('Direto')).toBeInTheDocument();
  });

  it('não mostra dialog dirty quando isDirty=false', () => {
    renderWithTheme(
      <AdaptiveFormSheet closeDestination="/" isDirty={false}>
        <div>Conteúdo</div>
      </AdaptiveFormSheet>
    );
    expect(screen.queryByText('Descartar mudanças?')).not.toBeInTheDocument();
  });

  it('renderiza multiple children corretamente', () => {
    renderWithTheme(
      <AdaptiveFormSheet closeDestination="/">
        <span>A</span>
        <span>B</span>
      </AdaptiveFormSheet>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('não quebra sem children especiais', () => {
    renderWithTheme(
      <AdaptiveFormSheet closeDestination="/">
        <span>Simples</span>
      </AdaptiveFormSheet>
    );
    expect(screen.getByText('Simples')).toBeInTheDocument();
  });
});
