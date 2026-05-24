import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MobileTopBar } from './MobileTopBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key === 'common.appName' ? 'Futeba dos Parças' : key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('MobileTopBar', () => {
  it('renderiza o título padrão do app quando title não é fornecido', () => {
    renderWithTheme(<MobileTopBar unreadCount={0} />);
    expect(screen.getByText('Futeba dos Parças')).toBeInTheDocument();
  });

  it('renderiza título customizado', () => {
    renderWithTheme(<MobileTopBar unreadCount={0} title="Meu Título" />);
    expect(screen.getByText('Meu Título')).toBeInTheDocument();
  });

  it('mostra badge de notificação com contagem', () => {
    renderWithTheme(<MobileTopBar unreadCount={5} />);
    expect(screen.getByLabelText(/5/)).toBeInTheDocument();
  });

  it('não mostra badge quando contagem é zero', () => {
    renderWithTheme(<MobileTopBar unreadCount={0} />);
    expect(screen.queryByLabelText(/0/)).not.toBeInTheDocument();
  });

  it('renderiza AppBar com role=region', () => {
    renderWithTheme(<MobileTopBar unreadCount={0} />);
    expect(screen.getByRole('button', { name: /notifica/i })).toBeInTheDocument();
  });

  it('renderiza logo do app', () => {
    const { container } = renderWithTheme(<MobileTopBar unreadCount={0} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('tem display responsivo xs flex e md none', () => {
    const { container } = renderWithTheme(<MobileTopBar unreadCount={0} />);
    const header = container.querySelector('.MuiAppBar-root');
    expect(header).toBeInTheDocument();
  });

  it('badge aparece com contagem alta', () => {
    renderWithTheme(<MobileTopBar unreadCount={99} />);
    expect(screen.getByLabelText(/99/)).toBeInTheDocument();
  });
});
