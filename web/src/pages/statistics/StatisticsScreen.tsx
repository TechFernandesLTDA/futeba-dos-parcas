import React, { useState, useEffect } from 'react';
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
  useTheme,
  alpha,
  Chip,
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
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { getLevelTitle, getLevelColor } from '../../types/user';
import { PlayerAvatar } from '../../components/common/GameCard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

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
  const { user } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const userRef = doc(db, 'users', user!.id);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        setStats(snakeToCamel(docSnap.data()) as UserStats);
      }
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
    setLoading(false);
  };

  const getWinRate = () => {
    if (!stats || stats.totalGames === 0) return 0;
    return ((stats.totalWins / stats.totalGames) * 100).toFixed(1);
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
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

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Box>
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
                    <Typography variant="h5" fontWeight={700}>
                      {user?.name || 'Jogador'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Nível {stats.level} • {getLevelTitle(stats.level)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <TrophyIcon sx={{ fontSize: 16, color: getLevelColor(stats.level) }} />
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
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha('#00BCD4', 0.1), borderRadius: 2 }}>
                          <MedalIcon sx={{ fontSize: 40, color: '#00BCD4' }} />
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
