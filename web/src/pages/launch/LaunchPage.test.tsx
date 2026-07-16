import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchPage } from './LaunchPage';
import { ThemeProvider } from '../../contexts/ThemeContext';

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

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

    expect(campaignImage).toHaveAttribute('src', '/og-futeba-dos-parcas.png');
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
});
