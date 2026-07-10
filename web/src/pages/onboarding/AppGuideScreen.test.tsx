import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppGuideScreen } from './AppGuideScreen';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockCarouselStarted = vi.hoisted(() => vi.fn());
const mockSlideViewed = vi.hoisted(() => vi.fn());
const mockCarouselSkipped = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCarouselCompleted = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('../../hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    onCarouselStarted: mockCarouselStarted,
    onSlideViewed: mockSlideViewed,
    onCarouselSkipped: mockCarouselSkipped,
    onCarouselCompleted: mockCarouselCompleted,
  }),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn() }),
}));
vi.mock('../../hooks/useDocumentTitle', () => ({ useDocumentTitle: vi.fn() }));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

describe('AppGuideScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCarouselCompleted.mockResolvedValue(undefined);
  });

  it('persiste a conclusão do guia e entra no aplicativo', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider theme={createTheme()}>
        <AppGuideScreen />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('tab', { name: 'Ir para slide 4 de 4' }));
    await user.click(screen.getByRole('button', { name: 'Começar a usar o app' }));

    await waitFor(() => expect(mockCarouselCompleted).toHaveBeenCalledTimes(1));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
