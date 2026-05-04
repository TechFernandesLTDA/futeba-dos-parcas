import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Fab,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  SportsSoccer as SoccerIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { GameCard, LoadingState } from '../../components/common/GameCard';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { VirtualList } from '../../components/common/VirtualList';
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
  const [refreshing, setRefreshing] = useState(false);

  const fetchGames = useCallback(() => {
    return new Promise<void>((resolve) => {
      const gamesRef = collection(db, 'games');
      const q = query(gamesRef, orderBy('date', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const gamesData = snapshot.docs.map((doc) => ({
          ...snakeToCamel<Game>(doc.data()),
          id: doc.id,
        }));
        setGames(gamesData);
        setLoading(false);
        setRefreshing(false);
        resolve();
      }, () => {
        setRefreshing(false);
        resolve();
      });

      return unsubscribe;
    });
  }, []);

  useEffect(() => {
    const unsub = fetchGames();
    return () => { unsub.then((fn: any) => fn()); };
  }, [fetchGames]);

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
          <Typography component="h1" variant="h6" sx={{ ml: 1, flex: 1 }}>
            Jogos
          </Typography>
          <IconButton aria-label="Filtrar jogos">
            <FilterIcon />
          </IconButton>
          <IconButton
            aria-label="Atualizar jogos"
            onClick={() => setRefreshing(true)}
            disabled={refreshing}
            sx={{ ml: 0.5 }}
          >
            {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
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

      <PullToRefresh
        onRefresh={async () => {
          setRefreshing(true);
          await fetchGames();
        }}
        disabled={loading}
      >
        <Container maxWidth="sm" sx={{ py: 2 }}>
          {loading ? (
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
          ) : filteredGames.length > 20 ? (
            <VirtualList
              items={filteredGames}
              estimateSize={200}
              overscan={3}
              getItemKey={(index) => filteredGames[index].id}
              renderItem={(game) => (
                <Box sx={{ px: 0, py: 1 }}>
                  <GameCard
                    game={game}
                    onClick={() => navigate(`/game/${game.id}`)}
                  />
                </Box>
              )}
            />
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
      </PullToRefresh>

      <Fab
        color="primary"
        aria-label="Criar novo jogo"
        sx={{ position: 'fixed', bottom: 16, right: { xs: 16, sm: 'calc(50% - 240px + 16px)' } }}
        onClick={() => navigate('/game/create')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
