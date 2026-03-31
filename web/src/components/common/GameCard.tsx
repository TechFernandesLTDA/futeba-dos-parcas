import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  LinearProgress,
  Skeleton,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  SportsSoccer as SoccerIcon,
  NavigateNext as NextIcon,
} from '@mui/icons-material';
import { Game, STATUS_CONFIG, FIELD_TYPE_LABELS } from '../../types/game';
import { formatGameDate } from '../../utils/dateFormatters';

interface GameCardProps {
  game: Game;
  onClick?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  isConfirmed?: boolean;
  showActions?: boolean;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onClick,
  onConfirm,
  onCancel,
  isConfirmed,
  showActions = false,
}) => {
  const theme = useTheme();
  const statusConfig = STATUS_CONFIG[game.status];
  const progress = (game.playersCount / game.maxPlayers) * 100;
  const isFull = game.playersCount >= game.maxPlayers;

  return (
    <Card
      onClick={onClick}
      sx={{
        mb: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        border: `1px solid ${theme.palette.divider}`,
        '&:hover': onClick ? {
          boxShadow: theme.shadows[4],
          transform: 'translateY(-2px)',
        } : {},
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Chip
                label={statusConfig.label}
                size="small"
                sx={{
                  backgroundColor: statusConfig.bgColor,
                  color: statusConfig.color,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }}
              />
              <Chip
                label={FIELD_TYPE_LABELS[game.fieldType] || game.fieldType}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem' }}
              />
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>
              {game.locationName}
            </Typography>
          </Box>
          {onClick && <NextIcon color="action" />}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <TimeIcon fontSize="small" />
            <Typography variant="body2">
              {formatGameDate(game.date)} às {game.time}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
            <LocationIcon fontSize="small" />
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {game.locationAddress}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PeopleIcon fontSize="small" color={isFull ? 'error' : 'primary'} />
              <Typography
                variant="body2"
                fontWeight={500}
                color={isFull ? 'error' : 'text.primary'}
              >
                {game.playersCount}/{game.maxPlayers} jogadores
              </Typography>
            </Box>
            {game.dailyPrice > 0 && (
              <Typography variant="body2" fontWeight={600} color="primary">
                R$ {game.dailyPrice.toFixed(2)}
              </Typography>
            )}
          </Box>

          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor: isFull ? theme.palette.error.main : theme.palette.primary.main,
              },
            }}
          />
        </Box>

        {game.groupName && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {game.groupName}
          </Typography>
        )}

        {showActions && game.status === 'SCHEDULED' && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            {!isConfirmed ? (
              <Button
                variant="contained"
                fullWidth
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm?.();
                }}
                disabled={isFull}
              >
                {isFull ? 'Lotado' : 'Confirmar'}
              </Button>
            ) : (
              <Button
                variant="outlined"
                color="error"
                fullWidth
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel?.();
                }}
              >
                Cancelar
              </Button>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

export const GameCardSkeleton: React.FC = () => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <Skeleton width={60} height={24} sx={{ borderRadius: 4 }} />
          <Skeleton width={80} height={24} sx={{ borderRadius: 4 }} />
        </Box>
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="40%" />
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton width={100} />
            <Skeleton width={60} />
          </Box>
          <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3, mt: 1 }} />
        </Box>
      </CardContent>
    </Card>
  );
};

export const StatusChip: React.FC<{
  status: string;
  config: Record<string, { label: string; color: string; bgColor?: string }>;
}> = React.memo(({ status, config }) => {
  const statusConfig = config[status] || { label: status, color: '#9E9E9E', bgColor: '#F5F5F5' };

  return (
    <Chip
      label={statusConfig.label}
      size="small"
      sx={{
        backgroundColor: statusConfig.bgColor || alpha(statusConfig.color, 0.1),
        color: statusConfig.color,
        fontWeight: 600,
        fontSize: '0.75rem',
      }}
    />
  );
});

export const PlayerAvatar: React.FC<{
  name: string;
  photoUrl?: string;
  size?: number;
  level?: number;
}> = React.memo(({ name, photoUrl, size = 40, level }) => {
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  return (
    <Box sx={{ position: 'relative' }}>
      <Avatar
        src={photoUrl}
        alt={name}
        sx={{
          width: size,
          height: size,
          bgcolor: photoUrl ? undefined : 'primary.main',
          fontSize: size * 0.4,
        }}
      >
        {!photoUrl && initial}
      </Avatar>
      {level && (
        <Box
          sx={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid white',
          }}
        >
          <Typography variant="caption" fontWeight={700} color="white" sx={{ fontSize: size * 0.25 }}>
            {level}
          </Typography>
        </Box>
      )}
    </Box>
  );
});

export const ShimmerLoading: React.FC<{ count?: number; type?: 'card' | 'list' }> = ({
  count = 3,
  type = 'card',
}) => {
  return (
    <Box role="status" aria-label="Carregando conteúdo">
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index}>
          {type === 'card' ? <GameCardSkeleton /> : <Skeleton variant="text" height={60} />}
        </Box>
      ))}
    </Box>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}> = ({ icon, title, description, action }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        px: 4,
        textAlign: 'center',
      }}
    >
      {icon || <SoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />}
      <Typography variant="h6" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2, maxWidth: 300 }}>
          {description}
        </Typography>
      )}
      {action && (
        <Button variant="contained" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Box>
  );
};

export const LoadingState: React.FC<{ shimmerCount?: number; itemType?: string }> = ({
  shimmerCount = 5,
  itemType = 'CARD',
}) => {
  return (
    <Box role="status" aria-label="Carregando conteúdo">
      {Array.from({ length: shimmerCount }).map((_, index) => (
        <Card key={index} sx={{ mb: 1 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Skeleton variant="circular" width={48} height={48} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
