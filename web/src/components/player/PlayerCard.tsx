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
import html2canvas from 'html2canvas';
import { usePlayerCard } from '../../hooks/usePlayerCard';
import {
  getLevelEntry,
  getXpProgress,
  getXpRemaining,
  LEVEL_TABLE,
} from '../../types/gamification';
import { getLevelColor } from '../../types/user';

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

const StatItem: React.FC<StatItemProps> = ({ icon, label, value, color }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      minWidth: 64,
    }}
  >
    <Box sx={{ color: color || 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center' }}>
      {icon}
    </Box>
    <Typography
      variant="h6"
      sx={{
        color: '#FFFFFF',
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
        color: 'rgba(255,255,255,0.6)',
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

interface PlayerCardProps {
  userId: string | null;
  onClose: () => void;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ userId, onClose }) => {
  const theme = useTheme();
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const { data: player, isLoading, isError, refetch } = usePlayerCard(userId);

  const levelColor = player ? getLevelColor(player.level) : '#78909C';
  const levelEntry = player ? getLevelEntry(player.level) : null;
  const xpProgress = player ? getXpProgress(player.experiencePoints) : 0;
  const xpRemaining = player ? getXpRemaining(player.experiencePoints) : 0;
  const nextLevelXp = player && player.level < 20
    ? LEVEL_TABLE[player.level + 1]?.xpRequired ?? 0
    : 0;

  // Captura o card como PNG e compartilha ou faz download
  const handleShare = useCallback(async () => {
    if (!cardRef.current || !player) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
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
          } catch (_e) {
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
    } catch (_e) {
      setSharing(false);
    }
  }, [player]);

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
                color: '#fff',
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
                disabled={sharing || isLoading || !player}
                aria-label="Compartilhar card do jogador"
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.9),
                  color: '#fff',
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
            background: `linear-gradient(160deg, #1B5E20 0%, #2E7D32 35%, #388E3C 60%, #43A047 100%)`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)`,
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
                  rgba(255,255,255,0.03) 28px,
                  rgba(255,255,255,0.03) 56px
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
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.6rem',
                letterSpacing: '0.15em',
              }}
            >
              FUTEBA DOS PARÇAS
            </Typography>
            <Box
              sx={{
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: '6px',
                px: 0.75,
                py: 0.25,
              }}
            >
              <Typography
                variant="overline"
                sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem', letterSpacing: '0.1em' }}
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
            {isLoading ? (
              <>
                <Skeleton variant="circular" width={120} height={120} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                <Skeleton variant="text" width={160} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mt: 1.5 }} />
                <Skeleton variant="text" width={100} sx={{ bgcolor: 'rgba(255,255,255,0.1)', mt: 0.5 }} />
              </>
            ) : isError ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="error" gutterBottom>Erro ao carregar jogador</Typography>
                <IconButton onClick={() => refetch()} size="small" sx={{ color: '#fff' }}>
                  Tentar novamente
                </IconButton>
              </Box>
            ) : player ? (
              <>
                {/* Avatar com borda dourada + badge de nível */}
                <Box sx={{ position: 'relative', mb: 1.5 }}>
                  <Box
                    sx={{
                      borderRadius: '50%',
                      p: '3px',
                      background: `linear-gradient(135deg, #FFD700, #FFA000, #FFD700)`,
                      boxShadow: `0 0 20px rgba(255,215,0,0.4)`,
                    }}
                  >
                    <Avatar
                      src={player.photoUrl}
                      alt={player.name}
                      sx={{
                        width: 120,
                        height: 120,
                        bgcolor: alpha(levelColor, 0.3),
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: '#fff',
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
                      border: '2px solid #1B5E20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 2px 8px rgba(0,0,0,0.4)`,
                    }}
                  >
                    <Typography
                      sx={{
                        color: '#fff',
                        fontWeight: 900,
                        fontSize: '0.7rem',
                        lineHeight: 1,
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      }}
                    >
                      {player.level}
                    </Typography>
                  </Box>
                </Box>

                {/* Nome e apelido */}
                <Typography
                  variant="h5"
                  sx={{
                    color: '#FFFFFF',
                    fontWeight: 800,
                    textAlign: 'center',
                    lineHeight: 1.1,
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {player.name}
                </Typography>

                {player.nickname && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'rgba(255,255,255,0.65)',
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
                        bgcolor: 'rgba(255,255,255,0.15)',
                        borderRadius: '20px',
                        px: 1.25,
                        py: 0.25,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '0.7rem' }}
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
                      sx={{ color: levelColor, fontWeight: 700, fontSize: '0.7rem' }}
                    >
                      {levelEntry?.name}
                    </Typography>
                  </Box>
                </Box>

                {/* Barra de XP */}
                <Box sx={{ width: '100%', mt: 2, px: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}>
                      {player.experiencePoints.toLocaleString('pt-BR')} XP
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}>
                      {player.level < 20
                        ? `${xpRemaining.toLocaleString('pt-BR')} para nível ${player.level + 1}`
                        : 'Nível máximo!'}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(0,0,0,0.3)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${xpProgress * 100}%`,
                        background: `linear-gradient(90deg, #00C853, #FFD700)`,
                        borderRadius: 3,
                        transition: 'width 0.8s ease',
                        boxShadow: '0 0 6px rgba(0,200,83,0.6)',
                      }}
                    />
                  </Box>
                </Box>

                {/* Divisor decorativo */}
                <Box
                  sx={{
                    width: '100%',
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
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
                    color="#4ADE80"
                  />
                  <StatItem
                    icon={<StarIcon fontSize="small" />}
                    label="Assists"
                    value={player.totalAssists}
                    color="#60A5FA"
                  />
                  <StatItem
                    icon={<TrophyIcon fontSize="small" />}
                    label="MVPs"
                    value={player.mvpCount}
                    color="#FFD700"
                  />
                  <StatItem
                    icon={<FireIcon fontSize="small" />}
                    label="Sequência"
                    value={player.currentStreak}
                    color="#FB923C"
                  />
                  <StatItem
                    icon={<TrophyIcon fontSize="small" />}
                    label="Vitórias%"
                    value={`${winRate}%`}
                    color="#A78BFA"
                  />
                </Box>

                {/* Rating overall */}
                <Box
                  sx={{
                    mt: 2,
                    px: 2,
                    py: 1,
                    bgcolor: 'rgba(0,0,0,0.25)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    width: '100%',
                  }}
                >
                  <Typography
                    sx={{
                      color: '#FFD700',
                      fontWeight: 900,
                      fontSize: '2rem',
                      lineHeight: 1,
                      textShadow: '0 0 12px rgba(255,215,0,0.5)',
                    }}
                  >
                    {player.overallRating}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>
                      OVERALL
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={player.overallRating}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(0,0,0,0.3)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #FFD700, #FF8C00)',
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
              bgcolor: 'rgba(0,0,0,0.2)',
              px: 2,
              py: 1,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.6rem', letterSpacing: '0.1em' }}
            >
              futebadosparcas.web.app
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerCard;
