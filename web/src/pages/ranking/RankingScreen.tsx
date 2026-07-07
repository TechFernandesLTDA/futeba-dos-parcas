import React, { useState, useMemo } from 'react';
import { getPositionBadgeStyle } from '../../utils/gamificationStyle';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Alert,
  Button,
  useTheme,
  alpha,
  List,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { VirtualList } from '../../components/common/VirtualList';
import { PageContainer } from '../../components/common/PageContainer';
import { PlayerCard } from '../../components/player/PlayerCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { DemoDataChip } from '../../components/common/DemoDataChip';
import { useLeague, LeaguePlayer, LeagueFilters } from '../../hooks/useLeague';
import type { GameGender } from '../../types/game';
import { useActiveSeason } from '../../hooks/useActiveSeason';
import { DIVISION_CONFIG, getDivisionColor } from '../../types/gamification';
import { pluralizeCount } from '../../utils/pluralize';
import { getGamificationColors } from '../../utils/gamificationColors';
import { useTranslation } from 'react-i18next';
import { iconSizes } from '../../theme/iconSizes';

export const RankingScreen: React.FC = () => {
  const navigate = useNavigate();
  const goBack = useNavigateBack('/?tab=3');
  const theme = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  const showDemoData = user?.role === 'ADMIN' || import.meta.env.DEV;

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'RankingScreen' });

  const [tabValue, setTabValue] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // Fase 4b: filtro de gênero do ranking ('ALL' = combinado).
  const [genderFilter, setGenderFilter] = useState<'ALL' | GameGender>('ALL');

  // Hook compartilhado: busca temporada ativa (cache 10min)
  const { seasonId: activeSeasonId, loading: seasonLoading } = useActiveSeason();

  const filters: LeagueFilters = useMemo(() => ({
    seasonId: activeSeasonId,
    gender: genderFilter === 'ALL' ? null : genderFilter,
  }), [activeSeasonId, genderFilter]);

  const { players, loading, error, refetch } = useLeague(
    user?.id,
    filters,
    { enabled: !seasonLoading }
  );

  const ranked = useMemo(() => {
    const sorted = [...players];
    if (tabValue === 1) {
      sorted.sort((a, b) => b.mvpCount - a.mvpCount);
    } else if (tabValue === 2) {
      sorted.sort((a, b) => b.goals - a.goals);
    } else {
      sorted.sort((a, b) => b.points - a.points);
    }
    return sorted;
  }, [players, tabValue]);

  const getPositionStyle = (position: number) => getPositionBadgeStyle(position, theme);
  const columnLabel = tabValue === 1 ? t('ranking.tabMvps') : tabValue === 2 ? t('ranking.tabScorers') : t('ranking.pts');
  const hasPodium = ranked.length >= 3;
  const listRanked = hasPodium ? ranked.slice(3) : ranked;

  return (
    <Box>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper', // #2273: token canônico de sticky header
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={goBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1 }}>
            {t('ranking.title')}
          </Typography>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="fullWidth"
          aria-label={t('ranking.categoriesAria')}
        >
          <Tab label={t('ranking.tabAll')} />
          <Tab label={t('ranking.tabMvps')} />
          <Tab label={t('ranking.tabScorers')} />
        </Tabs>
        <Box sx={{ display: 'flex', justifyContent: 'center', px: 1, pb: 1 }}>
          <ToggleButtonGroup
            value={genderFilter}
            exclusive
            size="small"
            onChange={(_, v) => v && setGenderFilter(v)}
            aria-label={t('games.genderFilter.all')}
            sx={{ flexWrap: 'wrap' }}
          >
            <ToggleButton value="ALL" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.all')}
            </ToggleButton>
            <ToggleButton value="MALE" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.male')}
            </ToggleButton>
            <ToggleButton value="FEMALE" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.female')}
            </ToggleButton>
            <ToggleButton value="MIXED" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.mixed')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <PageContainer maxWidth="list">
        {loading || seasonLoading ? (
          <LoadingState shimmerCount={8} itemType="RANKING" />
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            }
            sx={{ mb: 2 }}
          >
            {t('ranking.loadError', { error })}
          </Alert>
        ) : ranked.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <TrophyIcon sx={{ fontSize: iconSizes.hero, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {t('ranking.emptyTitle')}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
              {t('ranking.emptyDesc')}
            </Typography>
            <Button variant="contained" onClick={() => navigate('/?tab=1')}>
              {t('ranking.joinGamesAction')}
            </Button>
          </Box>
        ) : (
          <>
          <PodiumSection
            players={ranked.slice(0, 3)}
            onAvatarClick={setSelectedPlayerId}
            showDemoData={showDemoData}
          />
          <Box
            sx={{
              display: 'flex',
              px: 2,
              py: 0.75,
              mb: 1,
              borderRadius: 2,
              bgcolor: 'surfaceContainer',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1, fontWeight: 700 }}>
              {t('ranking.playerColumn')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
              {columnLabel}
            </Typography>
          </Box>
          <List disablePadding aria-label={t('ranking.standingsAria')}>
            {listRanked.length > 20 ? (
              <VirtualList
                items={listRanked}
                estimateSize={100}
                overscan={3}
                getItemKey={(index) => listRanked[index].id}
                renderItem={(player, index) => (
                <RankingItem
                  player={player}
                    position={index + 4}
                    positionStyle={getPositionStyle(index + 4)}
                    tabValue={tabValue}
                    onAvatarClick={setSelectedPlayerId}
                    showDemoData={showDemoData}
                  />
                )}
              />
            ) : (
              listRanked.map((player, index) => (
                <RankingItem
                  key={player.id}
                  player={player}
                    position={index + (hasPodium ? 4 : 1)}
                    positionStyle={getPositionStyle(index + (hasPodium ? 4 : 1))}
                  tabValue={tabValue}
                  onAvatarClick={setSelectedPlayerId}
                  showDemoData={showDemoData}
                />
              ))
            )}
          </List>
          </>
        )}

        {selectedPlayerId && (
          <PlayerCard
            userId={selectedPlayerId}
            onClose={() => setSelectedPlayerId(null)}
          />
        )}
      </PageContainer>

      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
};

const PODIUM_ORDER = [1, 0, 2];

const PodiumSection = React.memo(function PodiumSection({
  players,
  onAvatarClick,
  showDemoData,
}: {
  players: LeaguePlayer[];
  onAvatarClick: (userId: string) => void;
  showDemoData: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const medals = ['1º', '2º', '3º'];

  if (players.length < 3) return null;

  // #2163: cores theme-aware (dark/OLED) para o pódio
  const gColors = getGamificationColors(theme);

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 1.5, mb: 2 }}>
      {PODIUM_ORDER.map((playerIndex) => {
        const player = players[playerIndex];
        const colors = [gColors.gold, gColors.silver, gColors.bronze];
        const isFirst = playerIndex === 0;
        return (
          <Card
            key={player.id}
            sx={{
              flex: 1,
              textAlign: 'center',
              border: `2px solid ${colors[playerIndex]}`,
              boxShadow: (theme) => `0 6px 20px ${alpha(colors[playerIndex], theme.palette.mode === 'dark' ? 0.28 : 0.18)}`,
              transform: isFirst ? 'translateY(-10px)' : undefined,
            }}
          >
            <CardContent sx={{ px: 1, py: isFirst ? 2 : 1.5, '&:last-child': { pb: isFirst ? 2 : 1.5 } }}>
              <Typography variant="h4" component="div" sx={{ lineHeight: 1 }}>
                {medals[playerIndex]}
              </Typography>
              <Box
                onClick={() => onAvatarClick(player.userId)}
                sx={{ cursor: 'pointer', my: 1 }}
                role="button"
                aria-label={`Ver figurinha de ${player.userName}`}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onAvatarClick(player.userId)}
              >
                <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} size={isFirst ? 72 : 56} level={player.level} />
              </Box>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {player.userName}
              </Typography>
              <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'center' }}>
                {showDemoData && <DemoDataChip data={player} />}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {player.points} {t('ranking.pts')}
              </Typography>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
});

const RankingItem = React.memo(function RankingItem({
  player,
  position,
  positionStyle,
  tabValue,
  onAvatarClick,
  showDemoData,
}: {
  player: LeaguePlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
  tabValue: number;
  onAvatarClick: (userId: string) => void;
  showDemoData: boolean;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <Card
      sx={{
        mb: 1,
        bgcolor: player.isCurrentUser ? (theme) => alpha(theme.palette.primary.main, 0.1) : 'background.paper',
        border: player.isCurrentUser ? (theme) => `2px solid ${theme.palette.primary.main}` : '1px solid',
        borderColor: player.isCurrentUser ? 'primary.main' : 'divider',
      }}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              ...positionStyle,
            }}
          >
            {/* Troféu apenas no 1º; 2/3 mostram numeral sobre bg prata/bronze (#1360) */}
            {position === 1 ? <TrophyIcon fontSize="small" /> : position}
          </Box>

          <Box
            onClick={() => onAvatarClick(player.userId)}
            sx={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Ver figurinha de ${player.userName}`}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onAvatarClick(player.userId)}
          >
            <PlayerAvatar
              name={player.userName}
              photoUrl={player.userPhoto}
              size={48}
              level={player.level}
            />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {player.userName}
              </Typography>
              <TeamBadge teamId={player.favoriteTeam} size={18} />
              {player.isCurrentUser && (
                <Chip label={t('ranking.you')} size="small" color="primary" />
              )}
              {showDemoData && <DemoDataChip data={player} />}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">
                {pluralizeCount(player.gamesPlayed, 'jogo', 'jogos')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.wins}V
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.goals}g
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="h6"
              fontWeight={700}
              color={getDivisionColor(player.division, theme)}
            >
              {tabValue === 1 ? player.mvpCount : tabValue === 2 ? player.goals : player.points}
            </Typography>
            <Chip
              label={DIVISION_CONFIG[player.division]?.label || 'Bronze'}
              size="small"
              sx={{
                bgcolor: alpha(getDivisionColor(player.division, theme), 0.1),
                color: getDivisionColor(player.division, theme),
                fontSize: '0.75rem',
                height: 20,
              }}
            />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});
