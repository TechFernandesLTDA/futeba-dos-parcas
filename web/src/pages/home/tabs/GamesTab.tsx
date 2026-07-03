import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Skeleton,
  LinearProgress,
  Button,
  alpha,
  useTheme,
  useMediaQuery,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  Add,
  Search,
  CalendarMonth,
  LocationOn,
  People,
  SportsSoccer,
  Close,
  FilterListOff,
  SortByAlpha,
  EventAvailable,
  AccessTime,
  Wc as GenderIcon,
} from '@mui/icons-material';
import { FIELD_TYPE_LABELS, GameStatus, GameGender, getStatusChipColors } from '../../../types/game';
import { pageSpacing } from '../../../theme/pageTokens';
import { useGames } from '../../../hooks/useGames';
import { useGroups } from '../../../hooks/useGroups';
import { useDebounce } from '../../../hooks/useDebounce';
import { formatGameDate } from '../../../utils/dateFormatters';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '../../../components/common/ErrorState';
import { EmptyState } from '../../../components/common/EmptyState';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { ScreenFab } from '../../../components/layout';

const livePulseKeyframes = {
  '@keyframes livePulse': {
    '0%': { opacity: 1 },
    '50%': { opacity: 0.3 },
    '100%': { opacity: 1 },
  },
};

type FilterStatus = 'all' | GameStatus;
type SortBy = 'date' | 'spots' | 'nearest';

const ACTIVE_STATUSES: GameStatus[] = ['SCHEDULED', 'CONFIRMED', 'LIVE'];
const ACTIVE_GAME_DISPLAY_GRACE_MS = 4 * 60 * 60 * 1000;

const SORT_OPTIONS: { value: SortBy; labelKey: string; icon: React.ReactNode }[] = [
  { value: 'date', labelKey: 'games.sort.date', icon: <CalendarMonth fontSize="small" /> },
  { value: 'spots', labelKey: 'games.sort.spots', icon: <EventAvailable fontSize="small" /> },
  { value: 'nearest', labelKey: 'games.sort.nearest', icon: <AccessTime fontSize="small" /> },
];

function getGameStartTime(game: { dateTime?: Date; date: string; time?: string }): number | null {
  if (game.dateTime instanceof Date && !Number.isNaN(game.dateTime.getTime())) {
    return game.dateTime.getTime();
  }

  const parsed = new Date(`${game.date}T${game.time || '00:00'}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function isExpiredActiveGame(game: { status: GameStatus; dateTime?: Date; date: string; time?: string }): boolean {
  if (!ACTIVE_STATUSES.includes(game.status)) return false;
  const startTime = getGameStartTime(game);
  if (startTime === null) return false;
  return startTime + ACTIVE_GAME_DISPLAY_GRACE_MS < Date.now();
}

export function GamesTab() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLg = useMediaQuery(theme.breakpoints.up('lg'));
  const { t } = useTranslation();
  useDocumentTitle(t('nav.games'));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [genderFilter, setGenderFilter] = useState<'all' | GameGender>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { games, loading, error, refetch } = useGames();
  const { groups, loading: groupsLoading } = useGroups();
  const hasGroups = groups.length > 0;

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || genderFilter !== 'all';

  // Estabilizado: evita recriação em cada render (passado a botões filhos)
  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setGenderFilter('all');
  }, []);

  const filteredGames = useMemo(() => {
    let result = games.filter((game) => {
      if (statusFilter !== 'all') return true;
      return !isExpiredActiveGame(game);
    });

    if (statusFilter !== 'all') {
      result = result.filter(game => game.status === statusFilter);
    }

    // Filtro de gênero: ausência de gender é tratada como MIXED
    if (genderFilter !== 'all') {
      result = result.filter(game => (game.gender ?? 'MIXED') === genderFilter);
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        game =>
          game.locationName?.toLowerCase().includes(query) ||
          (game.groupName?.toLowerCase() || '').includes(query)
      );
    }

    if (sortBy === 'spots') {
      result.sort((a, b) => (b.maxPlayers - b.playersCount) - (a.maxPlayers - a.playersCount));
    } else if (sortBy === 'nearest') {
      result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return result;
  }, [games, debouncedSearch, statusFilter, genderFilter, sortBy]);

  // Estabilizado: navigate é estável, dep array vazio seguro
  const handleCardClick = useCallback((gameId: string) => {
    navigate(`/game/${gameId}`);
  }, [navigate]);

  return (
    <Box sx={{ pb: { xs: 10, md: 3 }, maxWidth: { xs: '100%', md: 1100, lg: 1320, xl: 1560 }, mx: 'auto', width: '100%' }}>
      {/* Sticky search + filters bar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          bgcolor: 'background.paper', // #2273: token canônico de sticky header
          px: pageSpacing.pagePadding,
          pt: { xs: 1.5, md: 1 },
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
            mb: 1,
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
          sx={{ mb: { xs: 1, md: 0.75 } }}
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

        {/* #2024 - Sort options */}
        <Box sx={{ display: 'flex', alignItems: 'center', pt: { xs: 1, md: 0.5 }, pb: 0.5 }}>
          <SortByAlpha fontSize="small" color="action" sx={{ mr: 1, flexShrink: 0 }} />
          <ToggleButtonGroup
            value={sortBy}
            exclusive
            // #2267: ToggleButtonGroup exclusive emite null ao re-clicar a opção
            // ativa. Mantemos o sort atual (sem deseleção) — um sort sempre ativo
            // é o comportamento esperado; deselecionar deixaria a lista sem ordem.
            onChange={(_, v: SortBy | null) => { if (v !== null) setSortBy(v); }}
            size="small"
            sx={{ flexWrap: 'nowrap' }}
          >
            {SORT_OPTIONS.map((opt) => (
              <ToggleButton
                key={opt.value}
                value={opt.value}
                aria-label={t(opt.labelKey)}
                sx={{ px: 1, py: 0.25, textTransform: 'none', fontSize: '0.75rem', gap: 0.5 }}
              >
                {opt.icon}
                {t(opt.labelKey)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {/* Filtro de gênero */}
        <Box sx={{ display: 'flex', alignItems: 'center', pt: 0.25, pb: { xs: 1, md: 0.75 } }}>
          <GenderIcon fontSize="small" color="action" sx={{ mr: 1, flexShrink: 0 }} />
          <ToggleButtonGroup
            value={genderFilter}
            exclusive
            onChange={(_, v: 'all' | GameGender | null) => { if (v !== null) setGenderFilter(v); }}
            size="small"
            aria-label={t('games.genderFilter.all')}
            sx={{ flexWrap: 'nowrap' }}
          >
            <ToggleButton value="all" sx={{ px: 1, py: 0.25, textTransform: 'none', fontSize: '0.75rem' }}>
              {t('games.genderFilter.all')}
            </ToggleButton>
            <ToggleButton value="MALE" sx={{ px: 1, py: 0.25, textTransform: 'none', fontSize: '0.75rem' }}>
              {t('games.genderFilter.male')}
            </ToggleButton>
            <ToggleButton value="FEMALE" sx={{ px: 1, py: 0.25, textTransform: 'none', fontSize: '0.75rem' }}>
              {t('games.genderFilter.female')}
            </ToggleButton>
            <ToggleButton value="MIXED" sx={{ px: 1, py: 0.25, textTransform: 'none', fontSize: '0.75rem' }}>
              {t('games.genderFilter.mixed')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Box sx={{ px: pageSpacing.pagePadding, pt: { xs: 2, md: 1.25 } }}>
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => refetch()}
            retryLabel={t('common.retry')}
          />
        ) : loading || groupsLoading ? (
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
          <EmptyState
            icon={hasActiveFilters || hasGroups ? <SportsSoccer /> : <People />}
            title={
              hasActiveFilters
                ? t('games.empty.filteredTitle')
                : hasGroups
                  ? t('games.empty.noScheduledTitle')
                  : t('games.empty.joinGroupTitle')
            }
            description={
              hasActiveFilters
                ? t('games.empty.filteredDesc')
                : !hasGroups
                  ? t('games.empty.joinGroupDesc')
                  : statusFilter === 'all'
                  ? t('games.empty.noneAvailable')
                  : statusFilter === 'SCHEDULED'
                    ? t('games.empty.noneOpen')
                    : statusFilter === 'LIVE'
                      ? t('games.empty.noneLive')
                      : t('games.empty.noneFinished')
            }
            actionLabel={hasActiveFilters ? t('games.empty.clearFilters') : hasGroups ? t('games.createGame') : t('groups.discoverGroupsBtn')}
            actionIcon={hasActiveFilters ? <FilterListOff /> : hasGroups ? <Add /> : <People />}
            onAction={hasActiveFilters ? clearFilters : () => navigate(hasGroups ? '/game/create' : '/groups/discover')}
          />
        ) : (
          <Box sx={{ px: isLg ? 1 : 0 }}>
            <Grid container spacing={{ xs: 2, md: 1.5, xl: 2 }} className="stagger-fade-in">
          {filteredGames.map((game) => {
            const progress = game.maxPlayers > 0 ? Math.min((game.playersCount / game.maxPlayers) * 100, 100) : 0;
            const isFull = game.maxPlayers > 0 && game.playersCount >= game.maxPlayers;
            const isLive = game.status === 'LIVE';

            return (
              <Grid xs={12} md={6} xl={4} key={game.id}>
              <Card sx={{ mb: { xs: 2, md: 0 }, ...(isLive ? { borderLeft: `3px solid ${theme.palette.error.main}` } : {}) }}>
                <CardActionArea onClick={() => handleCardClick(game.id)}>
                  <CardContent sx={{ p: { xs: 2, md: 1.5 }, '&:last-child': { pb: { xs: 2, md: 1.5 } } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1, md: 0.75 } }}>
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
                          {/* Badge de gênero: exibido apenas para MALE ou FEMALE */}
                          {(game.gender === 'MALE' || game.gender === 'FEMALE') && (
                            <Chip
                              label={game.gender === 'MALE' ? t('games.genderFilter.male') : t('games.genderFilter.female')}
                              size="small"
                              sx={{
                                fontSize: '0.75rem',
                                height: 18,
                                fontWeight: 600,
                                backgroundColor: alpha(
                                  game.gender === 'MALE'
                                    ? theme.palette.info.main
                                    : theme.palette.secondary.main,
                                  0.12
                                ),
                                color: theme.palette.mode === 'dark'
                                  ? (game.gender === 'MALE' ? theme.palette.info.light : theme.palette.secondary.light)
                                  : (game.gender === 'MALE' ? theme.palette.info.dark : theme.palette.secondary.dark),
                              }}
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

                    <Box sx={{ mt: { xs: 2, md: 1.25 } }}>
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

      {/* #2178: ScreenFab padronizado */}
      <ScreenFab
        icon={<Add />}
        aria-label={t('games.createGame')}
        onClick={() => navigate('/game/create')}
        sx={{
          display: { xs: 'flex', md: 'none' },
          bottom: { xs: pageSpacing.bottomBarHeight + 16, md: 24 },
          right: { xs: 16, md: 24 },
        }}
      />
    </Box>
  );
}
