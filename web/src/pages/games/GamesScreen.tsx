import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Fab,
  useTheme,
} from '@mui/material';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { GameCard, LoadingState } from '../../components/common/GameCard';
import { Game, GameStatus } from '../../types/game';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const GamesScreen: React.FC = () => {
  useDocumentTitle('Jogos');
  const navigate = useNavigate();
  const theme = useTheme();
  useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setError(null);
    setLoading(true);

    const gamesRef = collection(db, 'games');
    const q = query(gamesRef, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const gamesData = snapshot.docs.map((doc) => ({
          ...snakeToCamel<Game>(doc.data()),
          id: doc.id,
        }));
        setGames(gamesData);
        setError(null);
        setLoading(false);
      },
      () => {
        setError('Erro ao carregar jogos. Tente novamente.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [retryCount]);

  const getStatusFilter = (): GameStatus | null => {
    switch (tabValue) {
      case 0: return null;
      case 1: return 'SCHEDULED';
      case 2: return 'CONFIRMED';
      case 3: return 'LIVE';
      case 4: return 'FINISHED';
      default: return null;
    }
  };

  const filteredGames = games.filter((game) => {
    const status = getStatusFilter();
    if (!status) return true;
    return game.status === status;
  });

  return (
    <Box sx={{ pb: 8 }}>
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
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            Jogos
          </Typography>
        </Box>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Filtrar por status do jogo"
        >
          <Tab label="Todos" />
          <Tab label="Agendados" />
          <Tab label="Confirmados" />
          <Tab label="Ao Vivo" />
          <Tab label="Finalizados" />
        </Tabs>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {error ? (
          <ErrorAlert message={error} onRetry={() => setRetryCount(c => c + 1)} />
        ) : loading ? (
          <LoadingState shimmerCount={8} itemType="GAME" />
        ) : filteredGames.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Nenhum jogo encontrado
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {tabValue === 0 ? 'Crie um novo jogo para começar!' : 'Não há jogos nesta categoria'}
            </Typography>
          </Box>
        ) : (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onClick={() => navigate(`/game/${game.id}`)}
            />
          ))
        )}
      </Container>

      <Fab
        color="primary"
        aria-label="Criar novo jogo"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => navigate('/game/create')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
