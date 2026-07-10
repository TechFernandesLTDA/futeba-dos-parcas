import { createTheme, ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChecklistStep } from './FirstStepsChecklist';
import { FirstStepsChecklist } from './FirstStepsChecklist';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const theme = createTheme();

function renderChecklist(steps: ChecklistStep[]) {
  return render(
    <ThemeProvider theme={theme}>
      <FirstStepsChecklist steps={steps} visible onDismiss={vi.fn()} />
    </ThemeProvider>,
  );
}

describe('FirstStepsChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executa a ação customizada sem navegar e desmontar o diálogo aberto', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderChecklist([
      {
        id: 'invite_players',
        label: 'Convide jogadores',
        subtitle: 'Compartilhe o convite',
        actionLabel: 'Convidar',
        navigateTo: '/group/group-1?tab=members',
        onAction,
        completed: false,
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'Convidar' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navega para o destino quando a etapa não possui ação customizada', async () => {
    const user = userEvent.setup();
    renderChecklist([
      {
        id: 'complete_profile',
        label: 'Complete seu perfil',
        subtitle: 'Adicione uma foto',
        actionLabel: 'Ir ao Perfil',
        navigateTo: '/profile',
        completed: false,
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'Ir ao Perfil' }));

    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });
});
