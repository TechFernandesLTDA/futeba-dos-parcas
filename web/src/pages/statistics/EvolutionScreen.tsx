import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  useTheme,
  alpha,
  Grid,
  Paper,
  Alert,
  Button,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  TrendingUp as TrendingUpIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { LoadingState } from '../../components/common/GameCard';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('EvolutionScreen');

interface EvolutionData {
  month: string;
  gamesPlayed: number;
  goals: number;
  assists: number;
  wins: number;
  xpEarned: number;
}

interface StatsSummary {
  totalGames: number;
  totalWins: number;
  totalGoals: number;
  totalAssists: number;
  totalMvps: number;
  avgGoalsPerGame: number;
  winRate: number;
}

export const EvolutionScreen: React.FC = () => {
  useDocumentTitle('Evolução');
  const navigate = useNavigate();
  const theme = useTheme();
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [evolutionData, setEvolutionData] = useState<EvolutionData[]>([]);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // SECFIX #493: estado de erro pra distinguir falha de rede vs sem dados
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const targetUserId = userId || currentUser?.id;

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    setError(null);
    setLoading(true);

    const fetchData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(userDoc.data()) as Record<string, any>;
          const totalGames = data.gamesPlayed || 0;
          const totalWins = data.wins || 0;
          const totalGoals = data.goals || 0;
          const totalAssists = data.assists || 0;
          const totalMvps = data.mvpCount || 0;

          setSummary({
            totalGames,
            totalWins,
            totalGoals,
            totalAssists,
            totalMvps,
            avgGoalsPerGame: totalGames > 0 ? totalGoals / totalGames : 0,
            winRate: totalGames > 0 ? (totalWins / totalGames) * 100 : 0,
          });
        }

        const statsRef = collection(db, 'monthly_stats');
        const q = query(statsRef, where('user_id', '==', targetUserId), orderBy('month', 'desc'), limit(12));
        const snapshot = await getDocs(q);

        const data: EvolutionData[] = snapshot.docs.map((d) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const docData = snakeToCamel(d.data()) as Record<string, any>;
          return {
            month: docData.month,
            gamesPlayed: docData.gamesPlayed || 0,
            goals: docData.goals || 0,
            assists: docData.assists || 0,
            wins: docData.wins || 0,
            xpEarned: docData.xpEarned || 0,
          };
        });

        setEvolutionData(data);
      } catch (err) {
        logger.error('Error fetching evolution data:', err);
        setError('Não foi possível carregar os dados de evolução. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [targetUserId, reloadKey]);

  if (loading) {
    return <LoadingState shimmerCount={6} itemType="CARD" />;
  }

  // SECFIX #493: estado de erro com retry distinto do empty state
  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Tentar novamente
        </Button>
      </Box>
    );
  }

  if (!summary) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <TimelineIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Nenhum dado disponível
        </Typography>
      </Box>
    );
  }

  const maxValue = Math.max(...evolutionData.map((d) => d.gamesPlayed), 1);

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
            Evolução
          </Typography>
        </Box>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth" aria-label="Período de evolução">
          <Tab label="Visão Geral" />
          <Tab label="Mensal" />
        </Tabs>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {tabValue === 0 && (
          <>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  Resumo Geral
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={6}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <SoccerIcon color="primary" sx={{ mb: 0.5 }} />
                      <Typography variant="h5" fontWeight={600}>
                        {summary.totalGames}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Jogos
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <TrophyIcon color="warning" sx={{ mb: 0.5 }} />
                      <Typography variant="h5" fontWeight={600}>
                        {summary.totalWins}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Vitórias
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={600} color="success.main">
                        {summary.totalGoals}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Gols
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={600} color="info.main">
                        {summary.totalAssists}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Assistências
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                  Métricas
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Taxa de Vitória</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {summary.winRate.toFixed(1)}%
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 8,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${summary.winRate}%`,
                        bgcolor: theme.palette.primary.main,
                        borderRadius: 4,
                      }}
                    />
                  </Box>
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Média de Gols/Jogo</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {summary.avgGoalsPerGame.toFixed(2)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 8,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${Math.min(summary.avgGoalsPerGame * 20, 100)}%`,
                        bgcolor: theme.palette.success.main,
                        borderRadius: 4,
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </>
        )}

        {tabValue === 1 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Últimos 12 Meses
              </Typography>
              {evolutionData.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <TrendingUpIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Sem dados suficientes
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 150 }}>
                  {evolutionData.slice(0, 12).reverse().map((data, _index) => (
                    <Box
                      key={data.month}
                      sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <Box
                        sx={{
                          width: '100%',
                          bgcolor: theme.palette.primary.main,
                          borderRadius: '4px 4px 0 0',
                          height: `${(data.gamesPlayed / maxValue) * 100}px`,
                          minHeight: 4,
                          transition: 'height 0.3s ease',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                        {data.month.slice(5)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  );
};
