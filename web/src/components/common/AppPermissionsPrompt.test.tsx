import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';

const permissionMock = vi.hoisted(() => ({
  requestNotifications: vi.fn(),
  requestLocation: vi.fn(),
  requestStorage: vi.fn(),
  permissions: {
    notifications: { id: 'notifications', state: 'prompt', supported: true, loading: false },
    location: { id: 'location', state: 'prompt', supported: true, loading: false },
    storage: { id: 'storage', state: 'denied', supported: true, loading: false },
  },
}));

vi.mock('../../hooks/useAppPermissions', () => ({
  useAppPermissions: () => ({
    permissions: permissionMock.permissions,
    requestNotifications: permissionMock.requestNotifications,
    requestLocation: permissionMock.requestLocation,
    requestStorage: permissionMock.requestStorage,
  }),
}));

import { AppPermissionsPrompt } from './AppPermissionsPrompt';

const theme = createTheme();

function renderPrompt() {
  return render(
    <ThemeProvider theme={theme}>
      <AppPermissionsPrompt />
    </ThemeProvider>,
  );
}

describe('AppPermissionsPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    permissionMock.permissions = {
      notifications: { id: 'notifications', state: 'prompt', supported: true, loading: false },
      location: { id: 'location', state: 'prompt', supported: true, loading: false },
      storage: { id: 'storage', state: 'denied', supported: true, loading: false },
    };
  });

  it('renderiza permissões pendentes e estado bloqueado', () => {
    renderPrompt();

    expect(screen.getByText('Ativar recursos do app')).toBeInTheDocument();
    expect(screen.getByText('Notificações')).toBeInTheDocument();
    expect(screen.getByText('Localização')).toBeInTheDocument();
    expect(screen.getByText('Espaço do app')).toBeInTheDocument();
    expect(screen.getByText('Bloqueado')).toBeInTheDocument();
  });

  it('aciona a permissão escolhida apenas após clique', async () => {
    const user = userEvent.setup();
    renderPrompt();

    const allowButtons = screen.getAllByRole('button', { name: /permitir/i });
    await user.click(allowButtons[0]);
    await user.click(allowButtons[1]);

    expect(permissionMock.requestNotifications).toHaveBeenCalledTimes(1);
    expect(permissionMock.requestLocation).toHaveBeenCalledTimes(1);
    expect(permissionMock.requestStorage).not.toHaveBeenCalled();
  });

  it('silencia o prompt ao tocar em Depois', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await user.click(screen.getByRole('button', { name: /depois/i }));

    expect(screen.queryByText('Ativar recursos do app')).not.toBeInTheDocument();
    expect(Number(localStorage.getItem('futeba.permissionPrompt.snoozedUntil'))).toBeGreaterThan(Date.now());
  });
});
