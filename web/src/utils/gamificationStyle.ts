import { gamificationColors } from '../theme';
import type { Theme } from '@mui/material/styles';

export function getPositionBadgeStyle(position: number, theme: Theme) {
  const { palette } = theme;
  switch (position) {
    case 1:
      return { bgcolor: gamificationColors.gold, color: palette.getContrastText(gamificationColors.gold) };
    case 2:
      return { bgcolor: gamificationColors.silver, color: palette.getContrastText(gamificationColors.silver) };
    case 3:
      return { bgcolor: gamificationColors.bronze, color: palette.getContrastText(gamificationColors.bronze) };
    default:
      return { bgcolor: theme.palette.action.disabledBackground, color: theme.palette.text.primary };
  }
}
