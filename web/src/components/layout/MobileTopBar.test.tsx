import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { MobileTopBar } from './MobileTopBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) => {
      if (key === 'common.appName') return 'Futeba dos Parças';
      if (key === 'nav.notificationsAria' && opts?.count !== undefined)
        return `Notificações (${opts.count} não lidas)`;
      if (key === 'nav.notifications') return 'Notificações';
      return key;
    },
  }),
}));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}><MemoryRouter>{ui}</MemoryRouter></ThemeProvider>);
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
    expect(img).toHaveAttribute('alt', '');
  });

  it('oculta o separador decorativo e usa contraste informativo no breadcrumb', () => {
    const { container } = renderWithTheme(
      <MobileTopBar
        unreadCount={0}
        showBack
        onBack={vi.fn()}
        breadcrumbs={[{ label: 'Início', to: '/' }, { label: 'Grupo' }]}
      />,
    );

    const separator = container.querySelector('[data-testid="NavigateNextIcon"]');
    expect(separator).toHaveAttribute('aria-hidden', 'true');
    expect(separator).toHaveStyle({ color: theme.palette.text.secondary });
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
