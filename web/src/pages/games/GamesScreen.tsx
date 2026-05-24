import { useState, useRef, useMemo } from 'react';
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
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
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
import { useGroups } from '../../hooks/useGroups';
import { GameCard, LoadingState } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { GameStatus } from '../../types/game';
import { detectGameConflicts } from '../../utils/gameConflicts';
import { useTranslation } from 'react-i18next';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';

export const GamesScreen: React.FC = () => {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  useAuth();
  const { t } = useTranslation();

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'GamesScreen' });

  const [tabValue, setTabValue] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  // Âncora do menu de filtro rápido (espelha as abas de status)
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);

  // Filtro por grupo: '' = todos os grupos do usuário (#1366)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const { groups: userGroups } = useGroups();

  const { games: rawGames, loading, error, refetch } = useGames(
    selectedGroupId ? { groupId: selectedGroupId } : undefined,
  );

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

  const conflictIds = useMemo(() => detectGameConflicts(rawGames), [rawGames]);

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
        {/* Filtro por grupo (#1366) — só aparece se usuário tem >=1 grupo */}
        {userGroups.length > 0 && (
          <Box sx={{ px: 2, pb: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel id="games-group-filter-label">
                {t('games.filterByGroup')}
              </InputLabel>
              <Select
                labelId="games-group-filter-label"
                value={selectedGroupId}
                label={t('games.filterByGroup')}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <MenuItem value="">{t('games.allGroups')}</MenuItem>
                {userGroups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
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
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={handleRefresh}>
                  {t('common.retry')}
                </Button>
              }
              sx={{ mb: 2 }}
            >
              {t('games.loadError')}: {error}
            </Alert>
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
                    hasConflict={conflictIds.has(game.id)}
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
        // FAB ancorada na viewport (max p/ não passar do edge do container sm=600px) (#1372)
        // Antes o calc usava 240px assumindo container=480px, mas maxWidth='sm' é 600px → desalinhava.
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 16,
          right: { xs: 16, sm: 'max(16px, calc(50% - 300px + 16px))' },
        }}
        onClick={() => navigate('/game/create')}
      >
        <AddIcon />
      </Fab>

      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
};
