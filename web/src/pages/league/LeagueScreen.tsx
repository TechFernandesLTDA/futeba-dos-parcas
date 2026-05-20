import React, { useState } from 'react';
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
  MilitaryTech as MilitaryTechIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { VirtualList } from '../../components/common/VirtualList';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useLeague, LeaguePlayer } from '../../hooks/useLeague';
import { DIVISION_CONFIG, LeagueDivision } from '../../types/gamification';
import { useTranslation } from 'react-i18next';

export const LeagueScreen: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const { t } = useTranslation();

  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const divisions: LeagueDivision[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION'];
  const selectedDivision = tabValue > 0 ? divisions[tabValue - 1] : undefined;

  const { players, loading, error } = useLeague(user?.id, selectedDivision);

  // Soft retry: invalida o cache da query sem recarregar a página
  const handleRetry = () => queryClient.invalidateQueries({ queryKey: ['league'] });

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
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('nav.league')}
          </Typography>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Divisões da liga"
        >
          <Tab label={t('league.tabAll')} />
          {divisions.map((div) => (
            <Tab
              key={div}
              // Dot colorido antes do label dá identidade no estado idle; cor de texto no selecionado
              // marca a divisão atual. Removido o borderTop conflitante com TabIndicator do MUI (#1369).
              iconPosition="start"
              icon={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: DIVISION_CONFIG[div]?.color ?? 'transparent',
                  }}
                />
              }
              label={DIVISION_CONFIG[div]?.label ?? div}
              sx={{
                minHeight: 48,
                '&.Mui-selected': {
                  color: DIVISION_CONFIG[div]?.color,
                },
              }}
            />
          ))}
        </Tabs>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {loading ? (
          <LoadingState shimmerCount={8} itemType="RANKING" />
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={handleRetry}>
                {t('common.retry')}
              </Button>
            }
            sx={{ mb: 2 }}
          >
            {t('league.loadError', { error })}
          </Alert>
        ) : players.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <MilitaryTechIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {selectedDivision
                ? t('league.emptyDivisionTitle')
                : t('league.seasonNotStartedTitle')}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
              {selectedDivision
                ? t('league.emptyDivisionDesc')
                : t('league.seasonNotStartedDesc')}
            </Typography>
            {!selectedDivision && (
              <Button variant="outlined" onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }}>
                {t('league.viewPreviousSeason')}
              </Button>
            )}
          </Box>
        ) : (
          <List disablePadding aria-label={t('league.standingsAria')}>
            {players.length > 20 ? (
              <VirtualList
                items={players}
                estimateSize={100}
                overscan={3}
                getItemKey={(index) => players[index].id}
                renderItem={(player, index) => (
                  <LeaguePlayerItem
                    player={player}
                    position={index + 1}
                    positionStyle={getPositionStyle(index + 1)}
                  />
                )}
              />
            ) : (
              players.map((player, index) => (
                <LeaguePlayerItem
                  key={player.id}
                  player={player}
                  position={index + 1}
                  positionStyle={getPositionStyle(index + 1)}
                />
              ))
            )}
          </List>
        )}
      </Container>
    </Box>
  );
};

const LeaguePlayerItem = React.memo(function LeaguePlayerItem({
  player,
  position,
  positionStyle,
}: {
  player: LeaguePlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
}) {
  const divisionConfig = DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE;

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
            {position <= 3 ? <TrophyIcon fontSize="small" /> : position}
          </Box>

          <PlayerAvatar
            name={player.userName}
            photoUrl={player.userPhoto}
            size={48}
            level={player.level}
          />

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
                {player.gamesPlayed} jogos
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
              color={divisionConfig.color}
            >
              {player.points}
            </Typography>
            <Chip
              label={divisionConfig.label}
              size="small"
              sx={{
                bgcolor: alpha(divisionConfig.color, 0.1),
                color: divisionConfig.color,
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
