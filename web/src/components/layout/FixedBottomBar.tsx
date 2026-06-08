import React, { ReactNode } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { RAIL_WIDTH, DRAWER_WIDTH } from '../../config/navItems';
import { componentMaxWidth } from '../../theme/pageTokens';

interface FixedBottomBarProps {
  children: ReactNode;
  /** zIndex da barra (default 10). */
  zIndex?: number;
  /**
   * #2164: a tela vive dentro do AppLayout (com sidebar no desktop)? Default
   * true. Telas full-screen sem sidebar (ex.: LiveGame, MVPVote, rotas fora do
   * grupo AppLayout) devem passar `inLayout={false}` para centralizar no
   * viewport, sem o offset da sidebar.
   */
  inLayout?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * #2178: barra de ação fixa no rodapé, padronizada.
 *
 * Extrai o padrão duplicado em ~14 telas (GameDetail, GroupDetail, LiveGame,
 * MVPVote, GamesTab, GroupsTab, League, ManageLocations, ...):
 * `position: fixed; bottom: 0; centralizada em <=480px no desktop; fundo
 * background.paper; borda superior; padding 2`.
 *
 * Usa o token canônico `background.paper` (alinhado com BottomNavigation e os
 * sticky headers — #2273).
 *
 * #2164: a barra é centralizada na ÁREA DE CONTEÚDO, não no viewport. Como as
 * telas que a usam vivem dentro do AppLayout (sidebar de RAIL_WIDTH no md,
 * DRAWER_WIDTH no lg), o `left` é deslocado por metade da largura da sidebar
 * para não ficar torta para a direita.
 *
 * #2270: adiciona `env(safe-area-inset-bottom)` ao padding inferior para não
 * ficar sob o home indicator em iPhones com notch.
 */
export const FixedBottomBar = React.memo(function FixedBottomBar({
  children,
  zIndex = 10,
  inLayout = true,
  sx,
}: FixedBottomBarProps) {
  // #2164: dentro do AppLayout, desloca para centralizar na área de conteúdo
  // (compensa a sidebar). Fora do layout (full-screen), centraliza no viewport.
  const left = inLayout
    ? {
        xs: 0,
        sm: '50%',
        md: `calc(50% + ${RAIL_WIDTH / 2}px)`,
        lg: `calc(50% + ${DRAWER_WIDTH / 2}px)`,
      }
    : { xs: 0, sm: '50%' };

  return (
    <Box
      sx={[
        {
          position: 'fixed',
          bottom: 0,
          left,
          right: { xs: 0, sm: 'auto' },
          transform: { sm: 'translateX(-50%)' },
          width: { xs: '100%', sm: 480 },
          maxWidth: componentMaxWidth.bottomBar,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          p: 2,
          // #2270: padding inferior = 16px (p:2) + safe-area. No md+ não há
          // home indicator relevante, mas a expressão calc é inócua lá.
          pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
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
