import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Fab,
  Button,
  Grid,
  CircularProgress,
  useTheme,
  useMediaQuery,
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
import { Game, GameStatus } from '../../types/game';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GamesScreen');

export const GamesScreen: React.FC = () => {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  useAuth();
  const { t } = useTranslation();

  const [tabValue, setTabValue] = useState(0);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showError } = useToast();

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
      }, (err) => {
        logger.error('Error in games listener:', err);
        showError('Erro ao carregar jogos. Verifique sua conexão.');
        setLoading(false);
        setRefreshing(false);
        resolve();
      });

      return unsubscribe;
    });
  }, [showError]);

  useEffect(() => {
    const unsub = fetchGames();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fetchGames retorna Promise<void>, padrão de cleanup legado
    return () => { unsub.then((fn: any) => fn && fn()); };
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
          <IconButton onClick={navigateBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('games.title')}
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
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/game/create')}
            sx={{ display: { xs: 'none', md: 'inline-flex' }, ml: 1 }}
          >
            {t('games.createGame')}
          </Button>
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
        <Container maxWidth={isMd ? 'xl' : 'sm'} sx={{ py: 2 }}>
          {loading ? (
            <LoadingState shimmerCount={8} itemType="GAME" />
          ) : filteredGames.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <SoccerIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                {t('games.noGames')}
              </Typography>
              <Typography variant="body2" color="text.disabled">
                {tabValue === 0 ? 'Crie um novo jogo para começar!' : 'Não há jogos nesta categoria'}
              </Typography>
            </Box>
          ) : filteredGames.length > 20 ? (
            <Grid container spacing={2}>
              {filteredGames.map((game) => (
                <Grid item xs={12} md={6} key={game.id}>
                  <GameCard
                    game={game}
                    onClick={() => navigate(`/game/${game.id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {filteredGames.map((game) => (
                <Grid item xs={12} md={6} key={game.id}>
                  <GameCard
                    game={game}
                    onClick={() => navigate(`/game/${game.id}`)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </PullToRefresh>

      <Fab
        color="primary"
        aria-label="Criar novo jogo"
        sx={{ display: { xs: 'flex', md: 'none' }, position: 'fixed', bottom: 16, right: { xs: 16, sm: 'calc(50% - 240px + 16px)' } }}
        onClick={() => navigate('/game/create')}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};
