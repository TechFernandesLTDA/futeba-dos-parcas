import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScreenHeader } from './ScreenHeader';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { IconButton } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

describe('ScreenHeader', () => {
  it('renders title', () => {
    renderWithTheme(<ScreenHeader title="Meu Perfil" />);
    expect(screen.getByRole('heading', { name: 'Meu Perfil' })).toBeInTheDocument();
  });

  it('renders back button when onBack provided', () => {
    renderWithTheme(<ScreenHeader title="Config" onBack={vi.fn()} />);
    expect(screen.getByLabelText('Voltar')).toBeInTheDocument();
  });

  it('does not render back button when onBack omitted', () => {
    renderWithTheme(<ScreenHeader title="Home" />);
    expect(screen.queryByLabelText('Voltar')).not.toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    renderWithTheme(<ScreenHeader title="Test" onBack={onBack} />);
    fireEvent.click(screen.getByLabelText('Voltar'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('uses custom backAriaLabel', () => {
    renderWithTheme(<ScreenHeader title="Test" onBack={vi.fn()} backAriaLabel="Retornar" />);
    expect(screen.getByLabelText('Retornar')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    renderWithTheme(
      <ScreenHeader
        title="Profile"
        onBack={vi.fn()}
        actions={
          <IconButton aria-label="Editar">
            <EditIcon />
          </IconButton>
        }
      />
    );
    expect(screen.getByLabelText('Editar')).toBeInTheDocument();
  });

  it('renders without sticky wrapper when sticky=false', () => {
    const { container } = renderWithTheme(
      <ScreenHeader title="Inline" sticky={false} />
    );
    // Should not have position:sticky wrapper
    expect(container.querySelector('[style*="sticky"]')).toBeNull();
  });
});
