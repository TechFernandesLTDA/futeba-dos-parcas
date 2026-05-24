import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { SkipNav } from './SkipNav';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('SkipNav', () => {
  it('renderiza link pular para conteúdo', () => {
    renderWithTheme(<SkipNav />);
    expect(screen.getByText('Pular para o conteúdo')).toBeInTheDocument();
  });

  it('tem href para main-content', () => {
    renderWithTheme(<SkipNav />);
    const link = screen.getByText('Pular para o conteúdo').closest('a');
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('tem aria-label na navegação', () => {
    renderWithTheme(<SkipNav />);
    expect(screen.getByLabelText('Pular navegação')).toBeInTheDocument();
  });

  it('é invisível por padrão (offscreen)', () => {
    const { container } = renderWithTheme(<SkipNav />);
    const nav = container.firstChild as HTMLElement;
    expect(nav).toHaveStyle('position: absolute');
    expect(nav).toHaveStyle('top: -9999px');
  });

  it('fica visível ao receber foco via Tab', async () => {
    const user = userEvent.setup();
    renderWithTheme(<SkipNav />);

    await user.tab();

    const link = screen.getByText('Pular para o conteúdo');
    expect(link).toHaveFocus();
  });
});
