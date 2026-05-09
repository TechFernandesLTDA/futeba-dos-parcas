import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Avatar,
  Chip,
  Divider,
  Grid,
  Paper,
  useTheme,
  alpha,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  CalendarMonth as CalendarIcon,
  Star as StarIcon,
  LocalFireDepartment as FireIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('WeeklyRecapScreen');

interface WeeklyStats {
  gamesPlayed: number;
  wins: number;
  goals: number;
  assists: number;
  mvpCount: number;
  xpEarned: number;
  streak: number;
}

interface GameRecord {
  id: string;
  date: Date;
  opponent?: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  score?: string;
  goals: number;
  assists: number;
  isMvp: boolean;
}

export const WeeklyRecapScreen: React.FC = () => {
  useDocumentTitle('Resumo Semanal');
  const navigate = useNavigate();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { showError } = useToast();

  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats | null>(null);
  const [recentGames, setRecentGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || currentUser?.id;

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const statsDoc = await getDoc(doc(db, 'weekly_stats', targetUserId));
        if (statsDoc.exists()) {
          setWeeklyStats(snakeToCamel(statsDoc.data()) as WeeklyStats);
        } else {
          setWeeklyStats({
            gamesPlayed: 0,
            wins: 0,
            goals: 0,
            assists: 0,
            mvpCount: 0,
            xpEarned: 0,
            streak: 0,
          });
        }

        const gamesRef = collection(db, 'games');
        const q = query(gamesRef, orderBy('date', 'desc'), limit(10));
        const snapshot = await getDocs(q);

        const gamesData: GameRecord[] = [];
        snapshot.docs.forEach((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(d.data()) as Record<string, any>;
          const participants = data.participants || [];
          if (participants.includes(targetUserId)) {
            gamesData.push({
              id: d.id,
              date: data.date?.toDate?.() || new Date(data.date),
              result: data.winnerTeam ? 'WIN' : 'LOSS',
              goals: data.goals?.[targetUserId] || 0,
              assists: data.assists?.[targetUserId] || 0,
              isMvp: data.mvpId === targetUserId,
            });
          }
        });

        setRecentGames(gamesData);
      } catch (error) {
        logger.error('Error fetching weekly recap:', error);
        showError('Erro ao carregar recap semanal.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [targetUserId]);

  if (loading) {
    return <LoadingState shimmerCount={6} itemType="CARD" />;
  }

  if (!weeklyStats) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <TimelineIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Nenhum dado disponível
        </Typography>
      </Box>
    );
  }

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
          <Typography variant="h6" sx={{ ml: 1 }}>
            Resumo Semanal
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Últimos 7 dias
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={700} color="primary">
                    {weeklyStats.gamesPlayed}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Jogos
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={700} color="success.main">
                    {weeklyStats.wins}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Vitórias
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" fontWeight={700} color="warning.main">
                    +{weeklyStats.xpEarned}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    XP
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              Estatísticas da Semana
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <SoccerIcon color="success" sx={{ mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={600}>
                    {weeklyStats.goals}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Gols
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <TrendingIcon color="info" sx={{ mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={600}>
                    {weeklyStats.assists}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Assistências
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <StarIcon color="warning" sx={{ mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={600}>
                    {weeklyStats.mvpCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    MVPs
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                  <FireIcon color="error" sx={{ mb: 0.5 }} />
                  <Typography variant="h5" fontWeight={600}>
                    {weeklyStats.streak}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Sequência
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Jogos Recentes
            </Typography>
            {recentGames.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <CalendarIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Nenhum jogo esta semana
                </Typography>
              </Box>
            ) : (
              <List disablePadding aria-label="Jogos recentes">
                {recentGames.map((game, index) => (
                  <Box key={game.id}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Avatar
                          sx={{
                            bgcolor:
                              game.result === 'WIN'
                                ? alpha(theme.palette.success.main, 0.1)
                                : game.result === 'LOSS'
                                ? alpha(theme.palette.error.main, 0.1)
                                : alpha(theme.palette.grey[500], 0.1),
                            color:
                              game.result === 'WIN'
                                ? 'success.main'
                                : game.result === 'LOSS'
                                ? 'error.main'
                                : 'grey.500',
                            width: 32,
                            height: 32,
                          }}
                        >
                          {game.result === 'WIN' ? 'V' : game.result === 'LOSS' ? 'D' : 'E'}
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={game.date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        secondary={`${game.goals} gols • ${game.assists} assists`}
                      />
                      {game.isMvp && (
                        <Chip icon={<StarIcon />} label="MVP" size="small" color="warning" />
                      )}
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
