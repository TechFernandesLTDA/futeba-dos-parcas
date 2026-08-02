import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { LiveScoreboard } from './LiveScoreboard';
import type { TeamScore } from '../../utils/liveScores';

function makeTeam(overrides: Partial<TeamScore> & { teamId: string }): TeamScore {
  return {
    name: overrides.name ?? `Time ${overrides.teamId}`,
    score: overrides.score ?? 0,
    paletteKey: overrides.paletteKey ?? 'primary',
    isLeader: overrides.isLeader ?? false,
    isTied: overrides.isTied ?? false,
    ...overrides,
  } as TeamScore;
}

function renderScoreboard(teamScores: TeamScore[], isLive = true) {
  return render(
    <ThemeProvider theme={createTheme()}>
      <LiveScoreboard teamScores={teamScores} isLive={isLive} />
    </ThemeProvider>,
  );
}

describe('LiveScoreboard (#3942)', () => {
  it('renderiza o placar clássico de 2 times com nomes e placares', () => {
    renderScoreboard([
      makeTeam({ teamId: 't1', name: 'Mandrakes', score: 2, isLeader: true }),
      makeTeam({ teamId: 't2', name: 'Gremistas', score: 1, paletteKey: 'secondary' }),
    ]);

    expect(screen.getByText('Mandrakes')).toBeInTheDocument();
    expect(screen.getByText('Gremistas')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('–')).toBeInTheDocument();
  });

  it('mostra o chip "Ao Vivo" apenas quando isLive=true', () => {
    const { rerender } = renderScoreboard(
      [makeTeam({ teamId: 't1' }), makeTeam({ teamId: 't2', paletteKey: 'secondary' })],
      true,
    );
    expect(screen.getByText('Ao Vivo')).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={createTheme()}>
        <LiveScoreboard
          teamScores={[makeTeam({ teamId: 't1' }), makeTeam({ teamId: 't2', paletteKey: 'secondary' })]}
          isLive={false}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByText('Ao Vivo')).not.toBeInTheDocument();
  });

  it('renderiza grid de 4 times sem o separador "–"', () => {
    renderScoreboard([
      makeTeam({ teamId: 't1', name: 'A', score: 3, isLeader: true }),
      makeTeam({ teamId: 't2', name: 'B', score: 2, paletteKey: 'secondary' }),
      makeTeam({ teamId: 't3', name: 'C', score: 1, paletteKey: 'info' }),
      makeTeam({ teamId: 't4', name: 'D', score: 0, paletteKey: 'warning' }),
    ]);

    for (const name of ['A', 'B', 'C', 'D']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    // O layout multi-time não usa o separador traço do layout de 2 times.
    expect(screen.queryByText('–')).not.toBeInTheDocument();
  });

  it('renderiza grid de 3 times', () => {
    renderScoreboard([
      makeTeam({ teamId: 't1', name: 'Azul', score: 1, isLeader: true }),
      makeTeam({ teamId: 't2', name: 'Verde', score: 1, paletteKey: 'secondary', isLeader: true, isTied: true }),
      makeTeam({ teamId: 't3', name: 'Vermelho', score: 0, paletteKey: 'info' }),
    ]);
    expect(screen.getByText('Azul')).toBeInTheDocument();
    expect(screen.getByText('Verde')).toBeInTheDocument();
    expect(screen.getByText('Vermelho')).toBeInTheDocument();
  });

  it('expõe role=group com aria-label descritivo para leitores de tela', () => {
    renderScoreboard([
      makeTeam({ teamId: 't1', name: 'A', score: 0 }),
      makeTeam({ teamId: 't2', name: 'B', score: 0, paletteKey: 'secondary' }),
    ]);
    expect(screen.getByRole('group', { name: /placar do jogo ao vivo/i })).toBeInTheDocument();
  });

  it('anuncia o placar em uma região aria-live polita e oculta', () => {
    renderScoreboard([
      makeTeam({ teamId: 't1', name: 'A', score: 2 }),
      makeTeam({ teamId: 't2', name: 'B', score: 1, paletteKey: 'secondary' }),
    ]);
    // A região live contém o resumo "A 2, B 1".
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveTextContent('A 2, B 1');
  });

  it('não renderiza nada quando não há times', () => {
    const { container } = renderScoreboard([], true);
    expect(container).toBeEmptyDOMElement();
  });
});
