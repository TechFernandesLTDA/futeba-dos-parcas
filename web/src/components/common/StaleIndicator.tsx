import React from 'react';
import { Box, Tooltip, Typography, useTheme } from '@mui/material';
import { AccessTime as TimeIcon } from '@mui/icons-material';
import { iconSizes } from '../../theme/iconSizes';

interface StaleIndicatorProps {
  updatedAt: number | Date | null | undefined;
  staleThresholdMs?: number;
  onRefresh?: () => void;
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export const StaleIndicator: React.FC<StaleIndicatorProps> = ({
  updatedAt,
  staleThresholdMs = 5 * 60 * 1000,
  onRefresh,
}) => {
  const theme = useTheme();

  if (!updatedAt) return null;

  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  const diffMs = Date.now() - date.getTime();
  const isStale = diffMs > staleThresholdMs;
  const isFresh = diffMs < 60_000;

  if (isFresh) return null;

  const relativeText = formatRelativeTime(date);

  return (
    <Tooltip
      title={`Atualizado em ${date.toLocaleString('pt-BR')}${onRefresh ? '. Toque para atualizar.' : ''}`}
      arrow
    >
      <Box
        component={onRefresh ? 'button' : 'div'}
        onClick={onRefresh}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          border: 'none',
          bgcolor: isStale
            ? `${theme.palette.warning.main}14`
            : 'transparent',
          cursor: onRefresh ? 'pointer' : 'default',
          transition: (t) => t.transitions.create('background-color', { duration: t.transitions.duration.shorter }),
          '&:hover': onRefresh
            ? { bgcolor: `${theme.palette.warning.main}29` }
            : {},
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: isStale ? 'warning.main' : 'success.main',
          }}
        />
        <TimeIcon sx={{ fontSize: iconSizes.xs, color: 'text.secondary' }} />
        <Typography
          variant="caption"
          sx={{
            color: isStale ? 'warning.main' : 'text.secondary',
            fontWeight: isStale ? 600 : 400,
          }}
        >
          {relativeText}
        </Typography>
      </Box>
    </Tooltip>
  );
};
