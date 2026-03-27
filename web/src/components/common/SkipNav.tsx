import React from 'react';
import { Box, Link } from '@mui/material';

/**
 * Link de navegação para acessibilidade (skip to content).
 * Visível apenas com foco do teclado, pula direto para o conteúdo principal.
 */
export const SkipNav = React.memo(function SkipNav() {
  return (
    <Box
      component="nav"
      aria-label="Pular navegação"
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
        Pular para o conteúdo
      </Link>
    </Box>
  );
});
