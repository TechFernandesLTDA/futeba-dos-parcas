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
  Grid,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  Person as PersonIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../../components/common/GameCard';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const logger = createLogger('LiveStatsScreen');

interface GameEvent {
  id: string;
  type: 'GOAL' | 'ASSIST' | 'YELLOW_CARD' | 'RED_CARD' | 'SAVE';
  playerId: string;
  playerName: string;
  team: 'A' | 'B';
  minute: number;
  createdAt: Date;
}

interface LiveStats {
  teamAScore: number;
  teamBScore: number;
  topScorerA: { name: string; goals: number } | null;
  topScorerB: { name: string; goals: number } | null;
}

export const LiveStatsScreen: React.FC = () => {
  useDocumentTitle('Estatísticas ao Vivo');
  const navigate = useNavigate();
  const theme = useTheme();
  const { gameId } = useParams<{ gameId: string }>();
  useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;

    const fetchData = async () => {
      try {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = snakeToCamel(gameDoc.data()) as Record<string, any>;
          setStats({
            teamAScore: data.teamAScore || data.team1Score || 0,
            teamBScore: data.teamBScore || data.team2Score || 0,
            topScorerA: data.topScorerA || null,
            topScorerB: data.topScorerB || null,
          });
        }

        const eventsRef = collection(db, 'game_events');
        const q = query(eventsRef, where('game_id', '==', gameId), orderBy('minute', 'asc'));
        const eventsSnap = await getDocs(q);
        const eventsData = eventsSnap.docs.map((d) => {
          const raw = d.data();
          const data = snakeToCamel(raw);
          return {
            id: d.id,
            ...data,
            createdAt: (raw.created_at || raw.createdAt)?.toDate?.() || new Date(),
          };
        }) as GameEvent[];
        setEvents(eventsData);
      } catch (error) {
        logger.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [gameId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'GOAL':
        return <SoccerIcon color="success" />;
      case 'ASSIST':
        return <TrendingIcon color="info" />;
      case 'YELLOW_CARD':
        return <Box sx={{ width: 12, height: 16, bgcolor: 'warning.main', borderRadius: 0.5 }} />;
      case 'RED_CARD':
        return <Box sx={{ width: 12, height: 16, bgcolor: 'error.main', borderRadius: 0.5 }} />;
      case 'SAVE':
        return <StarIcon color="warning" />;
      default:
        return <PersonIcon />;
    }
  };

  if (loading) {
    return <LoadingState shimmerCount={4} itemType="CARD" />;
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
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Estatísticas ao Vivo
          </Typography>
        </Box>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} variant="fullWidth" aria-label="Categorias de estatísticas ao vivo">
          <Tab label="Placar" />
          <Tab label="Eventos" />
          <Tab label="Jogadores" />
        </Tabs>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {tabValue === 0 && stats && (
          <>
            <Card sx={{ mb: 2, textAlign: 'center' }}>
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  <Grid xs={5}>
                    <Typography variant="h2" fontWeight={700} color="primary">
                      {stats.teamAScore}
                    </Typography>
                    <Chip label="Time A" color="primary" />
                  </Grid>
                  <Grid xs={2}>
                    <Typography variant="h5" color="text.secondary">
                      X
                    </Typography>
                  </Grid>
                  <Grid xs={5}>
                    <Typography variant="h2" fontWeight={700} color="secondary">
                      {stats.teamBScore}
                    </Typography>
                    <Chip label="Time B" color="secondary" />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              <Grid xs={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Artilheiro Time A
                  </Typography>
                  {stats.topScorerA ? (
                    <>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {stats.topScorerA.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SoccerIcon fontSize="small" color="success" />
                        <Typography>{stats.topScorerA.goals} gols</Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      Sem gols
                    </Typography>
                  )}
                </Paper>
              </Grid>
              <Grid xs={6}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Artilheiro Time B
                  </Typography>
                  {stats.topScorerB ? (
                    <>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {stats.topScorerB.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SoccerIcon fontSize="small" color="success" />
                        <Typography>{stats.topScorerB.goals} gols</Typography>
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="text.disabled">
                      Sem gols
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}

        {tabValue === 1 && (
          <Card>
            <List disablePadding aria-label="Eventos do jogo">
              {events.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">Nenhum evento ainda</Typography>
                </Box>
              ) : (
                events.map((event, index) => (
                  <Box key={event.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          {getEventIcon(event.type)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={event.playerName}
                        secondary={`${event.type === 'GOAL' ? 'Gol' : event.type === 'ASSIST' ? 'Assistência' : event.type} • Time ${event.team}`}
                      />
                      <Chip label={`${event.minute}'`} size="small" />
                    </ListItem>
                  </Box>
                ))
              )}
            </List>
          </Card>
        )}

        {tabValue === 2 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">Estatísticas por jogador em breve</Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};
