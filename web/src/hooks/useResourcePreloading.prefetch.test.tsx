import { type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResourcePreloading } from './useResourcePreloading';

// #4196: visitantes (home pública e guias) não podem baixar telas que exigem sessão.
const leagueLoaded = vi.hoisted(() => vi.fn());
vi.mock('../pages/league/LeagueScreen', () => {
  leagueLoaded();
  return { LeagueScreen: () => null };
});

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>;

describe('useResourcePreloading: prefetch de rotas', () => {
  afterEach(() => {
    leagueLoaded.mockClear();
    vi.useRealTimers();
  });

  it('não antecipa rotas autenticadas quando prefetchRoutes é falso', async () => {
    vi.useFakeTimers();
    renderHook(() => useResourcePreloading({ prefetchRoutes: false }), { wrapper });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(leagueLoaded).not.toHaveBeenCalled();
  });

  it('antecipa /league a partir da home quando há sessão', async () => {
    renderHook(() => useResourcePreloading({ prefetchRoutes: true }), { wrapper });
    await waitFor(() => expect(leagueLoaded).toHaveBeenCalled(), { timeout: 8000 });
  });
});
