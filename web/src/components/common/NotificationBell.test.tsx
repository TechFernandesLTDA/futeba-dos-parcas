import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

import { NotificationBell } from './NotificationBell';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('NotificationBell', () => {
  it('renderiza ícone de sino', () => {
    renderWithTheme(<NotificationBell unreadCount={0} />);
    expect(screen.getByLabelText(/Notificações/)).toBeInTheDocument();
  });

  it('mostra badge com contagem de não lidas', () => {
    renderWithTheme(<NotificationBell unreadCount={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('badge fica invisível quando count é 0', () => {
    const { container } = renderWithTheme(<NotificationBell unreadCount={0} />);
    const badge = container.querySelector('.MuiBadge-badge');
    expect(badge).toHaveClass('MuiBadge-invisible');
  });

  it('mostra 99+ para contagens grandes', () => {
    renderWithTheme(<NotificationBell unreadCount={150} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('navega para /notifications ao clicar', async () => {
    const user = userEvent.setup();
    renderWithTheme(<NotificationBell unreadCount={3} />);

    await user.click(screen.getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('aria-label inclui contagem quando maior que zero', () => {
    renderWithTheme(<NotificationBell unreadCount={3} />);
    expect(screen.getByLabelText('Notificações (3 não lidas)')).toBeInTheDocument();
  });

  it('aria-label usa singular correto para uma notificação', () => {
    renderWithTheme(<NotificationBell unreadCount={1} />);
    expect(screen.getByLabelText('Notificações (1 não lida)')).toBeInTheDocument();
  });

  it('aria-label não inclui contagem quando zero', () => {
    renderWithTheme(<NotificationBell unreadCount={0} />);
    expect(screen.getByLabelText('Notificações')).toBeInTheDocument();
  });
});
