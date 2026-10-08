import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchPage } from './LaunchPage';
import { ThemeProvider } from '../../contexts/ThemeContext';

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

// #4070: expõe o palette.mode do tema MUI que o provider entrega à landing —
// a página não deve mais carregar um MuiThemeProvider claro próprio.
function MuiThemeModeProbe() {
  const muiTheme = useMuiTheme();
  return <span data-testid="mui-palette-mode">{muiTheme.palette.mode}</span>;
}

describe('LaunchPage', () => {
  beforeEach(() => localStorage.clear());

  const renderLanding = () => render(
    <MemoryRouter>
      <ThemeProvider>
        <LaunchPage />
      </ThemeProvider>
    </MemoryRouter>,
  );

  it('shows the campaign image early in the hero and keeps the status on one line', () => {
    localStorage.setItem('themeMode', 'dark');
    renderLanding();

    const heading = screen.getByRole('heading', {
      name: 'Sua pelada sai do grupo e entra em campo.',
    });
    const campaignImage = screen.getByRole('img', {
      name: 'Amigos reunidos em um campo com a marca Futeba dos Parças',
    });
    const description = screen.getByText(/Confirmações, times, placar/);

    expect(campaignImage).toHaveAttribute('src', '/og-futeba-dos-parcas-hero.webp');
    expect(heading.compareDocumentPosition(campaignImage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(campaignImage.compareDocumentPosition(description)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('CONFIRMADO')).toHaveClass('MuiTypography-noWrap');
    expect(screen.getByTestId('public-landing')).toHaveAttribute('data-resolved-theme', 'light');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.resolvedTheme).toBe('light');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
  });

  it('centers the FAQ questions and answers under one labelled section', async () => {
    renderLanding();

    expect(
      screen.getByRole('region', { name: 'Antes de entrar em campo' }),
    ).toBeInTheDocument();
    const installQuestion = screen.getByText('Preciso instalar um aplicativo?');
    expect(installQuestion).toHaveClass('MuiTypography-alignCenter');

    fireEvent.click(installQuestion);
    expect(
      await screen.findByText(/Não. O Futeba funciona no navegador do celular/),
    ).toHaveClass('MuiTypography-alignCenter');
  });

  it('restores the saved app theme after leaving the public landing', async () => {
    localStorage.setItem('themeMode', 'dark');
    const { rerender } = renderLanding();

    expect(document.documentElement.dataset.resolvedTheme).toBe('light');

    rerender(
      <MemoryRouter>
        <ThemeProvider>
          <div>Área autenticada</div>
        </ThemeProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.resolvedTheme).toBe('dark');
      expect(document.documentElement).toHaveStyle({ colorScheme: 'dark' });
    });
  });

  // #4070: com dark salvo, o tema MUI entregue pelo provider (o que o
  // <CssBaseline /> usa para pintar o body) é o claro enquanto a landing está
  // montada — sem wrapper local na página.
  it('serves the light MUI theme (body via CssBaseline) while mounted, even with dark saved (#4070)', () => {
    localStorage.setItem('themeMode', 'dark');
    render(
      <MemoryRouter>
        <ThemeProvider>
          <LaunchPage />
          <MuiThemeModeProbe />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('mui-palette-mode').textContent).toBe('light');
  });

  // #4071: o CTA do hero deixa de usar secondary (azul #005FCC sobre verde,
  // 1,25:1 de separação) e passa a ser branco sólido com texto primary.dark.
  it('hero CTA is solid white with primary.dark text (#4071)', () => {
    renderLanding();

    const cta = screen.getByRole('link', { name: 'Organizar minha pelada' });
    const styles = getComputedStyle(cta);
    expect(styles.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(styles.color).toBe('rgb(0, 90, 28)');
  });
});
