import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { SearchPanel } from '../../components/search/SearchPanel';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';

/**
 * Tela full-page de busca global — preservada como deeplink em /search.
 * O conteúdo de busca é fornecido pelo SearchPanel reutilizável,
 * que também é usado no CommandPalette (Cmd+K).
 *
 * Ao fechar via onClose, navega para / pois não há histórico de rota
 * anterior garantido em acessos diretos via URL.
 */
export const GlobalSearchScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.search'));
  const navigate = useNavigate();
  const navigateBack = useNavigateBack();
  const theme = useTheme();

  const handleClose = () => {
    navigate('/');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* Header da página */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
          flexShrink: 0,
        }}
      >
        <IconButton onClick={navigateBack} aria-label="Voltar">
          <BackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ ml: 1 }}>
          Buscar
        </Typography>
      </Box>

      {/* SearchPanel ocupa o restante da altura */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SearchPanel onClose={handleClose} />
      </Box>
    </Box>
  );
};
