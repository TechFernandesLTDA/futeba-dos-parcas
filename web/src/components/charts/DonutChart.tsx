import React, { useMemo } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface DonutChartProps {
  wins: number;
  draws: number;
  losses: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  noDataLabel?: string;
  totalLabel?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  wins,
  draws,
  losses,
  total,
  size = 120,
  strokeWidth = 18,
  noDataLabel,
  totalLabel,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  // Usa chave i18n como fallback quando caller não passa o prop
  const resolvedNoDataLabel = noDataLabel ?? t('components.donutChart.noData');
  const resolvedTotalLabel = totalLabel ?? t('components.donutChart.totalLabel');
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments = useMemo(() => {
    if (total === 0) return [];
    return [
      { value: wins, arc: (wins / total) * circumference, color: theme.palette.success.main, offset: 0 },
      { value: draws, arc: (draws / total) * circumference, color: theme.palette.warning.main, offset: (wins / total) * circumference },
      { value: losses, arc: (losses / total) * circumference, color: theme.palette.error.main, offset: ((wins + draws) / total) * circumference },
    ].filter(s => s.value > 0);
  }, [wins, draws, losses, total, circumference, theme.palette.success.main, theme.palette.warning.main, theme.palette.error.main]);

  if (total === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
        <svg width={size} height={size} aria-label={resolvedNoDataLabel}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={theme.palette.action.disabledBackground}
            strokeWidth={strokeWidth}
          />
          <text
            x={center}
            y={center + 5}
            textAnchor="middle"
            fontSize="11"
            fill={theme.palette.text.disabled}
          >
            {resolvedNoDataLabel}
          </text>
        </svg>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1 }}>
      <svg
        width={size}
        height={size}
        aria-label={`${wins} vitórias, ${draws} empates, ${losses} derrotas`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={theme.palette.action.disabledBackground}
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${seg.arc} ${circumference}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${center} ${center})`}
            strokeLinecap="butt"
          />
        ))}
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          fontSize="18"
          fontWeight="bold"
          fill={theme.palette.text.primary}
        >
          {total}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          fontSize="10"
          fill={theme.palette.text.secondary}
        >
          {resolvedTotalLabel}
        </text>
      </svg>
      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
          <Typography variant="caption">V: {wins}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'warning.main' }} />
          <Typography variant="caption">E: {draws}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main' }} />
          <Typography variant="caption">D: {losses}</Typography>
        </Box>
      </Box>
    </Box>
  );
};
