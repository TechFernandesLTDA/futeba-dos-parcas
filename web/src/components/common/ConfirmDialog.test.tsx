import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Excluir item"
        message="Tem certeza?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Excluir item')).toBeInTheDocument();
    expect(screen.getByText('Tem certeza?')).toBeInTheDocument();
  });

  it('renders children over message', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Excluir"
        message="Ignored"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      >
        <p>Custom content</p>
      </ConfirmDialog>
    );
    expect(screen.getByText('Custom content')).toBeInTheDocument();
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Sure?"
        confirmLabel="Sim"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Sim'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Sure?"
        cancelLabel="Não"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Não'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('disables buttons when loading', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Sure?"
        confirmLabel="Excluir"
        loading
        loadingLabel="Excluindo..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const confirmBtn = screen.getByText('Excluindo...');
    expect(confirmBtn).toBeDisabled();
  });

  it('renders loading label when loading', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Sure?"
        confirmLabel="Remover"
        loading
        loadingLabel="Removendo..."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Removendo...')).toBeInTheDocument();
  });

  it('renders confirm icon when not loading', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Sure?"
        confirmIcon={<span data-testid="confirm-icon" />}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTestId('confirm-icon')).toBeInTheDocument();
  });

  it('uses confirmColor for confirm button', () => {
    renderWithTheme(
      <ConfirmDialog
        open={true}
        title="Test"
        message="Sure?"
        confirmColor="warning"
        confirmLabel="Sair"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const btn = screen.getByText('Sair');
    expect(btn).toBeInTheDocument();
  });
});
