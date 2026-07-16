import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LaunchPage } from './LaunchPage';
import { futebaDarkTheme } from '../../theme';

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('LaunchPage', () => {
  it('shows the campaign image early in the hero and keeps the status on one line', () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={futebaDarkTheme}>
          <LaunchPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    const heading = screen.getByRole('heading', {
      name: 'Sua pelada sai do grupo e entra em campo.',
    });
    const campaignImage = screen.getByRole('img', {
      name: 'Amigos reunidos em um campo com a marca Futeba dos Parças',
    });
    const description = screen.getByText(/Confirmações, times, placar/);

    expect(campaignImage).toHaveAttribute('src', '/og-futeba-dos-parcas.png');
    expect(heading.compareDocumentPosition(campaignImage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(campaignImage.compareDocumentPosition(description)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('CONFIRMADO')).toHaveClass('MuiTypography-noWrap');
    expect(screen.getByTestId('public-landing')).toHaveAttribute('data-resolved-theme', 'light');
    expect(document.documentElement).toHaveStyle({ colorScheme: 'light' });
  });

  it('centers the FAQ questions and answers under one labelled section', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={futebaDarkTheme}>
          <LaunchPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

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
});
