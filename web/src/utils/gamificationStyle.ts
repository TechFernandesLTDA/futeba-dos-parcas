import { getGamificationColors } from './gamificationColors';
import type { Theme } from '@mui/material/styles';

// #2163: theme-aware — usa paleta dark mais brilhante em dark/OLED para contraste WCAG
export function getPositionBadgeStyle(position: number, theme: Theme) {
  const { palette } = theme;
  const colors = getGamificationColors(theme);
  switch (position) {
    case 1:
      return { bgcolor: colors.gold, color: palette.getContrastText(colors.gold) };
    case 2:
      return { bgcolor: colors.silver, color: palette.getContrastText(colors.silver) };
    case 3:
      return { bgcolor: colors.bronze, color: palette.getContrastText(colors.bronze) };
    default:
      return { bgcolor: theme.palette.action.disabledBackground, color: theme.palette.text.primary };
  }
}
