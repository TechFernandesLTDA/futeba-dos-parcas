import { useState, useMemo } from 'react';
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

type FilterStatus = 'all' | GameStatus;

export function GamesTab() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { games, loading, error, refetch } = useGames();

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

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

  const handleCardClick = (gameId: string) => {
    navigate(`/game/${gameId}`);
  };

  return (
    <Box sx={{ pb: 10 }}>
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
            Jogos
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/game/create')}
          >
            Criar Jogo
          </Button>
        </Box>

        <TextField
          fullWidth
          size="small"
          placeholder="Buscar jogos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Buscar jogos"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')} edge="end" aria-label="Limpar busca">
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
            aria-label="Filtrar por status do jogo"
            variant="scrollable"
            scrollButtons="auto"
            sx={{ minHeight: 36, flex: 1 }}
          >
            <Tab value="all" label="Todos" sx={{ minHeight: 36, py: 0 }} />
            <Tab value="SCHEDULED" label="Abertos" sx={{ minHeight: 36, py: 0 }} />
            <Tab value="LIVE" label="Ao Vivo" sx={{ minHeight: 36, py: 0 }} />
            <Tab value="FINISHED" label="Finalizados" sx={{ minHeight: 36, py: 0 }} />
          </Tabs>
          {hasActiveFilters && (
            <IconButton size="small" onClick={clearFilters} sx={{ ml: 0.5 }} aria-label="Limpar filtros">
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
            <Card key={i} sx={{ mb: 2, borderRadius: 3 }}>
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
                : 'Crie um novo jogo para começar!'}
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
          filteredGames.map((game) => {
            const progress = (game.playersCount / game.maxPlayers) * 100;
            const isFull = game.playersCount >= game.maxPlayers;

            return (
              <Card key={game.id} sx={{ mb: 2 }}>
                <CardActionArea onClick={() => handleCardClick(game.id)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
                          {(() => {
                            const sc = getStatusChipColors(theme, game.status);
                            return (
                              <Chip
                                label={sc.label || game.status}
                                size="small"
                                sx={{
                                  bgcolor: alpha(sc.color, 0.15),
                                  color: sc.color,
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  height: 22,
                                }}
                              />
                            );
                          })()}
                          {game.fieldType && (
                            <Chip
                              label={FIELD_TYPE_LABELS[game.fieldType] || game.fieldType}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 22 }}
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
                          {formatGameDate(game.date)} às {game.time}
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
                            {game.team1Score} - {game.team2Score}
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
            );
          })
        )}
      </Box>

      <Fab
        color="primary"
        aria-label="Criar novo jogo"
        onClick={() => navigate('/game/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 80,
          right: { xs: 16, sm: 'calc(50% - 240px + 16px)' },
        }}
      >
        <Add />
      </Fab>
    </Box>
  );
}
