import React from 'react';
import { Box, CircularProgress, Skeleton, Typography, useTheme, alpha } from '@mui/material';
import { AppLogo } from './AppLogo';
import { useTranslation } from 'react-i18next';

interface LoadingScreenProps {
  message?: string;
  variant?: 'spinner' | 'skeleton' | 'cards' | 'splash';
}

/**
 * Tela de loading reutilizável com variantes skeleton.
 * Usada como fallback no Suspense para lazy-loaded routes.
 */
export const LoadingScreen = React.memo(function LoadingScreen({
  message,
  variant = 'cards',
}: LoadingScreenProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // #2188: variante splash com identidade visual do app (logo + gradiente),
  // usada no carregamento inicial em vez dos 3 skeleton cards cinzas.
  if (variant === 'splash') {
    return (
      <Box
        sx={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          gap: 3,
        }}
        role="status"
        aria-label={message || t('common.loading')}
      >
        <AppLogo
          size="xlarge"
          shape="circle"
          alt={t('alt.logo')}
          sx={{
            bgcolor: alpha(theme.palette.common.white, 0.2),
            animation: 'splashPulse 2s infinite',
            '@keyframes splashPulse': {
              '0%': { transform: 'scale(1)', opacity: 1 },
              '50%': { transform: 'scale(1.05)', opacity: 0.8 },
              '100%': { transform: 'scale(1)', opacity: 1 },
            },
          }}
        />
        <CircularProgress sx={{ color: 'primary.contrastText' }} />
        {message && (
          <Typography variant="body2" sx={{ color: alpha(theme.palette.primary.contrastText, 0.85) }}>
            {message}
          </Typography>
        )}
      </Box>
    );
  }

  if (variant === 'spinner') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100dvh',
          gap: 2,
        }}
        role="status"
        aria-label={message || t('common.loading')}
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
    <Box sx={{ p: 2 }} role="status" aria-label={message || t('common.loadingContent')}>
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
            boxShadow: (theme) => theme.shadows[4],
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
