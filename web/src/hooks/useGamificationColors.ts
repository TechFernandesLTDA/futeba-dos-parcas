import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { gamificationColors, gamificationColorsDark, gamificationColorsOnLight } from '../theme';

export function useGamificationColors() {
  const theme = useTheme();
  return useMemo(
    () => (theme.palette.mode === 'dark' ? gamificationColorsDark : gamificationColors),
    [theme.palette.mode]
  );
}

/**
 * Paleta de gamificação segura como cor de TEXTO no tema atual (#4041).
 * Light → variantes escuras (`gamificationColorsOnLight`, >= 4.5:1 sobre
 * paper/default); Dark → `gamificationColorsDark`.
 */
export function useGamificationTextColors() {
  const theme = useTheme();
  return useMemo(
    () => (theme.palette.mode === 'dark' ? gamificationColorsDark : gamificationColorsOnLight),
    [theme.palette.mode]
  );
}
