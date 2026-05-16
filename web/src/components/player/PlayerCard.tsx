import React, { useRef, useState, useCallback } from 'react';
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
import { createLogger } from '../../utils/logger';
import { TeamBadge } from '../team/TeamBadge';

const logger = createLogger('PlayerCard');
import {
  getLevelEntry,
  getXpProgress,
  getXpRemaining,
} from '../../types/gamification';
import { getLevelColor } from '../../types/user';
import { gamificationColors } from '../../theme';

// Mapeamento de posição para rótulo PT-BR
const POSITION_LABELS: Record<string, string> = {
  GOLEIRO: 'Goleiro',
  ZAGUEIRO: 'Defensor',
  LATERAL: 'Lateral',
  VOLANTE: 'Volante',
  MEIA: 'Meia-campo',
  ATACANTE: 'Atacante',
};

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
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        minWidth: 64,
      }}
    >
      <Box sx={{ color: color || alpha(theme.palette.common.white, 0.7), display: 'flex', alignItems: 'center' }}>
        {icon}
      </Box>
      <Typography
        variant="h6"
        sx={{
          color: theme.palette.common.white,
          fontWeight: 700,
          lineHeight: 1,
          fontSize: '1.1rem',
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: alpha(theme.palette.common.white, 0.6),
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          textAlign: 'center',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

interface PlayerCardProps {
  userId: string | null;
  onClose: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ userId, onClose }) => {
  const theme = useTheme();

  const CARD_GRADIENT = `linear-gradient(160deg, ${theme.palette.success.dark} 0%, ${alpha(theme.palette.success.main, 0.85)} 35%, ${theme.palette.success.main} 60%, ${theme.palette.success.light} 100%)`;
  const CARD_BADGE_BORDER = theme.palette.success.dark;
  const XP_BAR_GRADIENT = `linear-gradient(90deg, ${theme.palette.primary.main}, ${gamificationColors.gold})`;
  const OVERALL_BAR_GRADIENT = `linear-gradient(90deg, ${gamificationColors.gold}, ${theme.palette.warning.main})`;
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const { showError } = useToast();
  const { playerCard: player, loading, error, refetch } = usePlayerCard(userId);

  const levelColor = player ? getLevelColor(player.level, theme) : theme.palette.grey[500];
  const levelEntry = player ? getLevelEntry(player.level) : null;
  const xpProgress = player ? getXpProgress(player.experiencePoints) : 0;
  const xpRemaining = player ? getXpRemaining(player.experiencePoints) : 0;

  // Captura o card como PNG e compartilha ou faz download
  const handleShare = useCallback(async () => {
    if (!cardRef.current || !player) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          // Libera spinner se geração de blob falhar (#1128)
          setSharing(false);
          showError('Falha ao gerar imagem. Tente novamente.');
          return;
        }
        const file = new File([blob], `${player.name}-futeba.png`, { type: 'image/png' });

        // Tenta Web Share API (mobile / WhatsApp)
        const canShareFiles = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
        if (canShareFiles) {
          try {
            await navigator.share({
              title: `${player.name} - Futeba dos Parças`,
              text: `Olha minha figurinha no Futeba dos Parças! Nível ${player.level} • ${player.experiencePoints} XP`,
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
      showError('Erro ao gerar imagem do card. Tente novamente.');
      setSharing(false);
    }
  }, [player, showError]);

  const winRate = player && player.totalGames > 0
    ? Math.round((player.totalWins / player.totalGames) * 100)
    : 0;

  return (
    <Dialog
      open={!!userId}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          background: 'transparent',
          boxShadow: 'none',
          overflow: 'visible',
        },
      }}
    >
      <DialogContent sx={{ p: 0, overflow: 'visible' }}>
        {/* Botões fora do card (não aparecem na imagem) */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            mb: 1,
            px: 1,
          }}
        >
          <Tooltip title="Fechar">
            <IconButton
              onClick={onClose}
              aria-label="Fechar card do jogador"
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

          <Tooltip title={typeof navigator.share === 'function' ? 'Compartilhar no WhatsApp' : 'Baixar imagem'}>
            <span>
              <IconButton
                onClick={handleShare}
                disabled={sharing || loading || !player}
                aria-label="Compartilhar card do jogador"
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

        {/* Card principal — capturado pelo html2canvas */}
        <Box
          ref={cardRef}
          sx={{
            borderRadius: '16px',
            overflow: 'hidden',
            background: CARD_GRADIENT,
            boxShadow: `0 20px 60px ${alpha(theme.palette.common.black, 0.5)}, 0 0 0 1px ${alpha(theme.palette.common.white, 0.1)}`,
            position: 'relative',
          }}
        >
          {/* Textura de campo de futebol */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 28px,
                  ${alpha(theme.palette.common.white, 0.03)} 28px,
                  ${alpha(theme.palette.common.white, 0.03)} 56px
                )
              `,
              pointerEvents: 'none',
            }}
          />

          {/* Cabeçalho com logo */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2,
              pt: 1.5,
              pb: 0.5,
            }}
          >
            <Typography
              variant="overline"
              sx={{
                color: alpha(theme.palette.common.white, 0.5),
                fontSize: '0.75rem',
                letterSpacing: '0.15em',
              }}
            >
              FUTEBA DOS PARÇAS
            </Typography>
            <Box
              sx={{
                bgcolor: alpha(theme.palette.common.white, 0.1),
                borderRadius: '6px',
                px: 0.75,
                py: 0.25,
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: alpha(theme.palette.common.white, 0.7), fontSize: '0.75rem', letterSpacing: '0.1em' }}
              >
                ⚽ FIGURINHA
              </Typography>
            </Box>
          </Box>

          {/* Foto + nome */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 2,
              pt: 1,
              pb: 2,
            }}
          >
            {loading ? (
              <>
                <Skeleton variant="circular" width={120} height={120} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1) }} />
                <Skeleton variant="text" width={160} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1), mt: 1.5 }} />
                <Skeleton variant="text" width={100} sx={{ bgcolor: alpha(theme.palette.common.white, 0.1), mt: 0.5 }} />
              </>
            ) : error ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="error" gutterBottom>Erro ao carregar jogador</Typography>
                {/* SECFIX #492: Button (não IconButton) — IconButton é semanticamente
                    pra ícones puros; texto sem ícone usa Button (WCAG 4.1.2). */}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => refetch()}
                  sx={{
                    color: theme.palette.common.white,
                    borderColor: alpha(theme.palette.common.white, 0.5),
                    '&:hover': {
                      borderColor: theme.palette.common.white,
                      bgcolor: alpha(theme.palette.common.white, 0.08),
                    },
                  }}
                >
                  Tentar novamente
                </Button>
              </Box>
            ) : player ? (
              <>
                {/* Avatar com borda dourada + badge de nível */}
                <Box sx={{ position: 'relative', mb: 1.5 }}>
                  <Box
                    sx={{
                      borderRadius: '50%',
                      p: '3px',
                       background: `linear-gradient(135deg, ${gamificationColors.gold}, ${gamificationColors.gold}, ${gamificationColors.gold})`,
                      boxShadow: `0 0 20px ${alpha(gamificationColors.gold, 0.4)}`,
                    }}
                  >
                    <Avatar
                      src={player.photoUrl}
                      alt={player.name}
                      slotProps={{ img: { loading: 'lazy' } }}
                      sx={{
                        width: 120,
                        height: 120,
                        bgcolor: alpha(levelColor, 0.3),
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: theme.palette.common.white,
                      }}
                    >
                      {player.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </Box>

                  {/* Badge de nível */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 2,
                      right: 2,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: levelColor,
                      border: `2px solid ${CARD_BADGE_BORDER}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.4)}`,
                    }}
                  >
                    <Typography
                      sx={{
                        color: theme.palette.common.white,
                        fontWeight: 900,
                        fontSize: '0.75rem',
                        lineHeight: 1,
                        textShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.5)}`,
                      }}
                    >
                      {player.level}
                    </Typography>
                  </Box>
                </Box>

                {/* Nome e apelido */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography
                    variant="h5"
                    sx={{
                      color: theme.palette.common.white,
                      fontWeight: 800,
                      textAlign: 'center',
                      lineHeight: 1.1,
                      textShadow: `0 2px 4px ${alpha(theme.palette.common.black, 0.3)}`,
                    }}
                  >
                    {player.name}
                  </Typography>
                  <TeamBadge teamId={player.favoriteTeam} size={20} />
                </Box>

                {player.nickname && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: alpha(theme.palette.common.white, 0.65),
                      fontStyle: 'italic',
                      mt: 0.25,
                    }}
                  >
                    "{player.nickname}"
                  </Typography>
                )}

                {/* Posição e título de nível */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                  {player.preferredPosition && (
                    <Box
                      sx={{
                        bgcolor: alpha(theme.palette.common.white, 0.15),
                        borderRadius: '20px',
                        px: 1.25,
                        py: 0.25,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: alpha(theme.palette.common.white, 0.85), fontWeight: 600, fontSize: '0.75rem' }}
                      >
                        {POSITION_LABELS[player.preferredPosition] ?? player.preferredPosition}
                      </Typography>
                    </Box>
                  )}
                  <Box
                    sx={{
                      bgcolor: alpha(levelColor, 0.3),
                      border: `1px solid ${alpha(levelColor, 0.6)}`,
                      borderRadius: '20px',
                      px: 1.25,
                      py: 0.25,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ color: levelColor, fontWeight: 700, fontSize: '0.75rem' }}
                    >
                      {levelEntry?.name}
                    </Typography>
                  </Box>
                </Box>

                {/* Barra de XP */}
                <Box sx={{ width: '100%', mt: 2, px: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.6), fontSize: '0.65rem' }}>
                      {player.experiencePoints.toLocaleString('pt-BR')} XP
                    </Typography>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.6), fontSize: '0.65rem' }}>
                      {player.level < 20
                        ? `${xpRemaining.toLocaleString('pt-BR')} para nível ${player.level + 1}`
                        : 'Nível máximo!'}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.common.black, 0.3),
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${xpProgress * 100}%`,
                        background: XP_BAR_GRADIENT,
                        borderRadius: 3,
                        transition: 'width 0.8s ease',
                        boxShadow: `0 0 6px ${alpha(theme.palette.primary.main, 0.6)}`,
                      }}
                    />
                  </Box>
                </Box>

                {/* Divisor decorativo */}
                <Box
                  sx={{
                    width: '100%',
                    height: '1px',
                    background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.common.white, 0.2)}, transparent)`,
                    my: 2,
                  }}
                />

                {/* Stats — grid 3x2 */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1.5,
                    width: '100%',
                    px: 0.5,
                  }}
                >
                  <StatItem
                    icon={<SoccerIcon fontSize="small" />}
                    label="Jogos"
                    value={player.totalGames}
                  />
                  <StatItem
                    icon={<SoccerIcon fontSize="small" />}
                    label="Gols"
                    value={player.totalGoals}
                    color={theme.palette.primary.light}
                  />
                  <StatItem
                    icon={<StarIcon fontSize="small" />}
                    label="Assists"
                    value={player.totalAssists}
                    color={theme.palette.info.light}
                  />
                  <StatItem
                    icon={<TrophyIcon fontSize="small" />}
                    label="MVPs"
                    value={player.mvpCount}
                    color={gamificationColors.gold}
                  />
                  <StatItem
                    icon={<FireIcon fontSize="small" />}
                    label="Sequência"
                    value={player.currentStreak}
                    color={theme.palette.warning.light}
                  />
                  <StatItem
                    icon={<TrophyIcon fontSize="small" />}
                    label="Vitórias%"
                    value={`${winRate}%`}
                    color={theme.palette.secondary.light}
                  />
                </Box>

                {/* Rating overall */}
                <Box
                  sx={{
                    mt: 2,
                    px: 2,
                    py: 1,
                    bgcolor: alpha(theme.palette.common.black, 0.25),
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    width: '100%',
                  }}
                >
                  <Typography
                    sx={{
                      color: gamificationColors.gold,
                      fontWeight: 900,
                      fontSize: '2rem',
                      lineHeight: 1,
                      textShadow: `0 0 12px ${alpha(gamificationColors.gold, 0.5)}`,
                    }}
                  >
                    {player.overallRating}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: alpha(theme.palette.common.white, 0.5), fontSize: '0.75rem' }}>
                      OVERALL
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={player.overallRating}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.common.black, 0.3),
                        '& .MuiLinearProgress-bar': {
                          background: OVERALL_BAR_GRADIENT,
                          borderRadius: 3,
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
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: alpha(theme.palette.common.white, 0.3), fontSize: '0.75rem', letterSpacing: '0.1em' }}
            >
              futebadosparcas.com.br
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerCard;
