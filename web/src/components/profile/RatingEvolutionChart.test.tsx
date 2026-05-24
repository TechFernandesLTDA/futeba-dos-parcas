import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';

const mockHistory: { calculatedAt: Date; position: string; rating: number }[] = [];

vi.mock('../../hooks/useRatingHistory', () => ({
  useRatingHistory: () => ({
    history: mockHistory,
    loading: false,
    error: null,
  }),
}));

import { RatingEvolutionChart } from './RatingEvolutionChart';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('RatingEvolutionChart', () => {
  it('mostra título Evolução dos Ratings', () => {
    mockHistory.length = 0;
    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Evolução dos Ratings')).toBeInTheDocument();
  });

  it('mostra mensagem de vazio quando sem histórico', () => {
    mockHistory.length = 0;
    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Nenhum histórico de ratings disponível ainda.')).toBeInTheDocument();
  });

  it('renderiza linhas do gráfico quando há dados', () => {
    mockHistory.length = 0;
    mockHistory.push(
      { calculatedAt: new Date('2024-01-01'), position: 'STRIKER', rating: 4.5 },
      { calculatedAt: new Date('2024-02-01'), position: 'STRIKER', rating: 4.8 },
    );

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);

    expect(screen.queryByText('Nenhum histórico de ratings disponível ainda.')).not.toBeInTheDocument();
  });

  it('trata dados com múltiplas posições', () => {
    mockHistory.length = 0;
    mockHistory.push(
      { calculatedAt: new Date('2024-01-01'), position: 'STRIKER', rating: 4.0 },
      { calculatedAt: new Date('2024-01-01'), position: 'MID', rating: 3.5 },
    );

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
  });

  it('mostra loading state', () => {
    vi.mocked(vi.importActual('../../hooks/useRatingHistory') as Promise<unknown>);
    vi.doMock('../../hooks/useRatingHistory', () => ({
      useRatingHistory: () => ({
        history: [],
        loading: true,
        error: null,
      }),
    }));

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Carregando histórico...')).toBeInTheDocument();
  });

  it('mostra error state', () => {
    vi.doMock('../../hooks/useRatingHistory', () => ({
      useRatingHistory: () => ({
        history: [],
        loading: false,
        error: 'Falha ao carregar',
      }),
    }));

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Erro: Falha ao carregar')).toBeInTheDocument();
  });
});
