import React, { useRef } from 'react';
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
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
  People as PeopleIcon,
  SportsSoccer as SoccerIcon,
  NavigateNext as NextIcon,
  Share as ShareIcon,
  Link as LinkIcon,
  Cancel as CancelIcon,
  Warning as ConflictIcon,
} from '@mui/icons-material';
import { Game, FIELD_TYPE_LABELS, getStatusChipColors, ConfirmationPaletteKey } from '../../types/game';
import { formatGameDate } from '../../utils/dateFormatters';
import { InteractiveCard } from './InteractiveCard';
import { useContextMenu, ContextMenuItem } from '../../hooks/useContextMenu';
import { TeamBadge } from '../team/TeamBadge';

interface GameCardProps {
  game: Game;
  onClick?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  isConfirmed?: boolean;
  showActions?: boolean;
  hasConflict?: boolean;
  // Props para menu de contexto
  currentUserId?: string;
  onCancelGame?: () => void;
  onShare?: () => void;
  onCopyLink?: () => void;
}

// #2137: theme-aware — usa theme.palette.success.main em vez de verde hardcoded,
// preservando contraste do pulse "LIVE" em dark/OLED.
const makePulseKeyframes = (color: string) => ({
  '@keyframes pulse': {
    '0%': { opacity: 1, boxShadow: `0 0 0 0 ${alpha(color, 0.4)}` },
    '70%': { opacity: 0.6, boxShadow: `0 0 0 6px ${alpha(color, 0)}` },
    '100%': { opacity: 1, boxShadow: `0 0 0 0 ${alpha(color, 0)}` },
  },
});

function getCountdown(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const [day, month, year] = dateStr.split('/').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (!day || !month || !year || isNaN(hours) || isNaN(minutes)) return null;
  const gameDate = new Date(year, month - 1, day, hours, minutes);
  const diffMs = gameDate.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalMinutes = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `Em ${h}h ${m}min`;
  if (h > 0) return `Em ${h}h`;
  return `Em ${m}min`;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onClick,
  onConfirm,
  onCancel,
  isConfirmed,
  showActions = false,
  hasConflict = false,
  currentUserId,
  onCancelGame,
  onShare,
  onCopyLink,
}) => {
  const theme = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const statusConfig = getStatusChipColors(theme, game.status);
  const progress = game.maxPlayers > 0 ? (game.playersCount / game.maxPlayers) * 100 : 0;
  const isFull = game.playersCount >= game.maxPlayers;
  const countdown = game.status === 'SCHEDULED' ? getCountdown(game.date, game.time) : null;

  // Dono do jogo pode cancelar; nao-donos nao veem a opcao
  const isGameOwner = Boolean(currentUserId && game.ownerId === currentUserId);
  const canCancelViaMenu =
    isGameOwner &&
    Boolean(onCancelGame) &&
    (game.status === 'SCHEDULED' || game.status === 'CONFIRMED');

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: 'share',
      label: 'Compartilhar',
      icon: <ShareIcon fontSize="small" />,
      onClick: onShare ?? (() => {}),
      hidden: !onShare,
    },
    {
      id: 'copy-link',
      label: 'Copiar link',
      icon: <LinkIcon fontSize="small" />,
      onClick: onCopyLink ?? (() => {}),
      hidden: !onCopyLink,
    },
    {
      id: 'cancel-game',
      label: 'Cancelar jogo',
      icon: <CancelIcon fontSize="small" color="error" />,
      onClick: onCancelGame ?? (() => {}),
      hidden: !canCancelViaMenu,
      color: 'error',
    },
  ];

  const menu = useContextMenu(contextMenuItems);

  return (
    <>
      <InteractiveCard
        ref={cardRef}
        onClick={onClick}
        actionAreaLabel={`Jogo em ${game.locationName} as ${game.time}`}
        onContextMenu={menu.visibleItems.length > 0 ? menu.handleContextMenu : undefined}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          menu.handleKeyboardContextMenu(e, cardRef.current);
        }}
        sx={{
          mb: 2,
          border: `1px solid ${theme.palette.divider}`,
          '&:focus-visible': onClick
            ? { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 }
            : {},
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                {game.status === 'LIVE' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: theme.palette.success.main,
                        animation: 'pulse 1.5s infinite ease-in-out',
                        ...makePulseKeyframes(theme.palette.success.main),
                      }}
                    />
                    <Chip
                      label={statusConfig.label}
                      size="small"
                      sx={{
                        backgroundColor: statusConfig.bgColor,
                        color: statusConfig.color,
                        fontWeight: 600,
                        fontSize: '0.75rem',
                      }}
                    />
                  </Box>
                ) : (
                  <Chip
                    label={statusConfig.label}
                    size="small"
                    sx={{
                      backgroundColor: statusConfig.bgColor,
                      color: statusConfig.color,
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  />
                )}
                <Chip
                  label={FIELD_TYPE_LABELS[game.fieldType] || game.fieldType}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
                {hasConflict && (
                  <Tooltip title="Jogo com horario conflitante" arrow>
                    <Chip
                      icon={<ConflictIcon sx={{ fontSize: 14 }} />}
                      label="Conflito"
                      size="small"
                      sx={{
                        backgroundColor: alpha(theme.palette.warning.main, 0.12),
                        color: theme.palette.mode === 'dark'
                          ? theme.palette.warning.light
                          : theme.palette.warning.dark,
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        '& .MuiChip-icon': {
                          color: theme.palette.mode === 'dark'
                            ? theme.palette.warning.light
                            : theme.palette.warning.dark,
                        },
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
              {game.status === 'FINISHED' && (game.team1Score > 0 || game.team2Score > 0) && (
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.25 }}>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    {game.team1Score}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                    vs
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    {game.team2Score}
                  </Typography>
                </Box>
              )}
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
                {formatGameDate(game.date)} as {game.time}
              </Typography>
              {countdown && (
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    ml: 0.5,
                    color: theme.palette.warning.main,
                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                  }}
                >
                  {countdown}
                </Typography>
              )}
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
                backgroundColor: alpha(
                  game.status === 'CONFIRMED' ? theme.palette.success.main : theme.palette.primary.main,
                  0.1
                ),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: isFull
                    ? theme.palette.error.main
                    : game.status === 'CONFIRMED'
                      ? theme.palette.success.main
                      : theme.palette.primary.main,
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
      </InteractiveCard>

      {menu.visibleItems.length > 0 && (
        <Menu
          open={Boolean(menu.anchorPosition)}
          onClose={menu.handleClose}
          anchorReference="anchorPosition"
          anchorPosition={menu.anchorPosition ?? undefined}
          aria-label="Menu de acoes do jogo"
        >
          {menu.visibleItems.map((item: ContextMenuItem) => (
            <MenuItem
              key={item.id}
              onClick={() => menu.handleItemClick(item)}
              disabled={item.disabled}
              sx={item.color === 'error' ? { color: 'error.main' } : undefined}
            >
              {item.icon && (
                <ListItemIcon sx={item.color === 'error' ? { color: 'error.main' } : undefined}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText>{item.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
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

/**
 * StatusChip aceita configurações com paletteKey (theme-aware, fix #761)
 * ou color direto (legado) para compatibilidade.
 */
export const StatusChip: React.FC<{
  status: string;
  config: Record<string, { label: string; paletteKey?: ConfirmationPaletteKey; color?: string; bgColor?: string }>;
}> = React.memo(({ status, config }) => {
  const theme = useTheme();
  const entry = config[status];

  // Resolve cores via paletteKey (theme-aware) ou fallback para color direto
  let color: string;
  let bgColor: string;
  let label: string;

  if (!entry) {
    label = status;
    color = theme.palette.text.disabled;
    bgColor = theme.palette.action.disabledBackground;
  } else if (entry.paletteKey) {
    label = entry.label;
    if (entry.paletteKey === 'default') {
      color = theme.palette.text.disabled;
      bgColor = theme.palette.action.hover;
    } else {
      const paletteEntry = theme.palette[entry.paletteKey];
      const isDark = theme.palette.mode === 'dark';
      color = isDark ? paletteEntry.light : paletteEntry.dark;
      bgColor = entry.bgColor ?? `${paletteEntry.main}1F`;
    }
  } else {
    label = entry.label;
    color = entry.color ?? theme.palette.text.disabled;
    bgColor = entry.bgColor ?? alpha(color, 0.1);
  }

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        backgroundColor: bgColor,
        color: color,
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
  teamId?: string | null;
  borderColor?: string;
}> = React.memo(({ name, photoUrl, size = 40, level, teamId, borderColor }) => {
  const theme = useTheme();
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  React.useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [photoUrl]);

  const showInitials = !photoUrl || imgError;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ position: 'relative' }}>
        {photoUrl && !imgLoaded && !imgError && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
            }}
          >
            <Skeleton
              variant="circular"
              width={size}
              height={size}
              sx={{ display: 'block' }}
            />
          </Box>
        )}
        <Avatar
          src={imgError ? undefined : photoUrl}
          alt={name}
          sx={{
            width: size,
            height: size,
            bgcolor: showInitials ? 'primary.main' : undefined,
            fontSize: size * 0.4,
            opacity: imgLoaded || showInitials ? 1 : 0,
            border: borderColor ? `3px solid ${borderColor}` : undefined,
          }}
          imgProps={photoUrl ? {
            onLoad: () => setImgLoaded(true),
            onError: () => setImgError(true),
            loading: 'lazy',
          } : undefined}
        >
          {showInitials ? initial : null}
        </Avatar>
        {level !== undefined && level > 0 && (
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
              border: `2px solid ${theme.palette.primary.contrastText}`,
            }}
          >
            <Typography variant="caption" fontWeight={700} sx={{ color: theme.palette.primary.contrastText, fontSize: size * 0.25 }}>
              {level}
            </Typography>
          </Box>
        )}
      </Box>
      <TeamBadge teamId={teamId} size={18} />
    </Box>
  );
});

export const ShimmerLoading: React.FC<{ count?: number; type?: 'card' | 'list' }> = ({
  count = 3,
  type = 'card',
}) => {
  return (
    <Box role="status" aria-label="Carregando conteudo">
      {Array.from({ length: count }).map((_, index) => (
        <Box key={index}> {/* list never reorders — static shimmer array */}
          {type === 'card' ? <GameCardSkeleton /> : <Skeleton variant="text" height={60} />}
        </Box>
      ))}
    </Box>
  );
};

/**
 * @deprecated #2176 — use `EmptyState` de `components/common/EmptyState.tsx`
 * (com ícone circular, fade-in e variantes contextuais). Este export legado
 * (assinatura `action: { label, onClick }`) será removido após migração dos
 * consumidores. Mantido por compat até lá.
 */
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
  itemType: _itemType = 'CARD',
}) => {
  return (
    <Box role="status" aria-label="Carregando conteudo">
      {Array.from({ length: shimmerCount }).map((_, index) => (
        <Card key={index} sx={{ mb: 1 }}> {/* list never reorders — static shimmer array */}
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
