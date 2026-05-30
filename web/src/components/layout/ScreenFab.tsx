import React from 'react';
import { Fab, type SxProps, type Theme } from '@mui/material';

interface ScreenFabProps {
  /** Ícone renderizado dentro do FAB. */
  icon: React.ReactNode;
  /** Handler de clique. */
  onClick: () => void;
  /** Descrição acessível — obrigatória para screen readers. */
  'aria-label': string;
  /** Cor do FAB (default 'primary'). */
  color?: 'primary' | 'secondary' | 'default' | 'error' | 'info' | 'success' | 'warning';
  /** Override de estilos específicos da tela (bottom/right/display etc). */
  sx?: SxProps<Theme>;
}

/**
 * #2178: FAB fixo no canto inferior direito, padronizado.
 *
 * Encapsula o padrão repetido em ~7 telas (GamesTab, GroupsTab, LeagueScreen,
 * LocationsMapScreen, PublicGamesMapScreen, ManageLocationsScreen,
 * LiveEventsScreen): `position: fixed; bottom: X; right: X; display xs/md`.
 *
 * O esqueleto comum (position, safe-area) é embutido; cada tela passa seus
 * valores específicos de `bottom`/`right`/`display` via `sx` (mesclado em
 * array exatamente como o FixedBottomBar faz).
 */
export const ScreenFab = React.memo(function ScreenFab({
  icon,
  onClick,
  'aria-label': ariaLabel,
  color = 'primary',
  sx,
}: ScreenFabProps) {
  return (
    <Fab
      color={color}
      aria-label={ariaLabel}
      onClick={onClick}
      sx={[
        {
          position: 'fixed',
          // #2270: safe-area para não ficar sob o home indicator (iPhone notch).
          pb: { xs: 'env(safe-area-inset-bottom, 0px)', md: 0 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {icon}
    </Fab>
  );
});

export default ScreenFab;
