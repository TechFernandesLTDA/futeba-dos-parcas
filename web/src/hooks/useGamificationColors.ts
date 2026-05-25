import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { gamificationColors, gamificationColorsDark } from '../theme';

export function useGamificationColors() {
  const theme = useTheme();
  return useMemo(
    () => (theme.palette.mode === 'dark' ? gamificationColorsDark : gamificationColors),
    [theme.palette.mode]
  );
}
