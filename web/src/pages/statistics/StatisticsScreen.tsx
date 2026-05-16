import React, { useState, useEffect, useCallback } from 'react';
import { gamificationColors } from '../../theme';
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
  Skeleton,
  Grid,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  SportsSoccer as SoccerIcon,
  MilitaryTech as MedalIcon,
  Whatshot as FireIcon,
} from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { getLevelTitle, getLevelColor } from '../../types/user';
import { PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';
import { TeamBadge } from '../../components/team/TeamBadge';

const logger = createLogger('StatisticsScreen');

interface UserStats {
  totalGames: number;
  totalGoals: number;
  totalAssists: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  totalSaves: number;
  mvpCount: number;
  bestGkCount: number;
  yellowCards: number;
  redCards: number;
  currentStreak: number;
  bestStreak: number;
  level: number;
  experiencePoints: number;
}

export const StatisticsScreen: React.FC = () => {
  useDocumentTitle('Estatísticas');
  const navigate = useNavigate();
    const theme = useTheme();
    const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const { showError } = useToast();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const loadStats = useCallback(async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user!.id);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        setStats(snakeToCamel(docSnap.data()) as UserStats);
      }
    } catch (err) {
      logger.error('Error loading stats:', err);
      showError('Erro ao carregar estatísticas. Tente novamente.');
      setError('Erro ao carregar estatísticas');
    }
    setLoading(false);
  }, [user, showError]);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, loadStats]);

  const getWinRate = () => {
    if (!stats || stats.totalGames === 0) return 0;
    return ((stats.totalWins / stats.totalGames) * 100).toFixed(1);
  };

  const getDrawRate = () => {
    if (!stats || stats.totalGames === 0) return 0;
    return ((stats.totalDraws / stats.totalGames) * 100).toFixed(1);
  };

  const getLossRate = () => {
    if (!stats || stats.totalGames === 0) return 0;
    return ((stats.totalLosses / stats.totalGames) * 100).toFixed(1);
  };

  const getGoalsPerGame = () => {
    if (!stats || stats.totalGames === 0) return '0.0';
    return (stats.totalGoals / stats.totalGames).toFixed(2);
  };

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
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1 }}>
            Estatísticas
          </Typography>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="fullWidth"
          aria-label="Categorias de estatísticas"
        >
          <Tab label="Geral" />
          <Tab label="Gols" />
          <Tab label="Conquistas" />
        </Tabs>
      </Box>

      <Container maxWidth={isMd ? 'lg' : 'sm'} sx={{ py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Button variant="outlined" onClick={() => { setError(null); setLoading(true); loadStats(); }}>
              Tentar novamente
            </Button>
          </Box>
        ) : stats === null ? (
          <EmptyState title="Sem estatísticas ainda" description="Jogue suas primeiras partidas pra começar." />
        ) : stats ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PlayerAvatar
                    name={user?.name || 'Jogador'}
                    photoUrl={user?.photoUrl}
                    size={64}
                    level={stats.level}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h5" fontWeight={700}>
                        {user?.name || 'Jogador'}
                      </Typography>
                      <TeamBadge teamId={user?.favoriteTeam} size={24} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Nível {stats.level} • {getLevelTitle(stats.level)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <TrophyIcon sx={(theme) => ({ fontSize: 16, color: getLevelColor(stats.level, theme) })} />
                      <Typography variant="caption" fontWeight={600}>
                        {stats.experiencePoints} XP
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {tabValue === 0 && (
              <>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Jogos
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight={700} color="primary">
                            {stats.totalGames}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Total
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight={700} color="success.main">
                            {stats.totalWins}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vitórias
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight={700} color="warning.main">
                            {stats.totalDraws}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Empates
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h5" fontWeight={700} color="error.main">
                            {stats.totalLosses}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Derrotas
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Taxa de vitória: <strong>{getWinRate()}%</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                      <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', height: 8 }}>
                        <Box sx={{ width: `${getWinRate()}%`, bgcolor: 'success.main' }} />
                        <Box sx={{ width: `${getDrawRate()}%`, bgcolor: 'warning.main' }} />
                        <Box sx={{ width: `${getLossRate()}%`, bgcolor: 'error.main' }} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption">V: {getWinRate()}%</Typography>
                        <Typography variant="caption">E: {getDrawRate()}%</Typography>
                        <Typography variant="caption">D: {getLossRate()}%</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Streak
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <FireIcon sx={{ fontSize: 40, color: theme.palette.warning.main }} />
                      <Box>
                        <Typography variant="h4" fontWeight={700}>
                          {stats.currentStreak} jogos
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Sequência atual • Recorde: {stats.bestStreak}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" sx={{ width: 70 }}>Atual</Typography>
                        <Box sx={{ flex: 1, height: 12, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                          <Box sx={{ height: '100%', width: `${Math.min(100, (stats.currentStreak / Math.max(stats.currentStreak, stats.bestStreak, 1)) * 100)}%`, bgcolor: 'warning.main', borderRadius: 1 }} />
                        </Box>
                        <Typography variant="caption" sx={{ width: 30, textAlign: 'right' }}>{stats.currentStreak}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ width: 70 }}>Recorde</Typography>
                        <Box sx={{ flex: 1, height: 12, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                          <Box sx={{ height: '100%', width: `${Math.min(100, (stats.bestStreak / Math.max(stats.currentStreak, stats.bestStreak, 1)) * 100)}%`, bgcolor: 'success.main', borderRadius: 1 }} />
                        </Box>
                        <Typography variant="caption" sx={{ width: 30, textAlign: 'right' }}>{stats.bestStreak}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}

            {tabValue === 1 && (
              <>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Gols e Assistências
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2 }}>
                          <SoccerIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.totalGoals}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Gols
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {getGoalsPerGame()} por jogo
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2 }}>
                          <TrendingIcon sx={{ fontSize: 40, color: theme.palette.secondary.main }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.totalAssists}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Assistências
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" sx={{ width: 100 }}>Gols</Typography>
                          <Box sx={{ flex: 1, height: 14, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                            <Box sx={{ height: '100%', width: `${Math.min(100, (stats.totalGoals / Math.max(stats.totalGoals, stats.totalAssists, 1)) * 100)}%`, bgcolor: 'primary.main', borderRadius: 1 }} />
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" sx={{ width: 100 }}>Assistências</Typography>
                          <Box sx={{ flex: 1, height: 14, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
                            <Box sx={{ height: '100%', width: `${Math.min(100, (stats.totalAssists / Math.max(stats.totalGoals, stats.totalAssists, 1)) * 100)}%`, bgcolor: 'secondary.main', borderRadius: 1 }} />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {stats.totalSaves > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                        Defesas (Goleiro)
                      </Typography>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h3" fontWeight={700} color="info.main">
                          {stats.totalSaves}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Defesas realizadas
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {tabValue === 2 && (
              <>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Prêmios
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(gamificationColors.gold, 0.1), borderRadius: 2 }}>
                          <TrophyIcon sx={{ fontSize: 40, color: gamificationColors.gold }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.mvpCount}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            MVP
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(gamificationColors.level, 0.1), borderRadius: 2 }}>
                          <MedalIcon sx={{ fontSize: 40, color: gamificationColors.level }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.bestGkCount || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Melhor Goleiro
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Cartões
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2 }}>
                          <Typography variant="h4" fontWeight={700} color="warning.main">
                            {stats.yellowCards}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Amarelos
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2 }}>
                          <Typography variant="h4" fontWeight={700} color="error.main">
                            {stats.redCards}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Vermelhos
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </>
            )}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhuma estatística disponível
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Participe de jogos para ver suas estatísticas!
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};
