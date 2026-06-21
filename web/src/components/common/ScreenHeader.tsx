import React, { ReactNode } from 'react';
import {
  Box,
  IconButton,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { pageSpacing } from '../../theme/pageTokens';

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  backAriaLabel?: string;
  actions?: ReactNode;
  component?: React.ElementType;
  sticky?: boolean;
  sx?: SxProps<Theme>;
  headerSx?: SxProps<Theme>;
}

/**
 * Reusable screen header with back button + title + optional action buttons.
 *
 * Replaces ~40+ duplicated Box/IconButton/Typography patterns across screens
 * that all follow the same structure.
 */
export const ScreenHeader = React.memo(function ScreenHeader({
  title,
  onBack,
  backAriaLabel = 'Voltar',
  actions,
  component = 'h1',
  sticky = true,
  sx,
  headerSx,
}: ScreenHeaderProps) {
  const header = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        p: 1,
        minWidth: 0,
        ...headerSx,
      }}
    >
      {onBack && (
        <IconButton onClick={onBack} aria-label={backAriaLabel} edge="start">
          <BackIcon />
        </IconButton>
      )}
      <Typography
        variant="h6"
        component={component}
        noWrap
        sx={{ ml: onBack ? 1 : 0, flex: 1, minWidth: 0 }}
      >
        {title}
      </Typography>
      {actions && <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>{actions}</Box>}
    </Box>
  );

  if (!sticky) {
    return header;
  }

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        // #2273: token canônico de sticky header = background.paper (igual BottomNavigation),
        // padronizando o fundo dos headers entre todas as telas.
        bgcolor: 'background.paper',
        zIndex: 10,
        borderBottom: 1,
        borderColor: 'divider',
        height: pageSpacing.headerHeight,
        ...sx,
      }}
    >
      {header}
    </Box>
  );
});

export default ScreenHeader;
