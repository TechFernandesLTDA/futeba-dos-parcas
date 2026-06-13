import { PageContainer } from '../../../components/common/PageContainer';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGamificationColors } from '../../../hooks/useGamificationColors';
import { iconSizes } from '../../../theme/iconSizes';
import { getPositionBadgeStyle } from '../../../utils/gamificationStyle';
import { getLevelColor } from '../../../types/user';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Tabs,
  Tab,
  Chip,
  Skeleton,
  useTheme,
  useMediaQuery,
  alpha,
  LinearProgress,
  IconButton,
  Tooltip,
  Fade,
  Button,
} from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  EmojiEvents,
  MilitaryTech as MilitaryTechIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenIcon,
  SportsSoccer,
  SportsScore,
  AssistWalker,
  SportsMartialArts,
  Whatshot,
  Handshake,
  Shield,
  Star,
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { PullToRefresh } from '../../../components/common/PullToRefresh';
import { PlayerAvatar } from '../../../components/common/GameCard';
import { PlayerCard } from '../../../components/player/PlayerCard';
import { TeamBadge } from '../../../components/team/TeamBadge';
import { useLeague, LeaguePlayer, LeagueFilters } from '../../../hooks/useLeague';
import { useActiveSeason } from '../../../hooks/useActiveSeason';
import { DIVISION_CONFIG, LeagueDivision, getXpProgress, getDivisionColor } from '../../../types/gamification';
import { getLevelBadgeImage, handleBadgeImageError } from '../../../utils/levelBadge';
import {
  XP_PARTICIPATION, XP_GOAL, XP_ASSIST, XP_SAVE,
  XP_MVP, XP_WIN, XP_DRAW, XP_STREAK_3, XP_STREAK_5, XP_STREAK_7, XP_STREAK_10,
} from '../../../utils/constants';
import { useGroups } from '../../../hooks/useGroups';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '../../../components/common/ErrorState';
import { ScreenHeader } from '../../../components/common/ScreenHeader';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';

const spinnerKeyframes = {
  '@keyframes spin': {
    '100%': { transform: 'rotate(360deg)' },
  },
};

// Tabela de XP por ação para referência rápida
const XP_TABLE = [
  { labelKey: 'ranking.xpTable.participation', xp: XP_PARTICIPATION, Icon: SportsSoccer, color: 'primary' as const },
  { labelKey: 'ranking.xpTable.goal', xp: XP_GOAL, Icon: SportsScore, color: 'success' as const },
  { labelKey: 'ranking.xpTable.assist', xp: XP_ASSIST, Icon: AssistWalker, color: 'info' as const },
  { labelKey: 'ranking.xpTable.save', xp: XP_SAVE, Icon: Shield, color: 'secondary' as const },
  { labelKey: 'ranking.xpTable.mvp', xp: XP_MVP, Icon: StarIcon, color: 'warning' as const },
  { labelKey: 'ranking.xpTable.win', xp: XP_WIN, Icon: TrophyIcon, color: 'warning' as const },
  { labelKey: 'ranking.xpTable.draw', xp: XP_DRAW, Icon: Handshake, color: 'default' as const },
  { labelKey: 'ranking.xpTable.streak3', xp: XP_STREAK_3, Icon: Whatshot, color: 'error' as const },
  { labelKey: 'ranking.xpTable.streak5', xp: XP_STREAK_5, Icon: Whatshot, color: 'error' as const },
  { labelKey: 'ranking.xpTable.streak7', xp: XP_STREAK_7, Icon: Whatshot, color: 'error' as const },
  { labelKey: 'ranking.xpTable.streak10', xp: XP_STREAK_10, Icon: SportsMartialArts, color: 'error' as const },
];

// #1217 - Podium section for top 3 players with distinct visual hierarchy
// Helper to render a single podium card
const PodiumCard: React.FC<{
  player: LeaguePlayer;
  config: { position: number; label: string; Icon: React.ElementType; size: number; borderColor: string; bgColor: string; gradient: string; iconColor: string };
  showXP: boolean;
  positionChange: number | null;
  onAvatarClick: (userId: string) => void;
}> = ({ player, config, showXP, positionChange, onAvatarClick }) => {
  const theme = useTheme();
  // #2163: color theme-aware (dark/OLED); label/minPoints vêm do config estático
  const divisionConfig = {
    ...(DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE),
    color: getDivisionColor(player.division, theme),
  };
  const levelColor = getLevelColor(player.level, theme);

  return (
    <Card
      sx={{
        flex: 1,
        maxWidth: 170,
        minWidth: 0,
        background: config.gradient,
        border: `2px solid ${config.borderColor}`,
        borderColor: config.borderColor,
        borderRadius: 2,
        transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shortest }),
        '&:active': { transform: 'scale(0.97)' },
      }}
    >
      <CardContent sx={{ py: 1.5, textAlign: 'center', '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ mb: 0.5 }}>
          <config.Icon sx={{ color: config.iconColor, fontSize: iconSizes.lg }} />
        </Box>
        <Typography variant="caption" fontWeight={700} sx={{ color: config.borderColor, mb: 1, display: 'block' }}>
          {config.label}
        </Typography>
        <Box
          onClick={() => onAvatarClick(player.userId)}
          sx={{ cursor: 'pointer', display: 'inline-block' }}
          role="button"
          aria-label={`Ver figurinha de ${player.userName}`}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAvatarClick(player.userId);
            }
          }}
        >
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <PlayerAvatar
              name={player.userName}
              photoUrl={player.userPhoto}
              size={config.size}
              level={player.level}
              borderColor={levelColor}
            />
            {player.level > 0 && (
              <Box
                component="img"
                src={getLevelBadgeImage(player.level)}
                onError={handleBadgeImageError}
                loading="lazy"
                decoding="async"
                alt={`Nível ${player.level}`}
                sx={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: `2px solid ${theme.palette.background.paper}`,
                }}
              />
            )}
          </Box>
        </Box>
        <Typography
          variant="body2"
          fontWeight={700}
          noWrap
          sx={{ mt: 1, maxWidth: 130, mx: 'auto' }}
        >
          {player.userName}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
          <TeamBadge teamId={player.favoriteTeam} size={16} />
          {player.isCurrentUser && (
            <Chip label="Você" size="small" color="primary" sx={{ height: 18, fontSize: '0.75rem' }} />
          )}
        </Box>
        <Typography variant="subtitle2" fontWeight={700} color={showXP ? 'primary.main' : divisionConfig.color} sx={{ mt: 0.5 }}>
          {(showXP ? (player.experiencePoints || 0) : player.points).toLocaleString('pt-BR')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {showXP ? 'XP' : divisionConfig.label} · Nv. {player.level}
        </Typography>
        {positionChange !== null && positionChange !== 0 && (
          <Typography variant="caption" fontWeight={700} color={positionChange > 0 ? 'success.main' : 'error.main'} sx={{ display: 'block', mt: 0.25 }}>
            {positionChange > 0 ? '▲' : '▼'} {Math.abs(positionChange)}
          </Typography>
        )}
        {positionChange === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
            —
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

const PodiumSection: React.FC<{
  players: LeaguePlayer[];
  showXP: boolean;
  positionChanges: Record<string, number | null>;
  onAvatarClick: (userId: string) => void;
}> = ({ players, showXP, positionChanges, onAvatarClick }) => {
  const theme = useTheme();
  const gColors = useGamificationColors();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));

  if (players.length === 0) return null;

  const top3 = players.slice(0, 3);
  const podiumConfig = [
    {
      position: 1,
      label: '1º',
      Icon: EmojiEvents,
      size: isXs ? 52 : 64,
      borderColor: gColors.gold,
      bgColor: alpha(gColors.gold, 0.12),
      gradient: `linear-gradient(180deg, ${alpha(gColors.gold, 0.18)}, ${alpha(gColors.gold, 0.04)})`,
      iconColor: gColors.gold,
    },
    {
      position: 2,
      label: '2º',
      Icon: MilitaryTechIcon,
      size: isXs ? 44 : 56,
      borderColor: gColors.silver,
      bgColor: alpha(gColors.silver, 0.12),
      gradient: `linear-gradient(180deg, ${alpha(gColors.silver, 0.15)}, ${alpha(gColors.silver, 0.03)})`,
      iconColor: gColors.silver,
    },
    {
      position: 3,
      label: '3º',
      Icon: Star,
      size: isXs ? 40 : 48,
      borderColor: gColors.bronze,
      bgColor: alpha(gColors.bronze, 0.12),
      gradient: `linear-gradient(180deg, ${alpha(gColors.bronze, 0.15)}, ${alpha(gColors.bronze, 0.03)})`,
      iconColor: gColors.bronze,
    },
  ];

  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  if (isXs) {
    return (
      <Box sx={{ mb: 3, mt: 1 }}>
        {/* 1st place - full width on top */}
        {first && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
            <Box sx={{ width: '80%', maxWidth: 200 }}>
              <PodiumCard
                player={first}
                config={podiumConfig[0]}
                showXP={showXP}
                positionChange={positionChanges[first.userId]}
                onAvatarClick={onAvatarClick}
              />
            </Box>
          </Box>
        )}
        {/* 2nd and 3rd side by side below */}
        {(second || third) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            {second && (
              <Box sx={{ flex: 1, maxWidth: 170 }}>
                <PodiumCard
                  player={second}
                  config={podiumConfig[1]}
                  showXP={showXP}
                  positionChange={positionChanges[second.userId]}
                  onAvatarClick={onAvatarClick}
                />
              </Box>
            )}
            {third && (
              <Box sx={{ flex: 1, maxWidth: 170 }}>
                <PodiumCard
                  player={third}
                  config={podiumConfig[2]}
                  showXP={showXP}
                  positionChange={positionChanges[third.userId]}
                  onAvatarClick={onAvatarClick}
                />
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 2, mb: 3, mt: 1 }}>
      {podiumConfig.map((config, idx) => {
        const player = top3[idx];
        if (!player) return null;

        return (
          <PodiumCard
            key={player.id}
            player={player}
            config={config}
            showXP={showXP}
            positionChange={positionChanges[player.userId]}
            onAvatarClick={onAvatarClick}
          />
        );
      })}
    </Box>
  );
};

export function RankingsTab() {
    const theme = useTheme();
    const gColors = useGamificationColors();
    const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  useDocumentTitle(t('nav.league'));

  const [tabValue, setTabValue] = useState(0); // 0=Liga, 1=XP Global, 2=Sistema XP
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [ligaPositionChanges, setLigaPositionChanges] = useState<Record<string, number | null>>({});
  const [xpPositionChanges, setXpPositionChanges] = useState<Record<string, number | null>>({});
  const { groups: userGroups } = useGroups();

  // Hook compartilhado: busca temporada ativa (cache 10min)
  const { seasonId: activeSeasonId, loading: seasonLoading } = useActiveSeason();

  const filters: LeagueFilters = useMemo(() => ({
    groupId: selectedGroupId,
    seasonId: activeSeasonId,
  }), [selectedGroupId, activeSeasonId]);

  const { players, loading, error: errorState, refetch } = useLeague(user?.id, filters, { enabled: !!activeSeasonId });

  // Position change tracking via localStorage (#1238)
  useEffect(() => {
    if (loading || players.length === 0) return;

    let prevLiga: Record<string, number> = {};
    let prevXp: Record<string, number> = {};
    try {
      prevLiga = JSON.parse(localStorage.getItem('rankings_prev_positions_liga') || '{}') as Record<string, number>;
      prevXp = JSON.parse(localStorage.getItem('rankings_prev_positions_xp') || '{}') as Record<string, number>;
    } catch (error) {
      console.warn('Failed to read rankings positions from localStorage:', error);
    }
    const currentLiga: Record<string, number> = {};
    players.forEach((p, i) => { currentLiga[p.userId] = i + 1; });
    const xpSorted = [...players].sort((a, b) => (b.experiencePoints || 0) - (a.experiencePoints || 0));
    const currentXp: Record<string, number> = {};
    xpSorted.forEach((p, i) => { currentXp[p.userId] = i + 1; });
    const ligaChanges: Record<string, number | null> = {};
    for (const [uid, pos] of Object.entries(currentLiga)) {
      const prev = prevLiga[uid];
      ligaChanges[uid] = prev !== undefined ? prev - pos : null;
    }
    const xpChanges: Record<string, number | null> = {};
    for (const [uid, pos] of Object.entries(currentXp)) {
      const prev = prevXp[uid];
      xpChanges[uid] = prev !== undefined ? prev - pos : null;
    }
    try {
      localStorage.setItem('rankings_prev_positions_liga', JSON.stringify(currentLiga));
      localStorage.setItem('rankings_prev_positions_xp', JSON.stringify(currentXp));
    } catch (error) {
      console.warn('Failed to save rankings positions to localStorage:', error);
    }
    setLigaPositionChanges(ligaChanges);
    setXpPositionChanges(xpChanges);
  }, [players, loading]);

  const handleRefresh = useCallback(async () => {
    refetch();
  }, [refetch]);

  // #2272: posição/jogador atual memoizados — findIndex/find rodavam a cada render.
  const currentPlayer = useMemo(() => players.find(p => p.isCurrentUser), [players]);
  const currentUserRank = useMemo(
    () => players.findIndex(p => p.isCurrentUser) + 1,
    [players],
  );
  const currentPlayerLevelColor = currentPlayer ? getLevelColor(currentPlayer.level, theme) : theme.palette.primary.main;

  const positionChanges = tabValue === 1 ? xpPositionChanges : ligaPositionChanges;

  const getPositionStyle = (position: number) => getPositionBadgeStyle(position, theme);

  // Memoizado: recalcula apenas quando players ou tabValue mudam
  const sortedPlayers = useMemo(() => {
    if (tabValue === 1) {
      // Ranking por XP global
      return [...players].sort((a, b) => (b.experiencePoints || 0) - (a.experiencePoints || 0));
    }
    // Liga por pontos da temporada
    return players;
  }, [players, tabValue]);

  return (
    <Box sx={{ minHeight: '100%' }}>
      <ScreenHeader
        title={t('nav.league')}
        actions={
          <Tooltip title={t('common.refresh')}>
            <IconButton
              onClick={handleRefresh}
              size="small"
              aria-label={t('ranking.refreshRankings')}
            >
              <RefreshIcon sx={{ animation: loading ? 'spin 1s linear infinite' : 'none', ...spinnerKeyframes }} />
            </IconButton>
          </Tooltip>
        }
      />
      {userGroups.length > 0 && (
        <Box sx={{ px: 2, pt: 0.5, pb: 1, display: 'flex', gap: 0.5, overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          <Chip
            label={t('ranking.global')}
            size="small"
            variant={selectedGroupId === null ? 'filled' : 'outlined'}
            color={selectedGroupId === null ? 'primary' : 'default'}
            clickable
            onClick={() => setSelectedGroupId(null)}
            sx={{ fontWeight: 600, textTransform: 'none' }}
          />
          {userGroups.map((g) => {
            const isActive = selectedGroupId === g.id;
            return (
              <Chip
                key={g.id}
                label={g.name}
                size="small"
                variant={isActive ? 'filled' : 'outlined'}
                color={isActive ? 'primary' : 'default'}
                clickable
                onClick={() => setSelectedGroupId(isActive ? null : g.id)}
                sx={{ fontWeight: 600, textTransform: 'none' }}
              />
            );
          })}
        </Box>
      )}
      <Tabs
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        variant="fullWidth"
        aria-label={t('ranking.categoriesAria')}
        sx={{ minHeight: 40 }}
      >
        <Tab label={t('nav.league')} sx={{ minHeight: 40, py: 0 }} />
        <Tab label={t('ranking.xpGlobal')} sx={{ minHeight: 40, py: 0 }} />
        <Tab label={t('ranking.xpSystem')} sx={{ minHeight: 40, py: 0 }} />
      </Tabs>

      <PullToRefresh onRefresh={handleRefresh}>
      <PageContainer maxWidth="dashboard">
        {errorState && (
          <ErrorState
            message={errorState}
            onRetry={handleRefresh}
            retryLabel={t('common.retry')}
          />
        )}

        {/* Card de posição do usuário atual */}
        {tabValue !== 2 && currentPlayer && (
          <Fade in>
            <Card
              sx={{
                mb: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.main, 0.05)})`,
                border: `2px solid ${theme.palette.primary.main}`,
              }}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ position: 'relative' }}>
                    <PlayerAvatar
                      name={currentPlayer.userName}
                      photoUrl={currentPlayer.userPhoto}
                      size={56}
                      level={currentPlayer.level}
                      borderColor={currentPlayerLevelColor}
                    />
                    {currentPlayer.level > 0 && (
                      <Box
                        component="img"
                        src={getLevelBadgeImage(currentPlayer.level)}
                        onError={handleBadgeImageError}
                        loading="lazy"
                        decoding="async"
                        alt={`Nível ${currentPlayer.level}`}
                        sx={{
                          position: 'absolute',
                          bottom: -4,
                          right: -4,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          border: `2px solid ${theme.palette.background.paper}`,
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {t('ranking.myPosition')}
                    </Typography>
                    <Typography variant="h5" fontWeight={700} color="primary.main">
                      #{currentUserRank}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h5" fontWeight={700}>
                      {(tabValue === 1 ? currentPlayer.experiencePoints : currentPlayer.points)?.toLocaleString('pt-BR')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tabValue === 1 ? 'XP Total' : t('ranking.points')}
                    </Typography>
                    {tabValue === 0 && (
                      <Chip
                        label={DIVISION_CONFIG[currentPlayer.division]?.label || 'Bronze'}
                        size="small"
                        sx={{
                          mt: 0.5,
                          bgcolor: alpha(getDivisionColor(currentPlayer.division, theme), 0.15),
                          color: getDivisionColor(currentPlayer.division, theme),
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                </Box>
                {/* Barra de progresso de XP */}
                {currentPlayer.experiencePoints !== undefined && (
                  <Box sx={{ mt: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.level')} {currentPlayer.level}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentPlayer.experiencePoints?.toLocaleString('pt-BR')} XP
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={getXpProgress(currentPlayer.experiencePoints || 0) * 100}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: 'primary.main',
                        },
                      }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* Aba Sistema XP */}
        {tabValue === 2 && (
          <Fade in>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                {t('ranking.howXpWorks')}
              </Typography>
              <Card sx={{ mb: 2 }}>
                <CardContent sx={{ p: 0 }}>
                  {XP_TABLE.map((item, index) => (
                    <Box
                      key={item.labelKey}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.5,
                        borderBottom: index < XP_TABLE.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                      }}
                    >
                      <Box sx={{ mr: 1.5, width: 36, display: 'flex', justifyContent: 'center' }}>
                        <item.Icon color={item.color === 'default' ? 'action' : item.color} fontSize="small" />
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1 }} fontWeight={500}>
                        {t(item.labelKey)}
                      </Typography>
                      <Chip
                        label={`+${item.xp} XP`}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 700, minWidth: 72 }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>

              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                {t('league.divisions')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(Object.entries(DIVISION_CONFIG) as [LeagueDivision, typeof DIVISION_CONFIG[LeagueDivision]][]).map(([key, config]) => {
                  // #2163: color theme-aware (dark/OLED)
                  const divColor = getDivisionColor(key, theme);
                  return (
                  <Card key={key} sx={{ border: `1px solid ${alpha(divColor, 0.3)}` }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <MilitaryTechIcon sx={{ color: divColor, fontSize: iconSizes.lg }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ color: divColor }}>
                            {config.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {config.minPoints ? t('ranking.minPoints', { points: config.minPoints }) : t('ranking.startingDivision')}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                  );
                })}
              </Box>

              {/* Links para telas detalhadas */}
              <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                <Card sx={{ flex: 1 }}>
                  <CardActionArea onClick={() => navigate('/league')} sx={{ p: 2, textAlign: 'center' }}>
                    <MilitaryTechIcon sx={{ fontSize: iconSizes.xl, color: 'primary.main', mb: 0.5 }} />
                    <Typography variant="body2" fontWeight={600}>
                      {t('ranking.fullLeague')}
                    </Typography>
                    <OpenIcon sx={{ fontSize: iconSizes.xs, color: 'text.disabled', mt: 0.5 }} />
                  </CardActionArea>
                </Card>
                <Card sx={{ flex: 1 }}>
                  <CardActionArea onClick={() => navigate('/level-journey')} sx={{ p: 2, textAlign: 'center' }}>
                    <StarIcon sx={{ fontSize: iconSizes.xl, color: gColors.gold, mb: 0.5 }} />
                    <Typography variant="body2" fontWeight={600}>
                      {t('profile.levelJourney')}
                    </Typography>
                    <OpenIcon sx={{ fontSize: iconSizes.xs, color: 'text.disabled', mt: 0.5 }} />
                  </CardActionArea>
                </Card>
              </Box>
            </Box>
          </Fade>
        )}

        {/* Lista de jogadores (Liga ou XP Global) */}
        {tabValue !== 2 && (
          loading || seasonLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="circular" width={48} height={48} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="60%" />
                      <Skeleton variant="text" width="40%" />
                    </Box>
                    <Skeleton variant="text" width={40} />
                  </Box>
                </CardContent>
              </Card>
            ))
          ) : sortedPlayers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <TrophyIcon sx={{ fontSize: iconSizes.hero, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {t('ranking.noPlayers')}
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
                {t('ranking.top100Desc')}
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/?tab=1')}>
                {t('ranking.joinGamesAction')}
              </Button>
            </Box>
          ) : (
            <>
              <PodiumSection
                players={sortedPlayers}
                showXP={tabValue === 1}
                positionChanges={positionChanges}
                onAvatarClick={setSelectedPlayerId}
              />
              {sortedPlayers.slice(3).map((player, index) => (
                <RankingCard
                  key={player.id}
                  player={player}
                  position={index + 4}
                  positionStyle={getPositionStyle(index + 4)}
                  showXP={tabValue === 1}
                  onAvatarClick={setSelectedPlayerId}
                  positionChange={positionChanges[player.userId]}
                />
              ))}
            </>
          )
        )}
      </PageContainer>
      </PullToRefresh>

      {/* Figurinha do jogador */}
      <PlayerCard
        userId={selectedPlayerId}
        onClose={() => setSelectedPlayerId(null)}
      />
    </Box>
  );
}

// Card de ranking individual
const RankingCard = React.memo(function RankingCard({
  player,
  position,
  positionStyle,
  showXP,
  onAvatarClick,
  positionChange,
}: {
  player: LeaguePlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
  showXP: boolean;
  onAvatarClick: (userId: string) => void;
  positionChange: number | null;
}) {
  const theme = useTheme();
  // #2163: color theme-aware (dark/OLED)
  const divisionConfig = {
    ...(DIVISION_CONFIG[player.division as LeagueDivision] || DIVISION_CONFIG.BRONZE),
    color: getDivisionColor(player.division as LeagueDivision, theme),
  };
  const levelColor = getLevelColor(player.level, theme);

  return (
    <Card
      sx={{
        mb: 1,
        bgcolor: player.isCurrentUser ? (theme) => alpha(theme.palette.primary.main, 0.08) : 'background.paper',
        border: player.isCurrentUser ? (theme) => `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: player.isCurrentUser ? 'primary.main' : 'divider',
        transition: (t) => t.transitions.create('transform', { duration: t.transitions.duration.shortest }),
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Posição */}
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              flexShrink: 0,
              ...positionStyle,
            }}
          >
            {/* Troféu apenas no 1º; 2/3 mostram numeral sobre bg prata/bronze (#1360) */}
            {position === 1 ? <TrophyIcon sx={{ fontSize: iconSizes.sm }} /> : position}
          </Box>

          {/* Avatar — clique abre a figurinha do jogador */}
          <Box
            onClick={() => onAvatarClick(player.userId)}
            sx={{ cursor: 'pointer', flexShrink: 0 }}
            role="button"
            aria-label={`Ver figurinha de ${player.userName}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAvatarClick(player.userId);
              }
            }}
          >
            <PlayerAvatar
              name={player.userName}
              photoUrl={player.userPhoto}
              size={44}
              level={player.level}
              borderColor={levelColor}
            />
          </Box>

          {/* Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ maxWidth: { xs: 80, sm: 140, md: 200 } }}
              >
                {player.userName}
              </Typography>
              <TeamBadge teamId={player.favoriteTeam} size={18} />
              {player.isCurrentUser && (
                <Chip label="Você" size="small" color="primary" sx={{ height: 18, fontSize: '0.75rem' }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" noWrap>
                {player.gamesPlayed.toLocaleString('pt-BR')}J · {player.wins.toLocaleString('pt-BR')}V · {player.goals.toLocaleString('pt-BR')}G
              </Typography>
              {positionChange !== null && positionChange !== 0 && (
                <Typography variant="caption" fontWeight={700} color={positionChange > 0 ? 'success.main' : 'error.main'} sx={{ whiteSpace: 'nowrap' }}>
                  {positionChange > 0 ? '▲' : '▼'} {Math.abs(positionChange)}
                </Typography>
              )}
              {positionChange === 0 && (
                <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                  —
                </Typography>
              )}
            </Box>
          </Box>

          {/* Pontuação */}
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} color={showXP ? 'primary.main' : divisionConfig.color}>
              {(showXP ? (player.experiencePoints || 0) : player.points).toLocaleString('pt-BR')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {showXP ? 'XP' : divisionConfig.label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});
