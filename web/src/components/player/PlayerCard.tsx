import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Avatar,
  LinearProgress,
  Skeleton,
  IconButton,
  Button,
  Tooltip,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Share as ShareIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  Whatshot as FireIcon,
  StarRate as StarIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { usePlayerCard } from '../../hooks/usePlayerCard';
import { useToast } from '../../contexts/ToastContext';
import { iconSizes } from '../../theme/iconSizes';
import { createLogger } from '../../utils/logger';
import { TeamBadge } from '../team/TeamBadge';
import {
  getLevelEntry,
  getXpProgress,
  getXpRemaining,
} from '../../types/gamification';
import { getLevelColor, getLevelTextColor } from '../../types/user';
import { useGamificationColors } from '../../hooks/useGamificationColors';

const logger = createLogger('PlayerCard');
const PLAYER_CARD_CORNER_RADIUS = '6px';
const PLAYER_CARD_INNER_CORNER_RADIUS = '4px';

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: string;
}

const StatTile: React.FC<StatTileProps> = ({ icon, label, value, tone }) => {
  const theme = useTheme();

  return (
    <Box
      role="listitem"
      aria-label={`${label}: ${value}`}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: { xs: 2, sm: 2.25 },
        p: { xs: 1, sm: 1.25 },
        minHeight: { xs: 64, sm: 78 },
        bgcolor: alpha(theme.palette.background.paper, 0.74),
        border: `1px solid ${alpha(tone, 0.24)}`,
        boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.3)}`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: -12,
          top: -14,
          width: { xs: 46, sm: 54 },
          height: { xs: 46, sm: 54 },
          borderRadius: '50%',
          bgcolor: alpha(tone, 0.13),
        }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontSize: { xs: '0.58rem', sm: '0.66rem' },
            lineHeight: 1.1,
          }}
        >
          {label}
        </Typography>
        <Box
          sx={{
            width: { xs: 24, sm: 28 },
            height: { xs: 24, sm: 28 },
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: tone,
            bgcolor: alpha(tone, 0.12),
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography
        sx={{
          color: 'text.primary',
          fontWeight: 950,
          fontSize: { xs: '1.32rem', sm: '1.55rem' },
          lineHeight: 1,
          mt: { xs: 0.7, sm: 1.1 },
          letterSpacing: '-0.04em',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
};

interface AttributeLaneProps {
  label: string;
  value: number;
  tone: string;
}

const AttributeLane: React.FC<AttributeLaneProps> = ({ label, value, tone }) => {
  const theme = useTheme();
  const normalized = Math.max(0, Math.min(value, 5));
  const percent = Math.round((normalized / 5) * 100);

  return (
    <Box
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={normalized}
      sx={{ minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 0.75, mb: { xs: 0.35, sm: 0.55 } }}>
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.common.white, 0.76),
            fontWeight: 900,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontSize: { xs: '0.58rem', sm: '0.66rem' },
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.common.white,
            fontWeight: 950,
            fontSize: { xs: '0.7rem', sm: '0.78rem' },
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {normalized > 0 ? normalized.toFixed(1) : '--'}
        </Typography>
      </Box>
      <Box
        sx={{
          height: { xs: 7, sm: 9 },
          borderRadius: 999,
          bgcolor: alpha(theme.palette.common.black, 0.28),
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.common.white, 0.09)}`,
        }}
      >
        <Box
          sx={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${tone}, ${alpha(theme.palette.common.white, 0.9)})`,
            boxShadow: normalized > 0 ? `0 0 18px ${alpha(tone, 0.4)}` : 'none',
            transition: (transitionTheme) => transitionTheme.transitions.create('width', { duration: 700 }),
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          }}
        />
      </Box>
    </Box>
  );
};

const PlayerCardSkeleton: React.FC = () => {
  const theme = useTheme();

  return (
    <Box sx={{ p: 2.5 }}>
      <Skeleton variant="rounded" height={76} sx={{ bgcolor: alpha(theme.palette.common.white, 0.12), borderRadius: 3, mb: 2 }} />
      <Skeleton variant="circular" width={132} height={132} sx={{ bgcolor: alpha(theme.palette.common.white, 0.12), mx: 'auto', mb: 2 }} />
      <Skeleton variant="rounded" height={104} sx={{ bgcolor: alpha(theme.palette.common.white, 0.12), borderRadius: 3, mb: 2 }} />
      <Skeleton variant="rounded" height={170} sx={{ bgcolor: alpha(theme.palette.common.white, 0.12), borderRadius: 3 }} />
    </Box>
  );
};

interface EmptyStateCardProps {
  error: string | null;
  onRetry: () => void;
}

const EmptyStateCard: React.FC<EmptyStateCardProps> = ({ error, onRetry }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box sx={{ textAlign: 'center', px: 3, py: 7 }}>
      <Typography color={error ? 'error.light' : 'text.secondary'} gutterBottom>
        {error ? t('player.card.loadError') : t('player.card.ariaLabel')}
      </Typography>
      {error && (
        <Button
          variant="outlined"
          size="small"
          onClick={onRetry}
          sx={{
            color: theme.palette.common.white,
            borderColor: alpha(theme.palette.common.white, 0.5),
            '&:hover': {
              borderColor: theme.palette.common.white,
              bgcolor: alpha(theme.palette.common.white, 0.08),
            },
          }}
        >
          {t('player.card.retry')}
        </Button>
      )}
    </Box>
  );
};

function getRatingValue(primary: number, fallback: number): number {
  return primary > 0 ? primary : fallback;
}

type CardEdition = 'legend' | 'elite' | 'pro' | 'rising' | 'rookie';

function getCardEdition(level: number): CardEdition {
  if (level >= 20) return 'legend';
  if (level >= 15) return 'elite';
  if (level >= 10) return 'pro';
  if (level >= 5) return 'rising';
  return 'rookie';
}

function getFitPlayerName(name: string): string {
  return name.trim().slice(0, 32);
}

function getPositionCode(position?: string | null): string {
  switch (position) {
    case 'ATACANTE':
      return 'ATQ';
    case 'GOLEIRO':
      return 'GOL';
    case 'LATERAL':
      return 'LAT';
    case 'MEIA':
      return 'MEI';
    case 'VOLANTE':
      return 'VOL';
    case 'ZAGUEIRO':
      return 'ZAG';
    default:
      return '--';
  }
}

async function renderShareCanvas(
  source: HTMLElement,
  html2canvas: typeof import('html2canvas').default
): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;

  const sourceWidth = Math.ceil(source.getBoundingClientRect().width || source.offsetWidth);
  const clone = source.cloneNode(true) as HTMLElement;
  const host = document.createElement('div');

  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${sourceWidth}px`,
    pointerEvents: 'none',
    zIndex: '-1',
  });

  Object.assign(clone.style, {
    transform: 'none',
    transformOrigin: 'top left',
    width: `${sourceWidth}px`,
    maxWidth: 'none',
  });

  host.appendChild(clone);
  document.body.appendChild(host);

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await document.fonts?.ready;

  try {
    return await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      windowWidth: Math.ceil(clone.scrollWidth || sourceWidth),
      windowHeight: Math.ceil(clone.scrollHeight || clone.offsetHeight),
    });
  } finally {
    host.remove();
  }
}

interface PlayerCardProps {
  userId: string | null;
  onClose: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ userId, onClose }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const cardRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [sharing, setSharing] = useState(false);
  const { showError } = useToast();
  const { playerCard: player, loading, error, refetch } = usePlayerCard(userId);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const numberLocale = i18n.resolvedLanguage || i18n.language;
  const levelColor = useMemo(() => player ? getLevelColor(player.level, theme) : theme.palette.grey[500], [player, theme]);
  // #4041: cor segura como TEXTO sobre paper (prata/ouro puros reprovam AA no light)
  const levelTextColor = useMemo(() => player ? getLevelTextColor(player.level, theme) : theme.palette.text.secondary, [player, theme]);
  const levelEntry = player ? getLevelEntry(player.level) : null;
  const xpProgress = useMemo(() => player ? getXpProgress(player.experiencePoints) : 0, [player]);
  const xpRemaining = player ? getXpRemaining(player.experiencePoints) : 0;
  const winRate = useMemo(() => player && player.totalGames > 0
    ? Math.round((player.totalWins / player.totalGames) * 100)
    : 0, [player]);
  const cardEdition = player
    ? t(`player.card.editions.${getCardEdition(player.level)}`)
    : t('player.card.sticker');
  const positionCode = getPositionCode(player?.preferredPosition);
  const levelTag = player ? t('player.card.levelShort', { level: player.level }) : t('player.card.level');

  const fieldGradient = useMemo(() => `
    radial-gradient(circle at 20% 8%, ${alpha(gColors.gold, 0.26)} 0, transparent 25%),
    radial-gradient(circle at 94% 32%, ${alpha(levelColor, 0.24)} 0, transparent 24%),
    linear-gradient(145deg, ${theme.palette.success.dark} 0%, ${theme.palette.primary.dark} 48%, ${theme.palette.background.default} 100%)
  `, [gColors.gold, levelColor, theme.palette.background.default, theme.palette.primary.dark, theme.palette.success.dark]);

  const photoHalo = useMemo(
    () => `linear-gradient(145deg, ${alpha(gColors.gold, 0.95)}, ${alpha(levelColor, 0.86)}, ${alpha(theme.palette.info.light, 0.82)})`,
    [gColors.gold, levelColor, theme.palette.info.light]
  );

  const xpBarGradient = useMemo(
    () => `linear-gradient(90deg, ${theme.palette.primary.light}, ${gColors.gold})`,
    [gColors.gold, theme.palette.primary.light]
  );

  const attributeRows = player ? [
    {
      label: t('player.card.attackShort'),
      value: getRatingValue(player.strikerRating, player.autoStrikerRating),
      tone: theme.palette.error.light,
    },
    {
      label: t('player.card.midShort'),
      value: getRatingValue(player.midRating, player.autoMidRating),
      tone: theme.palette.info.light,
    },
    {
      label: t('player.card.defenseShort'),
      value: getRatingValue(player.defenderRating, player.autoDefenderRating),
      tone: theme.palette.success.light,
    },
    {
      label: t('player.card.gkShort'),
      value: getRatingValue(player.gkRating, player.autoGkRating),
      tone: theme.palette.warning.light,
    },
  ] : [];

  const handleShare = useCallback(async () => {
    if (!cardRef.current || !player) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await renderShareCanvas(cardRef.current, html2canvas);

      canvas.toBlob(async (blob) => {
        if (!mountedRef.current) return;
        if (!blob) {
          setSharing(false);
          showError(t('feedback.player.cardGenerateError'));
          return;
        }
        const file = new File([blob], `${player.name}-futeba.png`, { type: 'image/png' });

        const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
        if (canShareFiles) {
          try {
            await navigator.share({
              title: t('player.card.shareTitle', { name: player.name }),
              text: t('player.card.shareText', {
                level: player.level,
                xp: player.experiencePoints.toLocaleString(numberLocale),
              }),
              files: [file],
            });
          } catch {
            // User cancelled native share.
          }
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${player.name}-futeba.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, 'image/png');
    } catch (error) {
      logger.error('Erro ao gerar imagem do card:', error);
      showError(t('feedback.player.cardGenerateError2'));
      setSharing(false);
    }
  }, [numberLocale, player, showError, t]);

  return (
    <Dialog
      open={!!userId}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-label={player?.name ? t('player.card.ariaLabelWithName', { name: player.name }) : t('player.card.ariaLabel')}
      PaperProps={{
        sx: {
          background: 'transparent',
          boxShadow: 'none',
          overflow: 'hidden',
          m: { xs: 0.75, sm: 4 },
          width: { xs: 'calc(100vw - 14px)', sm: 472 },
          maxWidth: { xs: 'calc(100vw - 14px)', sm: 472 },
          maxHeight: { xs: 'calc(100dvh - 14px)', sm: 'calc(100dvh - 64px)' },
          borderRadius: PLAYER_CARD_CORNER_RADIUS,
        },
      }}
      sx={{
        '& .MuiDialog-container': {
          alignItems: { xs: 'flex-start', sm: 'center' },
          px: { xs: 0, sm: 2 },
          py: { xs: 0.75, sm: 4 },
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          maxHeight: { xs: 'calc(100dvh - 14px)', sm: 'calc(100dvh - 64px)' },
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '44px minmax(0, 1fr) 44px',
            alignItems: 'center',
            gap: 1,
            mb: { xs: 0.75, sm: 1 },
            p: 0.5,
            position: 'sticky',
            top: 0,
            zIndex: 3,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.background.paper, 0.92),
            border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
            boxShadow: theme.shadows[4],
            backdropFilter: 'blur(12px)',
          }}
        >
          <Tooltip title={t('tooltip.close')} disableTouchListener>
            <IconButton
              onClick={onClose}
              aria-label={t('a11y.closePlayerCard')}
              sx={{
                width: 44,
                height: 44,
                color: 'text.primary',
                '&:hover': { bgcolor: theme.palette.action.hover },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>

          <Typography
            variant="subtitle2"
            component="h2"
            noWrap
            sx={{
              textAlign: 'center',
              color: 'text.primary',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t('player.card.sticker')}
          </Typography>

          <Tooltip title={typeof navigator.share === 'function' ? t('player.card.shareWhatsApp') : t('player.card.downloadImage')} disableTouchListener>
            <span>
              <IconButton
                onClick={handleShare}
                disabled={sharing || loading || !player}
                aria-label={t('a11y.sharePlayerCard')}
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: alpha(theme.palette.primary.main, 0.92),
                  color: theme.palette.primary.contrastText,
                  boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': { bgcolor: theme.palette.primary.dark },
                  '&:disabled': { opacity: 0.55 },
                }}
              >
                {typeof navigator.share === 'function' ? <ShareIcon /> : <DownloadIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box
          ref={cardRef}
          role="article"
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: PLAYER_CARD_CORNER_RADIUS,
            background: fieldGradient,
            boxShadow: `0 28px 90px ${alpha(theme.palette.common.black, 0.48)}, 0 0 0 1px ${alpha(theme.palette.common.white, 0.12)}`,
            border: `1px solid ${alpha(theme.palette.common.white, 0.16)}`,
            isolation: 'isolate',
            mb: { xs: 0.75, sm: 0 },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              backgroundImage: `
                linear-gradient(90deg, ${alpha(theme.palette.common.white, 0.055)} 1px, transparent 1px),
                linear-gradient(0deg, ${alpha(theme.palette.common.white, 0.04)} 1px, transparent 1px),
                radial-gradient(circle at 50% 28%, transparent 0 68px, ${alpha(theme.palette.common.white, 0.1)} 69px 70px, transparent 71px)
              `,
              backgroundSize: '38px 38px, 38px 38px, 100% 100%',
              maskImage: 'linear-gradient(180deg, black 0%, black 78%, transparent 100%)',
              pointerEvents: 'none',
            }}
          />
          <Box
            data-testid="player-card-inner-outline"
            sx={{
              position: 'absolute',
              inset: { xs: 9, sm: 14 },
              borderRadius: PLAYER_CARD_INNER_CORNER_RADIUS,
              border: `1px solid ${alpha(theme.palette.common.white, 0.16)}`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {loading ? (
            <PlayerCardSkeleton />
          ) : error ? (
            <EmptyStateCard error={error} onRetry={() => refetch()} />
          ) : player ? (
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: { xs: 1, sm: 1.5 },
                  alignItems: 'start',
                  px: { xs: 1.55, sm: 2.75 },
                  pt: { xs: 1.45, sm: 2.75 },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    sx={{
                      color: alpha(theme.palette.common.white, 0.74),
                      fontSize: { xs: '0.56rem', sm: '0.66rem' },
                      fontWeight: 900,
                      letterSpacing: { xs: '0.13em', sm: '0.18em' },
                      lineHeight: 1,
                    }}
                  >
                    {t('player.card.brand')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 0.5, sm: 0.75 }, mt: { xs: 0.65, sm: 1 } }}>
                    <Chip
                      label={cardEdition}
                      size="small"
                      sx={{
                        color: theme.palette.common.white,
                        bgcolor: alpha(theme.palette.common.black, 0.24),
                        border: `1px solid ${alpha(gColors.gold, 0.42)}`,
                        fontWeight: 900,
                        letterSpacing: '0.08em',
                        height: { xs: 24, sm: 28 },
                        '& .MuiChip-label': {
                          px: { xs: 0.8, sm: 1 },
                          fontSize: { xs: '0.68rem', sm: '0.8125rem' },
                        },
                      }}
                    />
                    <Chip
                      label={levelTag}
                      size="small"
                      sx={{
                        color: theme.palette.common.white,
                        bgcolor: alpha(levelColor, 0.3),
                        border: `1px solid ${alpha(levelColor, 0.52)}`,
                        fontWeight: 900,
                        height: { xs: 24, sm: 28 },
                        '& .MuiChip-label': {
                          px: { xs: 0.8, sm: 1 },
                          fontSize: { xs: '0.68rem', sm: '0.8125rem' },
                        },
                      }}
                    />
                  </Box>
                </Box>

                <Box
                  sx={{
                    width: { xs: 76, sm: 94 },
                    minHeight: { xs: 80, sm: 98 },
                    borderRadius: { xs: 2.5, sm: 3 },
                    textAlign: 'center',
                    p: { xs: 0.75, sm: 1 },
                    bgcolor: alpha(theme.palette.common.black, 0.28),
                    border: `1px solid ${alpha(theme.palette.common.white, 0.18)}`,
                    boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.14)}`,
                  }}
                >
                  <Typography
                    sx={{
                      color: gColors.gold,
                      fontSize: { xs: '2.18rem', sm: '2.8rem' },
                      fontWeight: 950,
                      lineHeight: 0.9,
                      letterSpacing: '-0.08em',
                      textShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.5)}`,
                    }}
                  >
                    {player.overallRating}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: alpha(theme.palette.common.white, 0.74),
                      fontWeight: 900,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      fontSize: { xs: '0.56rem', sm: '0.66rem' },
                    }}
                  >
                    {t('player.card.overall')}
                  </Typography>
                </Box>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '104px minmax(0, 1fr)', sm: '150px 1fr' },
                  gap: { xs: 1.5, sm: 2 },
                  px: { xs: 1.55, sm: 2.75 },
                  pt: { xs: 0.8, sm: 1.75 },
                  alignItems: 'center',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    justifySelf: 'start',
                    width: { xs: 104, sm: 148 },
                    height: { xs: 104, sm: 148 },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '34% 66% 42% 58% / 54% 38% 62% 46%',
                      background: photoHalo,
                      filter: `drop-shadow(0 18px 28px ${alpha(theme.palette.common.black, 0.28)})`,
                    }}
                  />
                  <Avatar
                    src={player.photoUrl}
                    alt={player.name}
                    slotProps={{ img: { loading: 'lazy' } }}
                    sx={{
                      position: 'absolute',
                      inset: { xs: 7, sm: 10 },
                      width: { xs: 90, sm: 128 },
                      height: { xs: 90, sm: 128 },
                      bgcolor: alpha(levelColor, 0.32),
                      color: theme.palette.common.white,
                      fontSize: { xs: '2.35rem', sm: '3.15rem' },
                      fontWeight: 950,
                      border: `4px solid ${alpha(theme.palette.common.white, 0.78)}`,
                      boxShadow: `0 18px 36px ${alpha(theme.palette.common.black, 0.36)}`,
                    }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box
                    sx={{
                      position: 'absolute',
                      right: { xs: -8, sm: -4 },
                      bottom: { xs: 8, sm: 12 },
                      minWidth: { xs: 44, sm: 52 },
                      height: { xs: 32, sm: 38 },
                      px: { xs: 0.75, sm: 1 },
                      borderRadius: 999,
                      bgcolor: theme.palette.background.paper,
                      border: `2px solid ${alpha(levelTextColor, 0.7)}`,
                      color: levelTextColor,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: theme.shadows[6],
                    }}
                  >
                    <Typography sx={{ fontWeight: 950, lineHeight: 1, fontSize: { xs: '0.8rem', sm: '0.95rem' } }}>
                      {positionCode}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                  <Typography
                    variant="h4"
                    component="p"
                    sx={{
                      color: theme.palette.common.white,
                      fontWeight: 950,
                      lineHeight: 0.96,
                      letterSpacing: '-0.06em',
                      textTransform: 'uppercase',
                      textWrap: 'balance',
                      textShadow: `0 8px 20px ${alpha(theme.palette.common.black, 0.36)}`,
                      fontSize: { xs: '1.35rem', sm: theme.typography.h4.fontSize },
                    }}
                  >
                    {getFitPlayerName(player.name)}
                  </Typography>
                  {player.nickname && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.72),
                        fontWeight: 800,
                        mt: { xs: 0.45, sm: 0.75 },
                      }}
                    >
                      {player.nickname}
                    </Typography>
                  )}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 0.8,
                      mt: { xs: 0.75, sm: 1.15 },
                      minWidth: 0,
                    }}
                  >
                    <TeamBadge teamId={player.favoriteTeam} size={20} />
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.76),
                        fontWeight: 900,
                        letterSpacing: '0.09em',
                        textTransform: 'uppercase',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {levelEntry?.name || t('player.card.level')}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box
                role="group"
                aria-label={t('player.card.ratingBreakdown')}
                sx={{
                  mx: { xs: 1.35, sm: 2.75 },
                  mt: { xs: 1.15, sm: 2 },
                  p: { xs: 1.1, sm: 1.6 },
                  borderRadius: { xs: 2.5, sm: 3 },
                  bgcolor: alpha(theme.palette.common.black, 0.24),
                  border: `1px solid ${alpha(theme.palette.common.white, 0.14)}`,
                  boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.08)}`,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: { xs: 0.6, sm: 0.85 } }}>
                  <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.76), fontWeight: 900, fontSize: { xs: '0.66rem', sm: '0.75rem' } }}>
                    {player.experiencePoints.toLocaleString(numberLocale)} XP
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.7), fontWeight: 800, textAlign: 'right', fontSize: { xs: '0.66rem', sm: '0.75rem' } }}>
                    {player.level < 20
                      ? t('player.card.xpToNextLevel', {
                        xp: xpRemaining.toLocaleString(numberLocale),
                        level: player.level + 1,
                      })
                      : t('player.card.maxLevel')}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={xpProgress * 100}
                  sx={{
                    height: { xs: 8, sm: 10 },
                    borderRadius: 999,
                    bgcolor: alpha(theme.palette.common.black, 0.32),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 999,
                      background: xpBarGradient,
                    },
                  }}
                />
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: { xs: 0.75, sm: 1.1 },
                  mx: { xs: 1.35, sm: 2.75 },
                  mt: { xs: 0.9, sm: 1.4 },
                  p: { xs: 1.1, sm: 1.6 },
                  borderRadius: { xs: 2.5, sm: 3 },
                  bgcolor: alpha(theme.palette.common.black, 0.2),
                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                }}
              >
                {attributeRows.map((item) => (
                  <AttributeLane
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    tone={item.tone}
                  />
                ))}
              </Box>

              <Box
                role="list"
                aria-label={t('player.card.performanceSummary')}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  '@media (min-width: 360px)': {
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  },
                  gap: { xs: 0.75, sm: 1 },
                  p: { xs: 1.35, sm: 2.75 },
                  pt: { xs: 1.15, sm: 1.5 },
                  bgcolor: alpha(theme.palette.background.default, 0.82),
                  mt: { xs: 1.15, sm: 2 },
                }}
              >
                <StatTile
                  icon={<SoccerIcon fontSize="small" />}
                  label={t('player.stats.games')}
                  value={player.totalGames}
                  tone={theme.palette.success.main}
                />
                <StatTile
                  icon={<SoccerIcon fontSize="small" />}
                  label={t('player.stats.goals')}
                  value={player.totalGoals}
                  tone={theme.palette.primary.main}
                />
                <StatTile
                  icon={<StarIcon fontSize="small" />}
                  label={t('player.stats.assists')}
                  value={player.totalAssists}
                  tone={theme.palette.info.main}
                />
                <StatTile
                  icon={<TrophyIcon fontSize="small" />}
                  label={t('player.stats.mvps')}
                  value={player.mvpCount}
                  tone={gColors.gold}
                />
                <StatTile
                  icon={<FireIcon fontSize="small" />}
                  label={t('player.stats.streak')}
                  value={player.currentStreak}
                  tone={theme.palette.warning.main}
                />
                <StatTile
                  icon={<TrophyIcon fontSize="small" />}
                  label={t('player.stats.winRate')}
                  value={`${winRate}%`}
                  tone={theme.palette.secondary.main}
                />
              </Box>
            </Box>
          ) : null}

          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              px: 2,
              py: { xs: 0.75, sm: 1.15 },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.8,
              bgcolor: alpha(theme.palette.common.black, 0.2),
            }}
          >
            <SoccerIcon sx={{ fontSize: iconSizes.xs, color: alpha(theme.palette.common.white, 0.46) }} />
            <Typography
              variant="caption"
              sx={{
                color: alpha(theme.palette.common.white, 0.46),
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontSize: { xs: '0.58rem', sm: '0.68rem' },
              }}
            >
              {t('player.card.footerUrl')}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerCard;
