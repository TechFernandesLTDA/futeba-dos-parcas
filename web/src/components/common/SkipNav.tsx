import React from 'react';
import { Box, Link } from '@mui/material';
import { useTranslation } from 'react-i18next';

/**
 * Link de navegação para acessibilidade (skip to content).
 * Visível apenas com foco do teclado, pula direto para o conteúdo principal.
 */
export const SkipNav = React.memo(function SkipNav() {
  const { t } = useTranslation();
  return (
    <Box
      component="nav"
      aria-label={t('a11y.skipNav')}
      sx={{
        position: 'absolute',
        top: -9999,
        left: -9999,
        '&:focus-within': {
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: 9999,
        },
      }}
    >
      <Link
        href="#main-content"
        sx={{
          display: 'inline-block',
          px: 2,
          py: 1,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: 1,
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          '&:focus': {
            outline: '2px solid',
            outlineColor: 'primary.dark',
            outlineOffset: 2,
          },
        }}
      >
        {t('a11y.skipToContent')}
      </Link>
    </Box>
  );
});
