import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';

const mockTeams = [
  { id: 'team-1', name: 'Flamengo', shortName: 'FLA', badgeUrl: null, category: 'Série A' },
  { id: 'team-2', name: 'Palmeiras', shortName: 'PAL', badgeUrl: null, category: 'Série A' },
  { id: 'team-3', name: 'Santos', shortName: 'SAN', badgeUrl: null, category: 'Série B' },
];

vi.mock('../../contexts/TeamsContext', () => ({
  useTeams: () => ({
    teams: mockTeams,
    teamsById: new Map(mockTeams.map(t => [t.id, t])),
    loading: false,
    error: null,
  }),
}));

import { TeamSelector } from './TeamSelector';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('TeamSelector', () => {
  it('renderiza label padrão', () => {
    renderWithTheme(<TeamSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Time do Coração')).toBeInTheDocument();
  });

  it('mostra label opcional quando optional=true', () => {
    renderWithTheme(<TeamSelector value={null} onChange={vi.fn()} optional={true} />);
    expect(screen.getByText('Time do Coração (opcional)')).toBeInTheDocument();
  });

  it('renderiza opções de times', async () => {
    const user = userEvent.setup();
    renderWithTheme(<TeamSelector value={null} onChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    expect(screen.getByText('Flamengo')).toBeInTheDocument();
    expect(screen.getByText('Palmeiras')).toBeInTheDocument();
  });

  it('chama onChange ao selecionar time', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithTheme(<TeamSelector value={null} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.click(screen.getByText('Flamengo'));

    expect(onChange).toHaveBeenCalledWith('team-1');
  });

  it('mostra placeholder de busca', () => {
    renderWithTheme(<TeamSelector value={null} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Buscar time...')).toBeInTheDocument();
  });

  it('mostra categoria dos times no dropdown', async () => {
    const user = userEvent.setup();
    renderWithTheme(<TeamSelector value={null} onChange={vi.fn()} />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    expect(screen.getByText('Série A')).toBeInTheDocument();
  });
});
