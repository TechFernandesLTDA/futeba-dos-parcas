import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { MobileBottomNav } from './MobileBottomNav';

const navigate = vi.hoisted(() => vi.fn());
const triggerHaptic = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: '/', search: '?tab=0' }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));

vi.mock('../../hooks/useHapticFeedback', () => ({
  useHapticFeedback: () => ({ trigger: triggerHaptic }),
}));

describe('MobileBottomNav', () => {
  beforeEach(() => {
    navigate.mockClear();
    triggerHaptic.mockClear();
  });

  it('emite haptic leve antes de navegar por toque', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <MobileBottomNav />
        </MemoryRouter>
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'nav.games' }));

    expect(triggerHaptic).toHaveBeenCalledWith('light');
    expect(navigate).toHaveBeenCalledWith('/?tab=1');
    expect(triggerHaptic.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
  });
});
