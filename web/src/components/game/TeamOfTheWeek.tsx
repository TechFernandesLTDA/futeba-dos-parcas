import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { EmojiEvents as TrophyIcon } from '@mui/icons-material';
import { useWeeklyRanking } from '../../hooks/useWeeklyRanking';
import { useGamificationColors } from '../../hooks/useGamificationColors';
import { iconSizes } from '../../theme/iconSizes';
import { useTranslation } from 'react-i18next';

export const TeamOfTheWeek: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const gColors = useGamificationColors();
  const { data, isLoading } = useWeeklyRanking();

  if (isLoading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Skeleton width="40%" height={28} />
          <Stack direction="row" spacing={2} mt={2}>
            {[1, 2, 3].map((i) => (
              <Stack key={i} alignItems="center" spacing={1} flex={1}>
                <Skeleton variant="circular" width={48} height={48} />
                <Skeleton variant="text" width={60} />
                <Skeleton variant="text" width={40} />
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.rankings || data.rankings.length === 0) {
    return null;
  }

  const top5 = data.rankings.slice(0, 5);
  const medalColors = [gColors.gold, gColors.silver, gColors.bronze, 'text.secondary', 'text.secondary'];

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <TrophyIcon color="warning" />
          <Typography variant="h6" fontWeight="bold">
            {t('home.teamOfTheWeek')}
          </Typography>
          <Chip
            label={t('home.round', { week: data.weekKey })}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Stack>

        <Stack direction="row" spacing={1} justifyContent="space-around" flexWrap="wrap" useFlexGap>
          {top5.map((player, index) => {
            const positionLabels = [1, 2, 3, 4, 5];
            return (
              <Stack
                key={player.userId}
                alignItems="center"
                spacing={0.5}
                sx={{ cursor: 'pointer', flex: 1, maxWidth: 80 }}
                onClick={() => navigate(`/profile/${player.userId}`)}
              >
                {index < 3 ? (
                  <TrophyIcon sx={{ color: medalColors[index], fontSize: iconSizes.md }} />
                ) : (
                  <Typography variant="body2" fontWeight="bold" fontSize="0.75rem">
                    {positionLabels[index]}º
                  </Typography>
                )}
                <Avatar
                  src={player.userPhoto}
                  sx={{
                    width: 44,
                    height: 44,
                    border: '2px solid',
                    borderColor: medalColors[index],
                  }}
                >
                  {player.userName?.charAt(0) || '?'}
                </Avatar>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ maxWidth: '100%', fontSize: '0.75rem' }}
                  title={player.userName}
                >
                  {player.userName?.split(' ')[0] || '?'}
                </Typography>
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  color="primary"
                  fontSize="0.75rem"
                >
                  {player.points} pts
                </Typography>
              </Stack>
            );
          })}
        </Stack>
        <Button
          variant="text"
          color="primary"
          size="small"
          fullWidth
          onClick={() => navigate('/weekly-ranking')}
          sx={{ mt: 1 }}
        >
          {t('home.viewFullRanking')}
        </Button>
      </CardContent>
    </Card>
  );
};
