import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography, Paper, useTheme } from '@mui/material';
import { useRatingHistory } from '../../hooks/useRatingHistory';
import { PlayerRatingRole } from '../../types/user';

interface RatingEvolutionChartProps {
  userId: string;
}

type RatingChartRow = { date: string } & Partial<Record<PlayerRatingRole, number>>;

const POSITION_NAMES: Record<string, string> = {
  STRIKER: 'Atacante',
  MID: 'Meio-campo',
  DEFENDER: 'Defensor',
  GOALKEEPER: 'Goleiro',
};

export const RatingEvolutionChart: React.FC<RatingEvolutionChartProps> = ({ userId }) => {
  const { history, loading, error } = useRatingHistory(userId);
  const theme = useTheme();

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography>Carregando histórico...</Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography color="error">Erro: {error}</Typography>
      </Paper>
    );
  }

  if (history.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography color="text.secondary">
          Nenhum histórico de ratings disponível ainda.
        </Typography>
      </Paper>
    );
  }

  const chartData = history
    .sort((a, b) => a.calculatedAt.getTime() - b.calculatedAt.getTime())
    .map((entry) => ({
      date: entry.calculatedAt.toLocaleDateString('pt-BR'),
      [entry.position]: entry.rating,
    }));

  const aggregated = chartData.reduce<RatingChartRow[]>((acc, curr) => {
    const existing = acc.find((item) => item.date === curr.date);
    if (existing) {
      Object.assign(existing, curr);
    } else {
      acc.push(curr);
    }
    return acc;
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Evolução dos Ratings
      </Typography>
      <Box sx={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={aggregated}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 5]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="STRIKER" stroke={theme.palette.warning.main} name={POSITION_NAMES.STRIKER} />
            <Line type="monotone" dataKey="MID" stroke={theme.palette.success.dark} name={POSITION_NAMES.MID} />
            <Line type="monotone" dataKey="DEFENDER" stroke={theme.palette.secondary.main} name={POSITION_NAMES.DEFENDER} />
            <Line type="monotone" dataKey="GOALKEEPER" stroke={theme.palette.success.light} name={POSITION_NAMES.GOALKEEPER} />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
