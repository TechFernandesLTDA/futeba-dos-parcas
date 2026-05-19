import React, { useState, useMemo } from 'react';
import { getPositionBadgeStyle } from '../../utils/gamificationStyle';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
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
  useMediaQuery,
  alpha,
  List,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { VirtualList } from '../../components/common/VirtualList';
import { PlayerCard } from '../../components/player/PlayerCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useLeague, LeaguePlayer } from '../../hooks/useLeague';
import { DIVISION_CONFIG } from '../../types/gamification';
import { pluralizeCount } from '../../utils/pluralize';
import { useTranslation } from 'react-i18next';

export const RankingScreen: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tabValue, setTabValue] = useState(0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const { players, loading, error } = useLeague(user?.id);

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

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label={t('common.back')}>
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
          aria-label="Categorias do ranking"
        >
          <Tab label="Geral" />
          <Tab label="MVPs" />
          <Tab label="Artilheiros" />
        </Tabs>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={8} itemType="RANKING" />
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => queryClient.invalidateQueries()}>
                {t('common.retry')}
              </Button>
            }
            sx={{ mb: 2 }}
          >
            Erro ao carregar ranking: {error}
          </Alert>
        ) : ranked.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <TrophyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogador no ranking
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Participe de jogos para entrar no ranking!
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Classificação do ranking">
            {ranked.length > 20 ? (
              <VirtualList
                items={ranked}
                estimateSize={100}
                overscan={3}
                getItemKey={(index) => ranked[index].id}
                renderItem={(player, index) => (
                  <RankingItem
                    player={player}
                    position={index + 1}
                    positionStyle={getPositionStyle(index + 1)}
                    tabValue={tabValue}
                    onAvatarClick={setSelectedPlayerId}
                  />
                )}
              />
            ) : (
              ranked.map((player, index) => (
                <RankingItem
                  key={player.id}
                  player={player}
                  position={index + 1}
                  positionStyle={getPositionStyle(index + 1)}
                  tabValue={tabValue}
                  onAvatarClick={setSelectedPlayerId}
                />
              ))
            )}
          </List>
        )}

        {selectedPlayerId && (
          <PlayerCard
            userId={selectedPlayerId}
            onClose={() => setSelectedPlayerId(null)}
          />
        )}
      </Container>
    </Box>
  );
};

const RankingItem = React.memo(function RankingItem({
  player,
  position,
  positionStyle,
  tabValue,
  onAvatarClick,
}: {
  player: LeaguePlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
  tabValue: number;
  onAvatarClick: (userId: string) => void;
}) {
  const theme = useTheme();
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
                <Chip label="Você" size="small" color="primary" />
              )}
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
              color={DIVISION_CONFIG[player.division]?.color || 'text.primary'}
            >
              {tabValue === 1 ? player.mvpCount : tabValue === 2 ? player.goals : player.points}
            </Typography>
            <Chip
              label={DIVISION_CONFIG[player.division]?.label || 'Bronze'}
              size="small"
              sx={{
                bgcolor: alpha(DIVISION_CONFIG[player.division]?.color || theme.palette.text.primary, 0.1),
                color: DIVISION_CONFIG[player.division]?.color || theme.palette.text.primary,
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
