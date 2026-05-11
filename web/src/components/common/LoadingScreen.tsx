import React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';

interface LoadingScreenProps {
  message?: string;
  variant?: 'spinner' | 'skeleton' | 'cards';
}

/**
 * Tela de loading reutilizável com variantes skeleton.
 * Usada como fallback no Suspense para lazy-loaded routes.
 */
export const LoadingScreen = React.memo(function LoadingScreen({
  message,
  variant = 'cards',
}: LoadingScreenProps) {
  if (variant === 'spinner') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
        }}
        role="status"
        aria-label={message || 'Carregando'}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            border: '3px solid',
            borderColor: 'primary.main',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            '@keyframes spin': {
              '0%': { transform: 'rotate(0deg)' },
              '100%': { transform: 'rotate(360deg)' },
            },
          }}
        />
        {message && (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  // Skeleton card list (padrão para loading de telas)
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={message || 'Carregando conteúdo'}>
      {/* Header skeleton */}
      <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />

      {/* Card skeletons */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Box
          key={i}
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 3,
            bgcolor: 'background.paper',
            boxShadow: (theme) => `0 2px 8px ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
            <Skeleton variant="circular" width={48} height={48} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={18} />
            </Box>
          </Box>
          <Skeleton variant="text" width="80%" height={18} />
          <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3, mt: 1.5 }} />
        </Box>
      ))}
    </Box>
  );
});
