import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LaunchPage } from './LaunchPage';

vi.mock('../../utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

describe('LaunchPage', () => {
  it('shows the official campaign image in the public hero', () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <LaunchPage />
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Sua pelada sai do grupo e entra em campo.' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Amigos reunidos em um campo com a marca Futeba dos Parças',
      }),
    ).toHaveAttribute('src', '/og-futeba-dos-parcas.png');
  });
});
