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

const logger = createLogger('PlayerCard');
import {
  getLevelEntry,
  getXpProgress,
  getXpRemaining,
} from '../../types/gamification';
import { getLevelColor } from '../../types/user';
import { useGamificationColors } from '../../hooks/useGamificationColors';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, color }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 0.75,
        px: 1,
        py: 0.85,
        minWidth: 0,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.common.black, 0.22),
        border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.common.white, 0.68),
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'block',
            lineHeight: 1.1,
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.common.white,
            fontWeight: 900,
            lineHeight: 1,
            fontSize: '1.15rem',
            mt: 0.35,
            textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.75)}`,
            WebkitTextStroke: `0.35px ${alpha(theme.palette.common.black, 0.42)}`,
          }}
        >
          {value}
        </Typography>
      </Box>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: alpha(color || theme.palette.common.white, 0.13),
          color: color || alpha(theme.palette.common.white, 0.78),
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
    </Box>
  );
};

interface AttributeBarProps {
  label: string;
  value: number;
  color: string;
}

const AttributeBar: React.FC<AttributeBarProps> = ({ label, value, color }) => {
  const theme = useTheme();
  const normalized = Math.max(0, Math.min(value, 5));
  const percent = Math.round((normalized / 5) * 100);

  return (
    <Box
      sx={{
        minWidth: 0,
        px: 1,
        py: 0.85,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.common.black, 0.24),
        border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75, mb: 0.55 }}>
        <Typography
          variant="caption"
          sx={{
            color: alpha(theme.palette.common.white, 0.76),
            fontWeight: 800,
            fontSize: '0.68rem',
            letterSpacing: '0.08em',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.common.white,
            fontWeight: 900,
            fontSize: '0.72rem',
            flexShrink: 0,
            textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.9)}`,
            WebkitTextStroke: `0.25px ${alpha(theme.palette.common.black, 0.45)}`,
          }}
        >
          {normalized > 0 ? normalized.toFixed(1) : '--'}
        </Typography>
      </Box>
      <Box
        sx={{
          height: 6,
          borderRadius: 999,
          bgcolor: alpha(theme.palette.common.black, 0.32),
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}, ${alpha(theme.palette.common.white, 0.88)})`,
            boxShadow: normalized > 0 ? `0 0 12px ${alpha(color, 0.45)}` : 'none',
          }}
        />
      </Box>
    </Box>
  );
};

const PlayerCardSkeleton: React.FC = () => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, py: 4 }}>
      <Skeleton variant="rounded" width="100%" height={48} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1), borderRadius: 2, mb: 2 }} />
      <Skeleton variant="circular" width={142} height={142} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1) }} />
      <Skeleton variant="text" width={190} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1), mt: 2 }} />
      <Skeleton variant="rounded" width="100%" height={150} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1), borderRadius: 2, mt: 2 }} />
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
    <Box sx={{ textAlign: 'center', px: 3, py: 6 }}>
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

function getCardEdition(level: number): string {
  if (level >= 20) return 'LEGEND';
  if (level >= 15) return 'ELITE';
  if (level >= 10) return 'PRO';
  if (level >= 5) return 'RISING';
  return 'ROOKIE';
}

function getFitPlayerName(name: string): string {
  return name.trim().slice(0, 28);
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
      foreignObjectRendering: true,
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

  const XP_BAR_GRADIENT = useMemo(() => `linear-gradient(90deg, ${theme.palette.primary.main}, ${gColors.gold})`, [theme.palette.primary.main, gColors.gold]);
  const OVERALL_BAR_GRADIENT = useMemo(() => `linear-gradient(90deg, ${gColors.gold}, ${theme.palette.warning.main})`, [gColors.gold, theme.palette.warning.main]);
  const cardRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const [sharing, setSharing] = useState(false);
  const { showError } = useToast();
  const { playerCard: player, loading, error, refetch } = usePlayerCard(userId);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const levelColor = useMemo(() => player ? getLevelColor(player.level, theme) : theme.palette.grey[500], [player, theme]);
  const levelEntry = player ? getLevelEntry(player.level) : null;
  const xpProgress = useMemo(() => player ? getXpProgress(player.experiencePoints) : 0, [player]);
  const xpRemaining = player ? getXpRemaining(player.experiencePoints) : 0;
  const numberLocale = i18n.resolvedLanguage || i18n.language;

  // Captura o card como PNG e compartilha ou faz download
  const handleShare = useCallback(async () => {
    if (!cardRef.current || !player) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await renderShareCanvas(cardRef.current, html2canvas);

      canvas.toBlob(async (blob) => {
        if (!mountedRef.current) return;
        if (!blob) {
          // Libera spinner se geração de blob falhar (#1128)
          setSharing(false);
          showError(t('feedback.player.cardGenerateError'));
          return;
        }
        const file = new File([blob], `${player.name}-futeba.png`, { type: 'image/png' });

        // Tenta Web Share API (mobile / WhatsApp)
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
            // Usuário cancelou — sem erro
          }
        } else {
          // Fallback: download direto
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
  const handlePreviewTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.cancelable) {
      event.preventDefault();
    }
  }, []);

  const winRate = useMemo(() => player && player.totalGames > 0
    ? Math.round((player.totalWins / player.totalGames) * 100)
    : 0, [player]);
  const cardEdition = player ? getCardEdition(player.level) : 'PLAYER';
  const cardGradient = useMemo(() => `
    radial-gradient(circle at 18% 14%, ${alpha(gColors.gold, 0.18)} 0, transparent 24%),
    radial-gradient(circle at 88% 20%, ${alpha(levelColor, 0.2)} 0, transparent 28%),
    linear-gradient(150deg, ${theme.palette.success.dark} 0%, ${alpha(theme.palette.common.black, 0.86)} 52%, ${theme.palette.primary.dark} 100%)
  `, [gColors.gold, levelColor, theme.palette.common.black, theme.palette.primary.dark, theme.palette.success.dark]);
  const frameGradient = useMemo(
    () => `linear-gradient(135deg, ${gColors.gold}, ${levelColor}, ${theme.palette.info.main})`,
    [gColors.gold, levelColor, theme.palette.info.main]
  );
  const positionCode = getPositionCode(player?.preferredPosition);
  const levelTag = player ? t('player.card.levelShort', { level: player.level }) : t('player.card.level');
  const attributeRows = player ? [
    {
      label: t('player.card.attackShort'),
      value: getRatingValue(player.strikerRating, player.autoStrikerRating),
      color: theme.palette.error.light,
    },
    {
      label: t('player.card.midShort'),
      value: getRatingValue(player.midRating, player.autoMidRating),
      color: theme.palette.info.light,
    },
    {
      label: t('player.card.defenseShort'),
      value: getRatingValue(player.defenderRating, player.autoDefenderRating),
      color: theme.palette.success.light,
    },
    {
      label: t('player.card.gkShort'),
      value: getRatingValue(player.gkRating, player.autoGkRating),
      color: theme.palette.warning.light,
    },
  ] : [];

  return (
    <Dialog
      open={!!userId}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      // #2213: card-style dialog sem DialogTitle textual — nome acessível via
      // aria-label com o nome do jogador.
      aria-label={player?.name ? t('player.card.ariaLabelWithName', { name: player.name }) : t('player.card.ariaLabel')}
      PaperProps={{
        sx: {
          background: 'transparent',
          boxShadow: 'none',
          overflow: 'hidden',
          m: { xs: 0, sm: 4 },
          width: { xs: '100vw', sm: '100%' },
          maxWidth: { xs: 360, sm: 444 },
          maxHeight: { xs: '100dvh', sm: 'calc(100vh - 64px)' },
        },
      }}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
          px: { xs: 0, sm: 3 },
          py: { xs: 0, sm: 4 },
          touchAction: 'none',
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          overflow: 'hidden',
          maxHeight: { xs: '100dvh', sm: 'calc(100vh - 64px)' },
          touchAction: 'none',
          overscrollBehavior: 'contain',
        }}
      >
        {/* Botões fora do card (não aparecem na imagem) */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mb: { xs: 0.5, sm: 1 },
            px: 1,
            flexShrink: 0,
          }}
        >
          <Tooltip title={t('tooltip.close')} disableTouchListener>
            <IconButton
              onClick={onClose}
              aria-label={t('a11y.closePlayerCard')}
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.15),
                color: theme.palette.common.white,
                backdropFilter: 'blur(4px)',
                '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.25) },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={typeof navigator.share === 'function' ? t('player.card.shareWhatsApp') : t('player.card.downloadImage')} disableTouchListener>
            <span role="button" aria-disabled="true" tabIndex={-1}>
              <IconButton
                onClick={handleShare}
                disabled={sharing || loading || !player}
                aria-label={t('a11y.sharePlayerCard')}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.9),
                  color: theme.palette.primary.contrastText,
                  '&:hover': { bgcolor: theme.palette.primary.dark },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                {typeof navigator.share === 'function' ? <ShareIcon /> : <DownloadIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box
          onTouchMove={handlePreviewTouchMove}
          sx={{
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            height: { xs: 'calc(100dvh - 58px)', sm: 'auto' },
            overflow: 'hidden',
            touchAction: 'none',
            overscrollBehavior: 'contain',
          }}
        >
          <Box
            sx={{
              width: '100%',
              transformOrigin: 'top center',
              transform: { xs: 'scale(0.84)', sm: 'none' },
              '@media (max-height: 760px)': {
                transform: { xs: 'scale(0.78)', sm: 'none' },
              },
              '@media (max-height: 680px)': {
                transform: { xs: 'scale(0.72)', sm: 'none' },
              },
              '@media (min-height: 860px)': {
                transform: { xs: 'scale(0.9)', sm: 'none' },
              },
            }}
          >
            {/* Card principal — capturado pelo html2canvas */}
        <Box
          ref={cardRef}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
            background: cardGradient,
            boxShadow: `0 24px 70px ${alpha(theme.palette.common.black, 0.58)}, 0 0 0 1px ${alpha(theme.palette.common.white, 0.12)}`,
            position: 'relative',
            isolation: 'isolate',
            border: `1px solid ${alpha(gColors.gold, 0.28)}`,
          }}
        >
          {/* Textura de figurinha/campo */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(115deg, transparent 0%, ${alpha(theme.palette.common.white, 0.08)} 38%, transparent 54%),
                repeating-linear-gradient(
                  90deg,
                  transparent,
                  transparent 18px,
                  ${alpha(theme.palette.common.white, 0.035)} 18px,
                  ${alpha(theme.palette.common.white, 0.035)} 19px
                )
              `,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 10,
              borderRadius: 2.25,
              border: `1px solid ${alpha(theme.palette.common.white, 0.14)}`,
              boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.common.black, 0.22)}`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* Cabeçalho de figurinha */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2.25,
              pt: 2,
              pb: 1,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: frameGradient,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: `0 0 18px ${alpha(gColors.gold, 0.35)}`,
                }}
              >
                <SoccerIcon sx={{ color: theme.palette.common.white, fontSize: iconSizes.sm }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="overline"
                  sx={{
                    color: alpha(theme.palette.common.white, 0.62),
                    fontSize: '0.65rem',
                    letterSpacing: '0.16em',
                    lineHeight: 1,
                    display: 'block',
                  }}
                >
                  {t('player.card.brand')}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.common.white,
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    letterSpacing: '0.12em',
                    lineHeight: 1,
                  }}
                >
                  {cardEdition}
                </Typography>
              </Box>
            </Box>
            <Box
              sx={{
                bgcolor: alpha(theme.palette.common.black, 0.26),
                borderRadius: 999,
                px: 1,
                py: 0.45,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
              }}
            >
              <TrophyIcon sx={{ color: gColors.gold, fontSize: iconSizes.xs }} />
              <Typography
                variant="overline"
                sx={{ color: alpha(theme.palette.common.white, 0.78), fontSize: '0.68rem', letterSpacing: '0.1em', lineHeight: 1.2 }}
              >
                {t('player.card.sticker')}
              </Typography>
            </Box>
          </Box>

          {/* Miolo da figurinha */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              px: 2.25,
              pb: 2,
            }}
          >
            {loading ? (
              <PlayerCardSkeleton />
            ) : error ? (
              <EmptyStateCard error={error} onRetry={() => refetch()} />
            ) : player ? (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '74px 1fr 74px',
                    alignItems: 'start',
                    gap: 1.25,
                    pt: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.common.black, 0.36),
                      border: `1px solid ${alpha(gColors.gold, 0.24)}`,
                      p: 1,
                      textAlign: 'center',
                      minHeight: 82,
                    }}
                  >
                    <Typography
                      sx={{
                        color: gColors.gold,
                        fontWeight: 950,
                        fontSize: '2.15rem',
                        lineHeight: 0.95,
                        textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.85)}, 0 0 16px ${alpha(gColors.gold, 0.45)}`,
                        WebkitTextStroke: `0.7px ${alpha(theme.palette.common.black, 0.48)}`,
                      }}
                    >
                      {player.overallRating}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.common.white,
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        fontSize: '0.65rem',
                      }}
                    >
                      {t('player.card.overall')}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      justifySelf: 'center',
                      position: 'relative',
                      width: 150,
                      height: 166,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 4,
                        borderRadius: '50%',
                        background: frameGradient,
                        boxShadow: `0 14px 24px ${alpha(theme.palette.common.black, 0.38)}, inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.26)}`,
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 12,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.common.black, 0.34),
                        backgroundImage: `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.13)}, transparent 58%)`,
                        boxShadow: `inset 0 0 24px ${alpha(theme.palette.common.black, 0.28)}`,
                      }}
                    />
                    <Avatar
                      src={player.photoUrl}
                      alt={player.name}
                      slotProps={{ img: { loading: 'lazy' } }}
                      sx={{
                        width: 124,
                        height: 124,
                        bgcolor: alpha(levelColor, 0.3),
                        fontSize: '2.7rem',
                        fontWeight: 900,
                        color: theme.palette.common.white,
                        border: `3px solid ${alpha(theme.palette.common.white, 0.72)}`,
                        boxShadow: `0 10px 26px ${alpha(theme.palette.common.black, 0.35)}`,
                        zIndex: 1,
                      }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 6,
                        right: 14,
                        minWidth: 38,
                        height: 30,
                        px: 0.75,
                        borderRadius: 999,
                        bgcolor: levelColor,
                        border: `2px solid ${alpha(theme.palette.common.white, 0.76)}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        boxShadow: `0 8px 16px ${alpha(theme.palette.common.black, 0.35)}`,
                      }}
                    >
                      <Typography
                        sx={{
                          color: theme.palette.common.white,
                          fontWeight: 950,
                          fontSize: '0.8rem',
                          lineHeight: 1,
                          textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.9)}`,
                        }}
                      >
                        {player.level}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.common.black, 0.36),
                      border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                      p: 1,
                      textAlign: 'center',
                      minHeight: 82,
                    }}
                  >
                    <Typography
                      sx={{
                        color: theme.palette.common.white,
                        fontWeight: 950,
                        fontSize: '1.55rem',
                        lineHeight: 0.95,
                        letterSpacing: '0.06em',
                        textShadow: `0 2px 5px ${alpha(theme.palette.common.black, 0.72)}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {positionCode}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.62),
                        fontWeight: 800,
                        letterSpacing: '0.12em',
                        fontSize: '0.65rem',
                        display: 'block',
                        mt: 0.4,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {levelTag}
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    mt: 1.5,
                    mb: 1.25,
                    mx: 0.25,
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.common.black, 0.28),
                    border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                    textAlign: 'center',
                  }}
                >
                  <Typography
                    variant="h5"
                    sx={{
                      color: theme.palette.common.white,
                      fontWeight: 950,
                      textAlign: 'center',
                      lineHeight: 1.05,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      fontSize: '1.55rem',
                      textShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.62)}`,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {getFitPlayerName(player.name)}
                  </Typography>
                  {player.nickname && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.68),
                        fontWeight: 600,
                        mt: 0.35,
                      }}
                    >
                      {player.nickname}
                    </Typography>
                  )}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.65,
                      mt: 0.7,
                      minWidth: 0,
                    }}
                  >
                    <TeamBadge teamId={player.favoriteTeam} size={20} />
                    <Typography
                      variant="caption"
                      sx={{
                        color: alpha(theme.palette.common.white, 0.68),
                        fontWeight: 800,
                        letterSpacing: '0.08em',
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

                <Box
                  sx={{
                    width: '100%',
                    px: 1.25,
                    py: 1,
                    mb: 1.25,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.common.black, 0.24),
                    border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.65, gap: 1 }}>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.66), fontSize: '0.72rem', fontWeight: 700 }}>
                      {player.experiencePoints.toLocaleString(numberLocale)} XP
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.66), fontSize: '0.72rem', fontWeight: 700, textAlign: 'right' }}>
                      {player.level < 20
                        ? t('player.card.xpToNextLevel', {
                          xp: xpRemaining.toLocaleString(numberLocale),
                          level: player.level + 1,
                        })
                        : t('player.card.maxLevel')}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: alpha(theme.palette.common.black, 0.36),
                      overflow: 'hidden',
                      border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${xpProgress * 100}%`,
                        background: XP_BAR_GRADIENT,
                        borderRadius: 999,
                        transition: (transitionTheme) => transitionTheme.transitions.create('width', { duration: 800 }),
                        boxShadow: `0 0 10px ${alpha(theme.palette.primary.main, 0.55)}`,
                      }}
                    />
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 0.9,
                    width: '100%',
                    mb: 1.25,
                  }}
                >
                  {attributeRows.map((item) => (
                    <AttributeBar
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      color={item.color}
                    />
                  ))}
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 0.85,
                    width: '100%',
                  }}
                >
                  <StatItem
                    icon={<SoccerIcon fontSize="small" />}
                    label={t('player.stats.games')}
                    value={player.totalGames}
                    color={theme.palette.success.light}
                  />
                  <StatItem
                    icon={<SoccerIcon fontSize="small" />}
                    label={t('player.stats.goals')}
                    value={player.totalGoals}
                    color={theme.palette.primary.light}
                  />
                  <StatItem
                    icon={<StarIcon fontSize="small" />}
                    label={t('player.stats.assists')}
                    value={player.totalAssists}
                    color={theme.palette.info.light}
                  />
                  <StatItem
                    icon={<TrophyIcon fontSize="small" />}
                    label={t('player.stats.mvps')}
                    value={player.mvpCount}
                    color={gColors.gold}
                  />
                  <StatItem
                    icon={<FireIcon fontSize="small" />}
                    label={t('player.stats.streak')}
                    value={player.currentStreak}
                    color={theme.palette.warning.light}
                  />
                  <StatItem
                    icon={<TrophyIcon fontSize="small" />}
                    label={t('player.stats.winRate')}
                    value={`${winRate}%`}
                    color={theme.palette.secondary.light}
                  />
                </Box>

                <Box
                  sx={{
                    mt: 1.25,
                    px: 1.25,
                    py: 1,
                    bgcolor: alpha(theme.palette.common.black, 0.26),
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    width: '100%',
                    border: `1px solid ${alpha(gColors.gold, 0.18)}`,
                  }}
                >
                  <Typography
                    sx={{
                      color: gColors.gold,
                      fontWeight: 950,
                      fontSize: '2rem',
                      lineHeight: 1,
                      minWidth: 48,
                      textAlign: 'center',
                      textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.85)}, 0 0 12px ${alpha(gColors.gold, 0.5)}`,
                      WebkitTextStroke: `0.7px ${alpha(theme.palette.common.black, 0.48)}`,
                    }}
                  >
                    {player.overallRating}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.58), fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em' }}>
                      {t('player.card.ratingBreakdown')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={player.overallRating}
                      sx={{
                        height: 8,
                        borderRadius: 999,
                        bgcolor: alpha(theme.palette.common.black, 0.34),
                        mt: 0.45,
                        '& .MuiLinearProgress-bar': {
                          background: OVERALL_BAR_GRADIENT,
                          borderRadius: 999,
                        },
                      }}
                    />
                  </Box>
                </Box>
              </>
            ) : null}
          </Box>

          {/* Rodapé do card */}
          <Box
            sx={{
              bgcolor: alpha(theme.palette.common.black, 0.2),
              px: 2,
              py: 1,
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: alpha(theme.palette.common.white, 0.3), fontSize: '0.75rem', letterSpacing: '0.1em' }}
            >
              {t('player.card.footerUrl')}
            </Typography>
          </Box>
        </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerCard;
