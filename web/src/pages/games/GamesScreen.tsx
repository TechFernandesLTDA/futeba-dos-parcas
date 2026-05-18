import { useState, useRef } from 'react';
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
  Menu,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
  SportsSoccer as SoccerIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useGames } from '../../hooks/useGames';
import { GameCard, LoadingState } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { GameStatus } from '../../types/game';
import { useTranslation } from 'react-i18next';

export const GamesScreen: React.FC = () => {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  useAuth();
  const { t } = useTranslation();

  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  // Âncora do menu de filtro rápido (espelha as abas de status)
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);

  const { games: rawGames, loading, error, refetch } = useGames();

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

  const filteredGames = rawGames.filter((game) => {
    const status = getStatusFilter();
    if (!status) return true;
    return game.status === status;
  });

  const handleRefresh = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  };

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
          <IconButton aria-label="Filtrar jogos" onClick={(e) => setFilterAnchorEl(e.currentTarget)}>
            <FilterIcon />
          </IconButton>
          {/* Menu de filtro rápido — espelha as abas de status existentes */}
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={() => setFilterAnchorEl(null)}
          >
            {['Todos', 'Agendados', 'Confirmados', 'Ao Vivo', 'Finalizados'].map((label, idx) => (
              <MenuItem
                key={label}
                selected={tabValue === idx}
                onClick={() => { setTabValue(idx); setFilterAnchorEl(null); }}
              >
                {label}
              </MenuItem>
            ))}
          </Menu>
          <IconButton
            aria-label="Atualizar jogos"
            onClick={handleRefresh}
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
          <Tab label={t('games.tabs.all')} />
          <Tab label={t('games.tabs.scheduled')} />
          <Tab label={t('games.tabs.confirmed')} />
          <Tab label={t('games.tabs.live')} />
          <Tab label={t('games.tabs.finished')} />
        </Tabs>
      </Box>

      <PullToRefresh
        onRefresh={handleRefresh}
        disabled={loading}
      >
        <Container maxWidth={isMd ? 'xl' : 'sm'} sx={{ py: 2 }}>
          {loading ? (
            <LoadingState shimmerCount={8} itemType="GAME" />
          ) : error ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="error" gutterBottom>
                Erro ao carregar jogos
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {error}
              </Typography>
              <Button variant="contained" onClick={handleRefresh} sx={{ mt: 2 }}>
                Tentar novamente
              </Button>
            </Box>
          ) : filteredGames.length === 0 ? (
            <EmptyState
              icon={<SoccerIcon />}
              title={t('games.noGames')}
              description={tabValue === 0 ? 'Crie um novo jogo para começar!' : 'Não há jogos nesta categoria'}
              {...(tabValue === 0 ? {
                actionLabel: t('games.createGame'),
                actionIcon: <AddIcon />,
                onAction: () => navigate('/game/create'),
              } : {})}
            />
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
