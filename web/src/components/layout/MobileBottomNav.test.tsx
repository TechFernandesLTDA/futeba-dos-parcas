import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { md3TypeScale } from '../../theme';
import { MobileBottomNav } from './MobileBottomNav';

const mockPrefetchFocus = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

vi.mock('../../hooks/useResourcePreloading', () => ({
  usePrefetchOnHover: () => ({ onFocus: mockPrefetchFocus }),
}));

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
  return { ...actual, useScrollTrigger: () => false };
});

describe('MobileBottomNav', () => {
  it('é um componente simples, sem wrapper React.memo ineficaz', () => {
    expect(typeof MobileBottomNav).toBe('function');
  });

  it('mantém a superfície interna transparente e labels estáveis no token MD3', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <MobileBottomNav />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const navigation = screen.getByTestId('mobile-bottom-navigation');
    const selectedLabel = navigation.querySelector('.MuiBottomNavigationAction-label.Mui-selected');
    const regularLabel = navigation.querySelector('.MuiBottomNavigationAction-label:not(.Mui-selected)');

    expect(getComputedStyle(navigation).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(selectedLabel).not.toBeNull();
    expect(regularLabel).not.toBeNull();
    expect(selectedLabel).toHaveStyle({ fontSize: md3TypeScale.labelMedium.fontSize });
    expect(regularLabel).toHaveStyle({ fontSize: md3TypeScale.labelMedium.fontSize });
  });

  it('expõe a rota de prefetch e antecipa o foco sem hook dentro do map', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <MobileBottomNav />
        </MemoryRouter>
      </ThemeProvider>,
    );

    const firstAction = screen.getAllByRole('button')[0];
    expect(firstAction).toHaveAttribute('data-prefetch-route');
    fireEvent.focus(firstAction);
    expect(mockPrefetchFocus).toHaveBeenCalledTimes(1);
  });
});
