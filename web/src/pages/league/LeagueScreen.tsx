import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getPositionBadgeStyle } from '../../utils/gamificationStyle';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  alpha,
  List,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Collapse,
  Fab,
  Snackbar,
  LinearProgress,
  Divider,
  Fade,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  MilitaryTech as MilitaryTechIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  MyLocation as MyLocationIcon,
  Share as ShareIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Sort as SortIcon,
  SportsSoccer as SoccerIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { useLeague, LeaguePlayer, LeagueFilters } from '../../hooks/useLeague';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { useActiveSeason } from '../../hooks/useActiveSeason';
import { useSeasons } from '../../hooks/useSeasons';
import { DIVISION_CONFIG, LeagueDivision, getDivisionColor } from '../../types/gamification';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type SortField = 'points' | 'goals' | 'wins' | 'gamesPlayed' | 'assists' | 'mvpCount';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'points', label: 'Pontos' },
  { value: 'goals', label: 'Gols' },
  { value: 'wins', label: 'Vitórias' },
  { value: 'gamesPlayed', label: 'Jogos' },
  { value: 'assists', label: 'Assist.' },
  { value: 'mvpCount', label: 'MVPs' },
];

const PROMO_TOP = 3;
const RELEG_BOTTOM = 3;
const LEAGUE_DIVISIONS: LeagueDivision[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION'];

// Normalização fora do componente (função pura, não recriada)
const normalizeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const LeagueScreen: React.FC = () => {
  const navigate = useNavigate();
  const goBack = useNavigateBack('/?tab=3');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const { t } = useTranslation();
  useDocumentTitle(t('nav.league'));
  const { showError } = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('points');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [shareSnack, setShareSnack] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [maxResults, setMaxResults] = useState(200);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'LeagueScreen' });

  const userCardRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number | null>(null);
  const pullDelta = useRef(0);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(96);

  const { seasonId: activeSeasonId, loading: seasonLoading } = useActiveSeason();
  const { seasons } = useSeasons();

  useEffect(() => {
    if (!selectedSeasonId && activeSeasonId) {
      setSelectedSeasonId(activeSeasonId);
    }
  }, [activeSeasonId, selectedSeasonId]);

  const effectiveSeasonId = selectedSeasonId || activeSeasonId;

  const selectedDivision = tabValue > 0 ? LEAGUE_DIVISIONS[tabValue - 1] : undefined;

  const filters: LeagueFilters = useMemo(() => ({
    seasonId: effectiveSeasonId,
    maxResults,
  }), [effectiveSeasonId, maxResults]);

  const { players: allPlayers, loading, error, refetch } = useLeague(
    user?.id,
    filters,
    { enabled: !!effectiveSeasonId }
  );

  // Derivar players filtrados por divisão (client-side, sem query extra)
  const players = useMemo(
    () => selectedDivision ? allPlayers.filter(p => p.division === selectedDivision) : allPlayers,
    [allPlayers, selectedDivision]
  );

  // Contadores por divisão (sobre allPlayers, não filtrado)
  const divisionCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allPlayers.length };
    LEAGUE_DIVISIONS.forEach(d => { counts[d] = 0; });
    for (const p of allPlayers) {
      if (counts[p.division] !== undefined) {
        counts[p.division]++;
      }
    }
    return counts;
  }, [allPlayers]);

  const filteredAndSorted = useMemo(() => {
    let result = players;
    if (search.trim()) {
      const q = normalizeText(search.trim());
      result = result.filter(p => normalizeText(p.userName).includes(q));
    }
    if (sortField !== 'points') {
      result = [...result].sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));
    }
    return result;
  }, [players, search, sortField]);

  // Sort consolidado: 1 único sort usado por realPositions E pointsToNext
  const sortedByPoints = useMemo(
    () => [...allPlayers].sort((a, b) => b.points - a.points),
    [allPlayers]
  );

  // Posições reais baseadas em allPlayers (posição global, não por divisão)
  const realPositions = useMemo(() => {
    const posMap = new Map<string, number>();
    sortedByPoints.forEach((p, i) => posMap.set(p.id, i + 1));
    return posMap;
  }, [sortedByPoints]);

  const currentUserPlayer = useMemo(
    () => allPlayers.find(p => p.isCurrentUser),
    [allPlayers]
  );

  const currentUserPosition = useMemo(
    () => currentUserPlayer ? realPositions.get(currentUserPlayer.id) || null : null,
    [currentUserPlayer, realPositions]
  );

  // pointsToNext reutiliza sortedByPoints (sem sort duplicado)
  const pointsToNext = useMemo(() => {
    if (!currentUserPosition || currentUserPosition <= 1) return null;
    const above = sortedByPoints[currentUserPosition - 2];
    if (!above || !currentUserPlayer) return null;
    const diff = above.points - currentUserPlayer.points;
    return { name: above.userName, diff, position: currentUserPosition - 1 };
  }, [sortedByPoints, currentUserPosition, currentUserPlayer]);

  const divisionProgress = useMemo(() => {
    if (!currentUserPlayer) return null;
    const currentDiv = currentUserPlayer.division;
    const divOrder: LeagueDivision[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION'];
    const idx = divOrder.indexOf(currentDiv);
    if (idx < 0 || idx >= divOrder.length - 1) return null;
    const nextDiv = divOrder[idx + 1];
    const currentMin = DIVISION_CONFIG[currentDiv]?.minPoints ?? 0;
    const nextMin = DIVISION_CONFIG[nextDiv]?.minPoints ?? 0;
    const range = nextMin - currentMin;
    if (range <= 0) return null;
    const progress = ((currentUserPlayer.points - currentMin) / range);
    return {
      progress: Math.max(0, Math.min(progress, 1)),
      currentLabel: DIVISION_CONFIG[currentDiv]?.label ?? currentDiv,
      nextLabel: DIVISION_CONFIG[nextDiv]?.label ?? nextDiv,
      nextThreshold: nextMin,
      currentPoints: currentUserPlayer.points,
    };
  }, [currentUserPlayer]);

  useEffect(() => {
    if (headerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setHeaderHeight(entry.contentRect.height);
        }
      });
      observer.observe(headerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Callbacks memoizados para não quebrar React.memo
  const handleRetry = useCallback(() => refetch(), [refetch]);
  const handleRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  const scrollToMe = useCallback(() => {
    userCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleShare = useCallback(async () => {
    if (!currentUserPlayer || !currentUserPosition) return;
    const divParam = currentUserPlayer.division.toLowerCase();
    const url = `https://futebadosparcas.web.app/league?division=${divParam}`;
    const text = `Estou em ${currentUserPosition}º lugar na Liga ${DIVISION_CONFIG[currentUserPlayer.division]?.label || currentUserPlayer.division} com ${currentUserPlayer.points} pontos!`;
    if (navigator.share) {
      try { await navigator.share({ text, url }); } catch { /* cancelled */ }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareSnack(true);
      } catch {
        showError('Não foi possível copiar para a área de transferência');
      }
    }
  }, [currentUserPlayer, currentUserPosition, showError]);

  // onToggleExpand memoizado: recebe id ao invés de closure inline
  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // IntersectionObserver depende do ID, não do objeto inteiro
  const currentUserId = currentUserPlayer?.id ?? null;
  useEffect(() => {
    const el = userCardRef.current;
    if (!el) {
      setShowSticky(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setShowSticky(false);
    };
  }, [currentUserId]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (listContainerRef.current && listContainerRef.current.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const delta = e.touches[0].clientY - pullStartY.current;
    if (delta > 0) {
      pullDelta.current = delta;
      setPullProgress(Math.min(delta / 100, 1));
    }
  }, []);

  // Pull-to-refresh com timeout de proteção (10s)
  const handleTouchEnd = useCallback(() => {
    if (pullDelta.current > 60 && !isRefreshing) {
      setIsRefreshing(true);
      const timeoutId = setTimeout(() => setIsRefreshing(false), 10000);
      refetch().finally(() => {
        clearTimeout(timeoutId);
        setIsRefreshing(false);
      });
    }
    pullStartY.current = null;
    pullDelta.current = 0;
    setPullProgress(0);
  }, [isRefreshing, refetch]);

  // getPositionStyle memoizado com Map cache por position
  const positionStyleCache = useRef(new Map<number, { bgcolor: string; color: string }>());
  const getPositionStyle = useCallback((position: number) => {
    const cached = positionStyleCache.current.get(position);
    if (cached) return cached;
    const style = getPositionBadgeStyle(position, theme);
    positionStyleCache.current.set(position, style);
    return style;
  }, [theme]);

  const getPositionTooltip = useCallback((position: number): string => {
    if (position <= 0) return 'Sem classificação';
    if (position === 1) return 'Líder da temporada!';
    if (position === 2) return 'Vice-líder, quase lá!';
    if (position === 3) return 'Top 3 - Zona de promoção';
    if (position <= PROMO_TOP) return 'Zona de promoção';
    if (position > allPlayers.length - RELEG_BOTTOM && allPlayers.length > RELEG_BOTTOM * 2) return 'Zona de rebaixamento';
    return `${position}ª posição`;
  }, [allPlayers.length]);

  const isLoading = loading || seasonLoading;

  const handleLoadMore = useCallback(() => {
    setMaxResults((prev) => prev + 200);
  }, []);

  const handleSeasonChange = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setMaxResults(200);
  }, []);

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        ref={headerRef}
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 0.5 }}>
          <IconButton onClick={goBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('nav.league')}
          </Typography>
          <IconButton onClick={() => setShowSearch(v => !v)} aria-label="Buscar jogador" size="small">
            <SearchIcon />
          </IconButton>
          <IconButton onClick={() => setShowSort(v => !v)} aria-label="Ordenar" size="small">
            <SortIcon />
          </IconButton>
          {currentUserPlayer && (
            <IconButton onClick={handleShare} aria-label="Compartilhar posição" size="small">
              <ShareIcon />
            </IconButton>
          )}
        </Box>

        {seasons.length > 1 && (
          <Box sx={{ px: 2, pb: 1 }}>
            <FormControl size="small" fullWidth>
              <Select
                value={effectiveSeasonId || ''}
                onChange={(e) => handleSeasonChange(e.target.value)}
                variant="outlined"
                sx={{ fontSize: '0.875rem' }}
              >
                {seasons.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}{s.isActive ? ' (Ativa)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        <Collapse in={showSearch}>
          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar jogador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              inputProps={{ maxLength: 200 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')} aria-label="Limpar busca" sx={{ minWidth: 44, minHeight: 44 }}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>
        </Collapse>

        <Collapse in={showSort}>
          <Box sx={{ px: 2, pb: 1, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
            <ToggleButtonGroup
              value={sortField}
              exclusive
              onChange={(_, v) => v && setSortField(v)}
              size="small"
              sx={{ flexWrap: 'nowrap' }}
            >
              {SORT_OPTIONS.map(opt => (
                <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Collapse>

        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Divisões da liga"
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {t('league.tabAll')}
                <Chip label={divisionCounts.ALL || 0} size="small" sx={{ height: 18, fontSize: '0.7rem', minWidth: 24 }} />
              </Box>
            }
          />
          {LEAGUE_DIVISIONS.map((div) => (
            <Tab
              key={div}
              iconPosition="start"
              icon={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: getDivisionColor(div, theme) ?? 'transparent',
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {DIVISION_CONFIG[div]?.label ?? div}
                  <Chip label={divisionCounts[div] || 0} size="small" sx={{ height: 18, fontSize: '0.7rem', minWidth: 24 }} />
                </Box>
              }
              sx={{
                minHeight: 48,
                '&.Mui-selected': { color: getDivisionColor(div, theme) },
              }}
            />
          ))}
        </Tabs>

        {isRefreshing && <LinearProgress sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />}
        {pullProgress > 0 && !isRefreshing && (
          <LinearProgress
            variant="determinate"
            value={pullProgress * 100}
            sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, opacity: 0.6 }}
          />
        )}
      </Box>

      {showSticky && currentUserPlayer && currentUserPosition && (
        <Box
          sx={{
            position: 'fixed',
            top: headerHeight,
            left: 0,
            right: 0,
            zIndex: 11,
            bgcolor: theme.palette.background.paper,
            borderBottom: `2px solid ${theme.palette.primary.main}`,
            px: 2,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            boxShadow: 2,
          }}
          onClick={scrollToMe}
        >
          <Chip label={`${currentUserPosition}º`} size="small" color="primary" sx={{ fontWeight: 700 }} />
          <Typography variant="caption" fontWeight={600} noWrap sx={{ flex: 1 }}>
            {currentUserPlayer.userName}
          </Typography>
          <Chip
            label={DIVISION_CONFIG[currentUserPlayer.division]?.label}
            size="small"
            sx={{
              bgcolor: alpha(getDivisionColor(currentUserPlayer.division, theme), 0.15),
              color: 'text.primary',
              fontSize: '0.7rem',
              height: 20,
            }}
          />
          <Typography variant="body2" fontWeight={700}>{currentUserPlayer.points} pts</Typography>
        </Box>
      )}

      <PullToRefresh onRefresh={handleRefresh}>
      <Container
        maxWidth={isMd ? 'md' : 'sm'}
        sx={{ py: 2 }}
        ref={listContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isLoading ? (
          <LoadingState shimmerCount={8} itemType="RANKING" />
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={handleRetry}>
                {t('common.retry')}
              </Button>
            }
            sx={{ mb: 2 }}
          >
            {t('league.loadError', { error })}
          </Alert>
        ) : filteredAndSorted.length === 0 && search.trim() ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Nenhum jogador encontrado</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
              Tente outro nome na busca
            </Typography>
            <Button variant="outlined" onClick={() => setSearch('')}>Limpar busca</Button>
          </Box>
        ) : filteredAndSorted.length === 0 ? (
          <EmptyState
            icon={<MilitaryTechIcon />}
            title={selectedDivision
              ? t('league.emptyDivisionTitle')
              : t('league.seasonNotStartedTitle')}
            description={selectedDivision
              ? t('league.emptyDivisionDesc')
              : t('league.seasonNotStartedDesc')}
            actionLabel="Criar jogo"
            actionIcon={<SoccerIcon />}
            onAction={() => navigate('/game/create')}
          />
        ) : (
          <Fade in key={tabValue}>
          <Box>
            {pointsToNext && currentUserPlayer && (
              <Alert severity="info" sx={{ mb: 2 }} icon={<ArrowUpIcon />}>
                Faltam <strong>{pointsToNext.diff} pts</strong> para ultrapassar <strong>{pointsToNext.name}</strong> ({pointsToNext.position}º)
              </Alert>
            )}

            {allPlayers.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrophyIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                      Top {PROMO_TOP}: Promoção
                    </Box>
                  }
                  size="small"
                  sx={{ bgcolor: alpha(theme.palette.success.main, 0.08), color: 'text.primary' }}
                />
                {allPlayers.length > RELEG_BOTTOM * 2 && (
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <ArrowDownIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                        Últimos {RELEG_BOTTOM}: Rebaixamento
                      </Box>
                    }
                    size="small"
                    sx={{ bgcolor: alpha(theme.palette.error.main, 0.08), color: 'text.primary' }}
                  />
                )}
              </Box>
            )}

            {divisionProgress && (
              <Card sx={{ mb: 2, border: `1px solid ${alpha(DIVISION_CONFIG[
                LEAGUE_DIVISIONS[LEAGUE_DIVISIONS.indexOf(currentUserPlayer!.division) + 1]
              ]?.color ?? theme.palette.divider, 0.3)}` }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" fontWeight={600}>
                      {divisionProgress.currentLabel}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {divisionProgress.nextLabel} ({divisionProgress.nextThreshold} pts)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={divisionProgress.progress * 100}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        bgcolor: DIVISION_CONFIG[
                          LEAGUE_DIVISIONS[LEAGUE_DIVISIONS.indexOf(currentUserPlayer!.division) + 1]
                        ]?.color ?? theme.palette.primary.main,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                    {divisionProgress.currentPoints} / {divisionProgress.nextThreshold} pts
                  </Typography>
                </CardContent>
              </Card>
            )}

            <List disablePadding aria-label={t('league.standingsAria')}>
              {filteredAndSorted.map((player) => {
                const position = realPositions.get(player.id) ?? -1;
                const isPromoZone = position >= 1 && position <= PROMO_TOP;
                const isRelegZone = position > allPlayers.length - RELEG_BOTTOM && allPlayers.length > RELEG_BOTTOM * 2 && position > 0;
                return (
                  <LeaguePlayerItem
                    key={player.id}
                    player={player}
                    position={position}
                    positionStyle={getPositionStyle(position)}
                    positionTooltip={getPositionTooltip(position)}
                    isExpanded={expandedId === player.id}
                    onToggleExpand={handleToggleExpand}
                    isPromoZone={isPromoZone}
                    isRelegZone={isRelegZone}
                    cardRef={player.isCurrentUser ? userCardRef : undefined}
                    totalPlayers={allPlayers.length}
                  />
                );
              })}
            </List>

            {filteredAndSorted.length >= maxResults && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loading}
                >
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </Box>
            )}
          </Box>
          </Fade>
        )}
      </Container>
      </PullToRefresh>

      {currentUserPlayer && !showSticky && (
        <Fab
          color="primary"
          size="medium"
          onClick={scrollToMe}
          sx={{
            position: 'fixed',
            bottom: { xs: 80, md: 24 },
            right: { xs: 16, md: 24 },
            zIndex: 12,
            pb: { xs: 'env(safe-area-inset-bottom, 0px)', md: 0 },
          }}
          aria-label="Ir para minha posição"
        >
          <MyLocationIcon />
        </Fab>
      )}

      <Snackbar
        open={shareSnack}
        autoHideDuration={3000}
        onClose={() => setShareSnack(false)}
        message={t('league.positionCopied', 'Posição copiada!')}
      />

      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
};

const LeaguePlayerItem = React.memo(function LeaguePlayerItem({
  player,
  position,
  positionStyle,
  positionTooltip,
  isExpanded,
  onToggleExpand,
  isPromoZone,
  isRelegZone,
  cardRef,
  totalPlayers,
}: {
  player: LeaguePlayer;
  position: number;
  positionStyle: { bgcolor: string; color: string };
  positionTooltip: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  isPromoZone: boolean;
  isRelegZone: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  totalPlayers: number;
}) {
  const theme = useTheme();
  // #2163: color theme-aware (dark/OLED)
  const divisionConfig = {
    ...(DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE),
    color: getDivisionColor(player.division, theme),
  };
  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  const zoneColor = isPromoZone
    ? theme.palette.success.main
    : isRelegZone
    ? theme.palette.error.main
    : undefined;

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(player.id);
  }, [onToggleExpand, player.id]);

  return (
    <Card
      ref={cardRef}
      onClick={() => onToggleExpand(player.id)}
      sx={{
        mb: 1,
        cursor: 'pointer',
        transition: (t) => t.transitions.create('all', { duration: t.transitions.duration.standard }),
        bgcolor: player.isCurrentUser
          ? (t) => alpha(t.palette.primary.main, 0.1)
          : zoneColor
          ? alpha(zoneColor, 0.05)
          : 'background.paper',
        border: player.isCurrentUser
          ? (t) => `2px solid ${t.palette.primary.main}`
          : zoneColor
          ? `2px solid ${zoneColor}`
          : '1px solid',
        borderColor: player.isCurrentUser ? 'primary.main' : zoneColor || 'divider',
        ...(player.isCurrentUser && {
          animation: 'leaguePulse 2s ease-in-out 1',
          '@keyframes leaguePulse': {
            '0%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0.4)}` },
            '70%': { boxShadow: `0 0 0 10px ${alpha(theme.palette.primary.main, 0)}` },
            '100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}` },
          },
        }),
      }}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title={positionTooltip} arrow placement="top">
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                ...positionStyle,
              }}
            >
              {position >= 1 && position <= 3 ? <TrophyIcon fontSize="small" /> : position > 0 ? position : '—'}
            </Box>
          </Tooltip>

          <PlayerAvatar
            name={player.userName}
            photoUrl={player.userPhoto}
            size={48}
            level={player.level}
          />

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {player.userName}
              </Typography>
              <TeamBadge teamId={player.favoriteTeam} size={18} />
              {player.isCurrentUser && (
                <Chip label="Você" size="small" color="primary" />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {player.gamesPlayed} jogos
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.wins}V
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.goals}g
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {player.assists || 0}a
              </Typography>
            </Box>
          </Box>

          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              color={divisionConfig.color}
            >
              {player.points}
            </Typography>
            <Chip
              label={divisionConfig.label}
              size="small"
              variant="outlined"
              sx={{
                bgcolor: alpha(divisionConfig.color, 0.12),
                color: 'text.primary',
                borderColor: divisionConfig.color,
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 20,
              }}
            />
          </Box>

          <IconButton onClick={handleToggle} aria-label={isExpanded ? 'Recolher' : 'Expandir'}>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={isExpanded}>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, textAlign: 'center' }}>
            <StatBox label="Vitórias" value={player.wins} color={theme.palette.success.main} />
            <StatBox label="Derrotas" value={Math.max(0, player.gamesPlayed - player.wins)} color={theme.palette.error.main} />
            <StatBox label="Win Rate" value={`${winRate}%`} color={theme.palette.primary.main} />
            <StatBox label="Gols" value={player.goals} color={theme.palette.warning.main} />
            <StatBox label="Assistências" value={player.assists || 0} color={theme.palette.info.main} />
            <StatBox label="MVPs" value={player.mvpCount || 0} color={theme.palette.secondary.main} />
          </Box>
          {player.isCurrentUser && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              {position >= 1 && position <= 3 ? 'Você está na zona de promoção!' : position > totalPlayers - RELEG_BOTTOM && totalPlayers > RELEG_BOTTOM * 2 ? 'Atenção: zona de rebaixamento' : 'Continue jogando para subir!'}
            </Typography>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
});

const StatBox = React.memo(function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Box>
      <Typography variant="h6" fontWeight={700} sx={{ color }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
});
