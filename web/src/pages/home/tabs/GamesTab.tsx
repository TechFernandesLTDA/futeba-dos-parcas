import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Fab,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Skeleton,
  LinearProgress,
  Alert,
  Button,
  alpha,
  useTheme,
  useMediaQuery,
  Grid,
  IconButton,
} from '@mui/material';
import {
  Add,
  Search,
  CalendarMonth,
  LocationOn,
  People,
  SportsSoccer,
  Close,
  FilterListOff,
} from '@mui/icons-material';
import { FIELD_TYPE_LABELS, GameStatus, getStatusChipColors } from '../../../types/game';
import { useGames } from '../../../hooks/useGames';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatGameDate } from '../../../utils/dateFormatters';
import { useTranslation } from 'react-i18next';

const livePulseKeyframes = {
  '@keyframes livePulse': {
    '0%': { opacity: 1 },
    '50%': { opacity: 0.3 },
    '100%': { opacity: 1 },
  },
};

type FilterStatus = 'all' | GameStatus;

export function GamesTab() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { games, loading, error, refetch } = useGames();

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all';

  // Estabilizado: evita recriação em cada render (passado a botões filhos)
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
  }, []);

  const filteredGames = useMemo(() => {
    let result = [...games];

    if (statusFilter !== 'all') {
      result = result.filter(game => game.status === statusFilter);
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        game =>
          game.locationName?.toLowerCase().includes(query) ||
          (game.groupName?.toLowerCase() || '').includes(query)
      );
    }

    return result;
  }, [games, debouncedSearch, statusFilter]);

  // Estabilizado: navigate é estável, dep array vazio seguro
  const handleCardClick = useCallback((gameId: string) => {
    navigate(`/game/${gameId}`);
  }, [navigate]);

  return (
    <Box sx={{ pb: 10, maxWidth: { xs: '100%', lg: 1200 }, mx: 'auto' }}>
      {/* Sticky search + filters bar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          bgcolor: 'background.paper',
          p: 2,
          pb: 0,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        {/* Header com título + Criar (md+) */}
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' },
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            {t('games.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/game/create')}
          >
            {t('games.createGame')}
          </Button>
        </Box>

        <TextField
          fullWidth
          size="small"
          placeholder={t('games.search.placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('games.search.placeholder')}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')} edge="end" aria-label={t('games.search.clear')} sx={{ minWidth: 44, minHeight: 44 }}>
                  <Close fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ mb: 1 }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tabs
            value={statusFilter}
            onChange={(_, value) => setStatusFilter(value)}
            aria-label={t('games.search.filterByStatus')}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 36, flex: 1 }}
          >
            <Tab value="all" label={t('games.tabs.all')} sx={{ minHeight: 36, py: 0 }} />
            <Tab value="SCHEDULED" label={t('games.tabs.scheduled')} sx={{ minHeight: 36, py: 0 }} />
            <Tab value="CONFIRMED" label={t('games.tabs.confirmed')} sx={{ minHeight: 36, py: 0 }} />
            <Tab value="LIVE" label={t('games.tabs.live')} sx={{ minHeight: 36, py: 0 }} />
            <Tab value="FINISHED" label={t('games.tabs.finished')} sx={{ minHeight: 36, py: 0 }} />
          </Tabs>
          {hasActiveFilters && (
            <IconButton onClick={clearFilters} sx={{ ml: 0.5 }} aria-label={t('games.search.clearFilters')}>
              <FilterListOff fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                  <Skeleton variant="rounded" width={70} height={22} />
                  <Skeleton variant="rounded" width={60} height={22} />
                </Box>
                <Skeleton variant="text" width="60%" height={28} />
                <Skeleton variant="text" width="50%" />
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rectangular" height={6} sx={{ borderRadius: 3, mt: 2 }} />
              </CardContent>
            </Card>
          ))
        ) : filteredGames.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SportsSoccer sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {hasActiveFilters ? 'Nenhum jogo com esses filtros' : 'Nenhum jogo encontrado'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {hasActiveFilters
                ? 'Tente alterar a busca ou os filtros'
                : statusFilter === 'all'
                  ? 'Nenhum jogo disponível no momento'
                  : statusFilter === 'SCHEDULED'
                    ? 'Nenhum jogo aberto para inscrição'
                    : statusFilter === 'LIVE'
                      ? 'Nenhum jogo ao vivo agora'
                      : 'Nenhum jogo finalizado ainda'}
            </Typography>
            {hasActiveFilters ? (
              <Button
                variant="outlined"
                startIcon={<FilterListOff />}
                onClick={clearFilters}
              >
                Limpar Filtros
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => navigate('/game/create')}
              >
                Criar Jogo
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ px: isLg ? 2 : 0 }}>
            <Grid container spacing={2}>
          {filteredGames.map((game) => {
            const progress = game.maxPlayers > 0 ? Math.min((game.playersCount / game.maxPlayers) * 100, 100) : 0;
            const isFull = game.maxPlayers > 0 && game.playersCount >= game.maxPlayers;

            return (
              <Grid item xs={12} lg={6} key={game.id}>
              <Card sx={{ mb: 2 }}>
                <CardActionArea onClick={() => handleCardClick(game.id)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, alignItems: 'center' }}>
                          {(() => {
                            const sc = getStatusChipColors(theme, game.status);
                            return (
                              <>
                                <Chip
                                  label={sc.label || game.status}
                                  size="small"
                                  sx={{
                                    bgcolor: alpha(sc.color, 0.15),
                                    color: sc.color,
                                    fontWeight: 600,
                                    fontSize: '0.75rem',
                                    height: 22,
                                  }}
                                />
                                {game.status === 'LIVE' && (
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      bgcolor: theme.palette.error.main,
                                      animation: 'livePulse 1.5s ease-in-out infinite',
                                      ...livePulseKeyframes,
                                    }}
                                  />
                                )}
                              </>
                            );
                          })()}
                          {game.fieldType && (
                            <Chip
                              label={FIELD_TYPE_LABELS[game.fieldType] || game.fieldType}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.75rem', height: 18 }}
                            />
                          )}
                        </Box>
                        <Typography variant="subtitle1" fontWeight="bold" noWrap>
                          {game.locationName || 'Local não definido'}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarMonth fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {formatGameDate(game.date)}{game.time ? ` às ${game.time}` : ''}
                        </Typography>
                      </Box>
                      {game.locationAddress && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationOn fontSize="small" color="action" />
                          <Typography variant="body2" color="text.secondary" noWrap>
                            {game.locationAddress}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <People fontSize="small" color={isFull ? 'error' : 'primary'} />
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            color={isFull ? 'error' : 'text.primary'}
                          >
                            {game.playersCount}/{game.maxPlayers} jogadores
                          </Typography>
                        </Box>
                        {game.status === 'SCHEDULED' && game.dailyPrice > 0 && (
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            R$ {game.dailyPrice.toFixed(0)}
                          </Typography>
                        )}
                        {(game.status === 'LIVE' || game.status === 'FINISHED') && (
                          <Typography variant="h6" fontWeight="bold">
                            {game.team1Score ?? 0} - {game.team2Score ?? 0}
                          </Typography>
                        )}
                      </Box>

                      {game.status === 'SCHEDULED' && (
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                              bgcolor: isFull ? theme.palette.error.main : theme.palette.primary.main,
                            },
                          }}
                        />
                      )}
                    </Box>

                    {game.groupName && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {game.groupName}
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
              </Grid>
            );
          })}
            </Grid>
          </Box>
        )}
      </Box>

      <Fab
        color="primary"
        aria-label={t('games.createGame')}
        onClick={() => navigate('/game/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          right: 16,
          pb: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}
