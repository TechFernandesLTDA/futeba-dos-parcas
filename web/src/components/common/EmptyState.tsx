import React from 'react';
import { Box, Typography, Button, SxProps, Theme } from '@mui/material';
import { SportsSoccer as SportsSoccerIcon } from '@mui/icons-material';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  actionVariant?: 'contained' | 'outlined' | 'text';
  sx?: SxProps<Theme>;
}

/**
 * Componente reutilizável para estados vazios (sem dados / sem resultados de filtro).
 * Usado em GamesTab, GroupsTab, HomeTab e outras listas.
 */
export const EmptyState = React.memo(function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionIcon,
  onAction,
  actionVariant = 'contained',
  sx,
}: EmptyStateProps) {
  return (
    <Box
      sx={{ textAlign: 'center', py: 8, ...sx }}
      role="status"
      aria-label={title}
    >
      <Box sx={{ mb: 2, '& > *': { fontSize: 64, color: 'text.disabled' } }}>
        {icon || <SportsSoccerIcon sx={{ fontSize: 64, color: 'text.disabled' }} />}
      </Box>
      <Typography variant="h6" color="text.secondary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button
          variant={actionVariant}
          startIcon={actionIcon}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
});
