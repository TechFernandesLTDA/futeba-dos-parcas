import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getPositionBadgeStyle } from '../../utils/gamificationStyle';
import { useNavigate } from 'react-router-dom';
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
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useLeague, LeaguePlayer, LeagueFilters } from '../../hooks/useLeague';
import { DIVISION_CONFIG, LeagueDivision } from '../../types/gamification';
import { useTranslation } from 'react-i18next';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LeagueScreen');

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

export const LeagueScreen: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user } = useAuth();
  const { t } = useTranslation();
  const { showError } = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('points');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [shareSnack, setShareSnack] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'LeagueScreen' });

  const userCardRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const pullStartY = useRef<number | null>(null);
  const pullDelta = useRef(0);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // BUG 1 fix: Buscar temporada ativa para filtrar season_participation
  useEffect(() => {
    let cancelled = false;
    const fetchSeason = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'seasons'), where('isActive', '==', true), limit(1)));
        if (!cancelled) {
          setActiveSeasonId(snap.docs[0]?.id || null);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Error fetching active season:', err);
          showError('Erro ao carregar temporada ativa');
        }
      }
    };
    fetchSeason();
    return () => { cancelled = true; };
  }, [showError]);

  const selectedDivision = tabValue > 0 ? LEAGUE_DIVISIONS[tabValue - 1] : undefined;

  // BUG 1 fix: Passar filters com seasonId para evitar duplicação
  const filters: LeagueFilters = useMemo(() => ({
    seasonId: activeSeasonId,
  }), [activeSeasonId]);

  // BUG 3 fix: Buscar dados sem filtro de divisão para contadores
  const { players: allPlayers, loading, error, refetch } = useLeague(user?.id, undefined, filters);
  // Dados filtrados por divisão (para exibição)
  const { players } = useLeague(user?.id, selectedDivision, filters);

  // BUG 3 + BUG 9 fix: Calcular contadores sobre allPlayers (sem filtro de divisão) usando reduce
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

  // BUG 14 fix: Normalizar acentos na busca
  const normalizeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

  // BUG 4 fix: Calcular posição real no array completo (ordenado por pontos), não no filtrado
  const realPositions = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.points - a.points);
    const posMap = new Map<string, number>();
    sorted.forEach((p, i) => posMap.set(p.id, i + 1));
    return posMap;
  }, [players]);

  const currentUserPlayer = useMemo(
    () => players.find(p => p.isCurrentUser),
    [players]
  );

  const currentUserPosition = useMemo(
    () => currentUserPlayer ? realPositions.get(currentUserPlayer.id) || null : null,
    [currentUserPlayer, realPositions]
  );

  const pointsToNext = useMemo(() => {
    if (!currentUserPosition || currentUserPosition <= 1) return null;
    const sorted = [...players].sort((a, b) => b.points - a.points);
    const above = sorted[currentUserPosition - 2];
    if (!above || !currentUserPlayer) return null;
    const diff = above.points - currentUserPlayer.points;
    return { name: above.userName, diff, position: currentUserPosition - 1 };
  }, [players, currentUserPosition, currentUserPlayer]);

  // BUG 8 fix: Memoizar callbacks para não quebrar React.memo
  const handleRetry = useCallback(() => refetch(), [refetch]);

  const scrollToMe = useCallback(() => {
    userCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // BUG 11 fix: Clipboard error handling
  const handleShare = useCallback(async () => {
    if (!currentUserPlayer || !currentUserPosition) return;
    const text = `Estou em ${currentUserPosition}º lugar na Liga ${DIVISION_CONFIG[currentUserPlayer.division]?.label || currentUserPlayer.division} com ${currentUserPlayer.points} pontos!`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setShareSnack(true);
      } catch (err) {
        logger.error('Clipboard write failed:', err);
        showError('Não foi possível copiar para a área de transferência');
      }
    }
  }, [currentUserPlayer, currentUserPosition, showError]);

  // BUG 10 fix: IntersectionObserver com cleanup adequado e reset de state
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
  }, [currentUserPlayer]);

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

  // BUG 7 fix: Pull-to-refresh usa refetch() que retorna Promise resolvida quando completa
  const handleTouchEnd = useCallback(() => {
    if (pullDelta.current > 60 && !isRefreshing) {
      setIsRefreshing(true);
      refetch().finally(() => {
        setIsRefreshing(false);
      });
    }
    pullStartY.current = null;
    pullDelta.current = 0;
    setPullProgress(0);
  }, [isRefreshing, refetch]);

  const getPositionStyle = (position: number) => getPositionBadgeStyle(position, theme);

  const getPositionTooltip = (position: number): string => {
    if (position === 1) return 'Líder da temporada!';
    if (position === 2) return 'Vice-líder, quase lá!';
    if (position === 3) return 'Top 3 - Zona de promoção';
    if (position <= PROMO_TOP) return 'Zona de promoção';
    if (position > players.length - RELEG_BOTTOM && players.length > RELEG_BOTTOM * 2) return 'Zona de rebaixamento';
    return `${position}ª posição`;
  };

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
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 0.5 }}>
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label={t('common.back')}>
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

        <Collapse in={showSearch}>
          <Box sx={{ px: 2, pb: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar jogador..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>
        </Collapse>

        <Collapse in={showSort}>
          <Box sx={{ px: 2, pb: 1, overflowX: 'auto' }}>
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
                    bgcolor: DIVISION_CONFIG[div]?.color ?? 'transparent',
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
                '&.Mui-selected': { color: DIVISION_CONFIG[div]?.color },
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
            top: 56, // BUG 5 fix: Posicionar abaixo do header (altura estimada do header)
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
              bgcolor: alpha(DIVISION_CONFIG[currentUserPlayer.division]?.color, 0.15),
              color: 'text.primary',
              fontSize: '0.7rem',
              height: 20,
            }}
          />
          <Typography variant="body2" fontWeight={700}>{currentUserPlayer.points} pts</Typography>
        </Box>
      )}

      <Container
        maxWidth={isMd ? 'md' : 'sm'}
        sx={{ py: 2 }}
        ref={listContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
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
        ) : filteredAndSorted.length === 0 && search ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">Nenhum jogador encontrado</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
              Tente outro nome na busca
            </Typography>
            <Button variant="outlined" onClick={() => setSearch('')}>Limpar busca</Button>
          </Box>
        ) : filteredAndSorted.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <MilitaryTechIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {selectedDivision
                ? t('league.emptyDivisionTitle')
                : t('league.seasonNotStartedTitle')}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
              {selectedDivision
                ? t('league.emptyDivisionDesc')
                : t('league.seasonNotStartedDesc')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              {!selectedDivision && (
                <Button variant="outlined" onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }}>
                  {t('league.viewPreviousSeason')}
                </Button>
              )}
              <Button variant="contained" startIcon={<SoccerIcon />} onClick={() => navigate('/games/create')}>
                Criar jogo
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            {pointsToNext && currentUserPlayer && (
              <Alert severity="info" sx={{ mb: 2 }} icon={<ArrowUpIcon />}>
                Faltam <strong>{pointsToNext.diff} pts</strong> para ultrapassar <strong>{pointsToNext.name}</strong> ({pointsToNext.position}º)
              </Alert>
            )}

            {players.length > 0 && (
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
                {players.length > RELEG_BOTTOM * 2 && (
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

            <List disablePadding aria-label={t('league.standingsAria')}>
              {filteredAndSorted.map((player) => {
                // BUG 4 fix: Usar posição real no ranking, não index do array filtrado
                const position = realPositions.get(player.id) || 0;
                const isPromoZone = position <= PROMO_TOP && position > 0;
                const isRelegZone = position > players.length - RELEG_BOTTOM && players.length > RELEG_BOTTOM * 2 && position > 0;
                return (
                  <LeaguePlayerItem
                    key={player.id}
                    player={player}
                    position={position}
                    positionStyle={getPositionStyle(position)}
                    positionTooltip={getPositionTooltip(position)}
                    isExpanded={expandedId === player.id}
                    onToggleExpand={() => setExpandedId(expandedId === player.id ? null : player.id)}
                    isPromoZone={isPromoZone}
                    isRelegZone={isRelegZone}
                    cardRef={player.isCurrentUser ? userCardRef : undefined}
                    totalPlayers={players.length}
                  />
                );
              })}
            </List>
          </>
        )}
      </Container>

      {currentUserPlayer && !showSticky && (
        <Fab
          color="primary"
          size="medium"
          onClick={scrollToMe}
          sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 12 }}
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
  onToggleExpand: () => void;
  isPromoZone: boolean;
  isRelegZone: boolean;
  cardRef?: React.Ref<HTMLDivElement>;
  totalPlayers: number;
}) {
  const theme = useTheme();
  const divisionConfig = DIVISION_CONFIG[player.division] || DIVISION_CONFIG.BRONZE;
  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;

  const zoneColor = isPromoZone
    ? theme.palette.success.main
    : isRelegZone
    ? theme.palette.error.main
    : undefined;

  return (
    <Card
      ref={cardRef}
      onClick={onToggleExpand}
      sx={{
        mb: 1,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
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
              {position <= 3 ? <TrophyIcon fontSize="small" /> : position}
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

          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
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
              {position <= 3 ? 'Você está na zona de promoção!' : position > totalPlayers - RELEG_BOTTOM && totalPlayers > RELEG_BOTTOM * 2 ? 'Atenção: zona de rebaixamento' : 'Continue jogando para subir!'}
            </Typography>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
});

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
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
}
