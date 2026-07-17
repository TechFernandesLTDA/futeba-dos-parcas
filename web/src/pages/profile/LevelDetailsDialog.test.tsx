import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import { LEVEL_TABLE } from '../../types/gamification';
import { LevelDetailsDialog } from './LevelDetailsDialog';
import { LevelRow } from './LevelJourneyScreen';

vi.mock('../../services/firebase', () => ({ db: {} }));

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('detalhes da jornada de nível', () => {
  it('mantém um nível bloqueado clicável para consulta', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const entry = LEVEL_TABLE[11];

    renderWithTheme(
      <LevelRow
        entry={entry}
        isUnlocked={false}
        isCurrent={false}
        onSelect={onSelect}
      />,
    );

    const levelButton = screen.getByRole('button', {
      name: /ver detalhes do nível 11, garrincha.*bloqueado/i,
    });
    expect(levelButton).toBeEnabled();

    await user.click(levelButton);
    expect(onSelect).toHaveBeenCalledWith(entry);
  });

  it('amplia a arte e explica quanto falta para desbloquear', () => {
    const entry = LEVEL_TABLE[11];

    renderWithTheme(
      <LevelDetailsDialog
        entry={entry}
        currentXp={1_000}
        isCurrent={false}
        isUnlocked={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: /garrincha/i })).toBeVisible();
    expect(screen.getByRole('img', { name: /brasão de nível 11 - garrincha/i })).toBeVisible();
    expect(screen.getByText('Bloqueado')).toBeVisible();
    expect(screen.getByText('74.000')).toBeVisible();
    expect(screen.getByText(/será desbloqueado automaticamente/i)).toBeVisible();
  });

  it('permite fechar o detalhe ampliado pelo botão acessível', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithTheme(
      <LevelDetailsDialog
        entry={LEVEL_TABLE[5]}
        currentXp={4_000}
        isCurrent
        isUnlocked
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
