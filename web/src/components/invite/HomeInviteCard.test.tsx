import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomeInviteCard } from './HomeInviteCard';

describe('HomeInviteCard', () => {
  it('deixa o convite visível e aciona o fluxo pelo card inteiro', async () => {
    const onInvite = vi.fn();
    const user = userEvent.setup();

    render(
      <ThemeProvider theme={createTheme()}>
        <HomeInviteCard onInvite={onInvite} />
      </ThemeProvider>,
    );

    const inviteAction = screen.getByRole('button', { name: 'Convidar Amigos' });
    expect(inviteAction).toBeVisible();

    await user.click(inviteAction);
    expect(onInvite).toHaveBeenCalledTimes(1);
  });
});
