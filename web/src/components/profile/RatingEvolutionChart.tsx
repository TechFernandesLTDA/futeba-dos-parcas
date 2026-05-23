import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Box, Typography, Paper } from '@mui/material';
import { useRatingHistory } from '../../hooks/useRatingHistory';
import { RatingHistoryEntry } from '../../types/user';

interface RatingEvolutionChartProps {
  userId: string;
}

export const RatingEvolutionChart: React.FC<RatingEvolutionChartProps> = ({ userId }) => {
  const { history, loading, error } = useRatingHistory(userId);

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

  const aggregated = chartData.reduce((acc, curr) => {
    const existing = acc.find((item) => item.date === curr.date);
    if (existing) {
      Object.assign(existing, curr);
    } else {
      acc.push(curr);
    }
    return acc;
  }, [] as any[]);

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
            <Line type="monotone" dataKey="STRIKER" stroke="#ff7300" name="Atacante" />
            <Line type="monotone" dataKey="MID" stroke="#387908" name="Meio-campo" />
            <Line type="monotone" dataKey="DEFENDER" stroke="#8884d8" name="Defensor" />
            <Line type="monotone" dataKey="GOALKEEPER" stroke="#82ca9d" name="Goleiro" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
