import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Chip,
  Typography,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  Payments as PaymentIcon,
  Navigation as NavIcon,
} from '@mui/icons-material';
import { getStatusChipColors } from '../../types/game';
import { formatGameDateLong } from '../../utils/dateFormatters';
import type { Game } from '../../types/game';

interface GameInfoPanelProps {
  game: Game;
}

export const GameInfoPanel: React.FC<GameInfoPanelProps> = ({ game }) => {
  const theme = useTheme();

  return (
    <>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {(() => {
              const sc = getStatusChipColors(theme, game.status);
              return (
                <Chip
                  label={sc.label}
                  size="small"
                  sx={{ backgroundColor: sc.bgColor, color: sc.color, fontWeight: 600, fontSize: '0.75rem' }}
                />
              );
            })()}
            {game.gameType && <Chip label={game.gameType} size="small" variant="outlined" />}
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <TimeIcon color="primary" />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {formatGameDateLong(game.date)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {game.time} {game.endTime && `- ${game.endTime}`}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <LocationIcon color="primary" sx={{ mt: 0.5 }} />
              <Box>
                <Typography variant="body1" fontWeight={500}>
                  {game.locationName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {game.locationAddress}
                </Typography>
                {game.locationLat && game.locationLng && (
                  <Button
                    size="small"
                    startIcon={<NavIcon />}
                    sx={{ mt: 1, p: 0 }}
                    onClick={() =>
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${game.locationLat},${game.locationLng}`,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    Navegar
                  </Button>
                )}
              </Box>
            </Box>

            {game.dailyPrice > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <PaymentIcon color="primary" />
                <Box>
                  <Typography variant="body1" fontWeight={500}>
                    R$ {game.dailyPrice.toFixed(2)} por jogador
                  </Typography>
                  {game.pixKey && (
                    <Typography variant="body2" color="text.secondary">
                      Pix: {game.pixKey}
                    </Typography>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                Jogadores
              </Typography>
            </Box>
            <Typography
              variant="h6"
              fontWeight={700}
              color={game.playersCount >= game.maxPlayers ? 'error' : 'primary'}
            >
              {game.playersCount}/{game.maxPlayers}
            </Typography>
          </Box>

          <Box
            sx={{
              width: '100%',
              height: 8,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              borderRadius: 4,
              mb: 1,
            }}
          >
            <Box
              sx={{
                width: `${(game.playersCount / game.maxPlayers) * 100}%`,
                height: '100%',
                bgcolor: game.playersCount >= game.maxPlayers ? 'error.main' : 'primary.main',
                borderRadius: 4,
                transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.standard }),
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Goleiros: {game.goalkeepersCount}/{game.maxGoalkeepers}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Lista: {game.playersCount}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </>
  );
};
