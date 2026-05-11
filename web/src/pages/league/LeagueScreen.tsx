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

  const [tabValue, setTabValue] = useState(0);
  const divisions: LeagueDivision[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION'];
  const selectedDivision = tabValue > 0 ? divisions[tabValue - 1] : undefined;

  const { players, loading, error } = useLeague(user?.id, selectedDivision);

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
          <IconButton onClick={() => navigate(-1)} aria-label={t('common.back')}>
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
          <Tab label="Geral" />
          {divisions.map((div) => (
            <Tab
              key={div}
              label={DIVISION_CONFIG[div]?.label ?? div}
              sx={{
                borderTop: tabValue === divisions.indexOf(div) + 1 ? 3 : 0,
                borderColor: DIVISION_CONFIG[div]?.color ?? 'transparent',
                '&.Mui-selected': {
                  color: DIVISION_CONFIG[div]?.color,
                  borderTop: 3,
                  borderColor: DIVISION_CONFIG[div]?.color,
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
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => window.location.reload()}>
                {t('common.retry')}
              </Button>
            }
            sx={{ mb: 2 }}
          >
            Erro ao carregar liga: {error}
          </Alert>
        ) : players.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <MilitaryTechIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogador nesta divisão
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Participe de jogos para entrar na liga!
            </Typography>
          </Box>
        ) : (
          <List disablePadding aria-label="Classificação da liga">
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
