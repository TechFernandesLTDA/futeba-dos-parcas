import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';

const mockHistory: { calculatedAt: Date; position: string; rating: number }[] = [];
let mockLoading = false;
let mockError: string | null = null;

vi.mock('../../hooks/useRatingHistory', () => ({
  useRatingHistory: () => ({
    history: mockHistory,
    loading: mockLoading,
    error: mockError,
  }),
}));

import { RatingEvolutionChart } from './RatingEvolutionChart';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('RatingEvolutionChart', () => {
  beforeEach(() => {
    mockHistory.length = 0;
    mockLoading = false;
    mockError = null;
  });

  it('mostra título Evolução dos Ratings quando há dados', () => {
    // O título só aparece quando há dados (componente retorna empty-state se vazio)
    mockHistory.push(
      { calculatedAt: new Date('2024-01-01'), position: 'STRIKER', rating: 4.5 },
    );
    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Evolução dos Ratings')).toBeInTheDocument();
  });

  it('mostra mensagem de vazio quando sem histórico', () => {
    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Nenhum histórico de ratings disponível ainda.')).toBeInTheDocument();
  });

  it('renderiza linhas do gráfico quando há dados', () => {
    mockHistory.push(
      { calculatedAt: new Date('2024-01-01'), position: 'STRIKER', rating: 4.5 },
      { calculatedAt: new Date('2024-02-01'), position: 'STRIKER', rating: 4.8 },
    );

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);

    expect(screen.queryByText('Nenhum histórico de ratings disponível ainda.')).not.toBeInTheDocument();
  });

  it('trata dados com múltiplas posições', () => {
    mockHistory.push(
      { calculatedAt: new Date('2024-01-01'), position: 'STRIKER', rating: 4.0 },
      { calculatedAt: new Date('2024-01-01'), position: 'MID', rating: 3.5 },
    );

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);

    // Sem mensagem de vazio quando há dados
    expect(screen.queryByText('Nenhum histórico de ratings disponível ainda.')).not.toBeInTheDocument();
  });

  it('mostra loading state', () => {
    mockLoading = true;

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Carregando histórico...')).toBeInTheDocument();
  });

  it('mostra error state', () => {
    mockError = 'Falha ao carregar';

    renderWithTheme(<RatingEvolutionChart userId="user-1" />);
    expect(screen.getByText('Erro: Falha ao carregar')).toBeInTheDocument();
  });
});
