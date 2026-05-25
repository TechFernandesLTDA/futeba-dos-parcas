import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
  alpha,
} from '@mui/material';
import { LocalFireDepartment } from '@mui/icons-material';
import { useGamificationColors } from '../../../hooks/useGamificationColors';
import { XP_VALUES } from '../../../types/gamification';

interface StreakWidgetProps {
  streak: number;
  bestStreak?: number;
  mb?: number;
}

function computeStreakBonus(streak: number): number {
  return streak >= 10 ? XP_VALUES.STREAK_10
    : streak >= 7 ? XP_VALUES.STREAK_7
    : streak >= 5 ? XP_VALUES.STREAK_5
    : streak >= 3 ? XP_VALUES.STREAK_3
    : 0;
}

export function StreakWidget({ streak, bestStreak = 0, mb = 3 }: StreakWidgetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const streakBonus = computeStreakBonus(streak);

  if (streak > 0) {
    return (
      <Card
        sx={{
          mb,
          bgcolor: alpha(gColors.streak, 0.08),
          border: `1px solid ${alpha(gColors.streak, 0.3)}`,
          borderRadius: 3,
        }}
      >
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <LocalFireDepartment sx={{ fontSize: 32, color: gColors.streak }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight="bold">
              {t('profile.streakGamesInARow', { count: streak })}
            </Typography>
            {streak >= bestStreak ? (
              <Typography variant="caption" sx={{ color: gColors.gold, fontWeight: 600 }}>
                {t('profile.streakBestRecord', { record: bestStreak })}
              </Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {t('profile.streakRecord', { record: bestStreak })}
              </Typography>
            )}
          </Box>
          {streakBonus > 0 && (
            <Chip
              label={`+${streakBonus} XP`}
              size="small"
              sx={{ bgcolor: alpha(gColors.streak, 0.15), color: gColors.streak, fontWeight: 600 }}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        mb,
        bgcolor: alpha(theme.palette.action.hover, 0.3),
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <LocalFireDepartment sx={{ fontSize: 32, color: 'text.disabled' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {t('profile.startStreak')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('profile.startStreakDesc')}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
