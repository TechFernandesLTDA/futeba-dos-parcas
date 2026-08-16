import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { Box, useTheme } from '@mui/material';
import { ScreenHeader } from '../../components/common/ScreenHeader';
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
      {/* Header da página
          #4051: migrado para ScreenHeader (não-sticky, esta tela gerencia o
          próprio scroll interno) — o header manual empilhava com a MobileTopBar
          global no mobile (2 botões "Voltar", 2 títulos "Buscar"). O título
          cru "Buscar" também virou a chave i18n page.title.search. */}
      <ScreenHeader
        title={t('page.title.search')}
        onBack={navigateBack}
        backAriaLabel={t('a11y.back')}
        sticky={false}
        headerSx={{
          bgcolor: 'background.paper',
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
        }}
      />

      {/* SearchPanel ocupa o restante da altura */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SearchPanel onClose={handleClose} />
      </Box>
    </Box>
  );
};
