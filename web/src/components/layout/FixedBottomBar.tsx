import React, { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

interface FixedBottomBarProps {
  children: ReactNode;
  /** zIndex da barra (default 10). */
  zIndex?: number;
  sx?: SxProps<Theme>;
}

/**
 * #2178: barra de ação fixa no rodapé, padronizada.
 *
 * Extrai o padrão duplicado em ~14 telas (GameDetail, GroupDetail, LiveGame,
 * MVPVote, GamesScreen, GamesTab, GroupsTab, League, ManageLocations, ...):
 * `position: fixed; bottom: 0; centralizada em <=480px no desktop; fundo
 * background.paper; borda superior; padding 2`.
 *
 * Usa o token canônico `background.paper` (alinhado com BottomNavigation e os
 * sticky headers — #2273).
 */
export const FixedBottomBar = React.memo(function FixedBottomBar({
  children,
  zIndex = 10,
  sx,
}: FixedBottomBarProps) {
  return (
    <Box
      sx={[
        {
          position: 'fixed',
          bottom: 0,
          left: { xs: 0, sm: '50%' },
          right: { xs: 0, sm: 'auto' },
          transform: { sm: 'translateX(-50%)' },
          width: { xs: '100%', sm: 480 },
          maxWidth: 480,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 2,
          zIndex,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
});

export default FixedBottomBar;
