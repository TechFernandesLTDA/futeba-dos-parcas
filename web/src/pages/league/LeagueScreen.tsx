import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { getPositionBadgeStyle } from '../../utils/gamificationStyle';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import {
  Box,
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
  alpha,
  List,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Collapse,
  Snackbar,
  LinearProgress,
  Divider,
  Fade,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  useMediaQuery,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Switch,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Radio,
  RadioGroup,
  CircularProgress,
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
  PersonAdd as PersonAddIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { PlayerAvatar, LoadingState } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { ScreenFab } from '../../components/layout';
import { useLeague, LeaguePlayer, LeagueFilters, LeagueSortField } from '../../hooks/useLeague';
import { useLeagueInvites, LeagueInviteOption } from '../../hooks/useLeagueInvites';
import { useCreateDirectChat } from '../../hooks/useDirectMessages';
import { useDebounce } from '../../hooks/useDebounce';
import type { GameGender } from '../../types/game';
import { PullToRefresh } from '../../components/common/PullToRefresh';
import { useActiveSeason } from '../../hooks/useActiveSeason';
import { useSeasons } from '../../hooks/useSeasons';
import { DIVISION_CONFIG, LeagueDivision, getDivisionColor } from '../../types/gamification';
import { useTranslation, Trans } from 'react-i18next';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

type SortField = LeagueSortField;

export interface LeagueScreenProps {
  embedded?: boolean;
}

const SORT_OPTIONS: { value: SortField; labelKey: string }[] = [
  { value: 'experiencePoints', labelKey: 'league.sortXp' },
  { value: 'points', labelKey: 'league.sortPoints' },
  { value: 'name', labelKey: 'league.sortName' },
  { value: 'goals', labelKey: 'league.sortGoals' },
  { value: 'wins', labelKey: 'league.sortWins' },
  { value: 'gamesPlayed', labelKey: 'league.sortGames' },
  { value: 'assists', labelKey: 'league.sortAssists' },
  { value: 'mvpCount', labelKey: 'league.sortMvps' },
];

const PROMO_TOP = 3;
const RELEG_BOTTOM = 3;
const LEAGUE_DIVISIONS: LeagueDivision[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'CHAMPION'];

// Normalização fora do componente (função pura, não recriada)
const normalizeText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const LeagueScreen: React.FC<LeagueScreenProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const goBack = useNavigateBack('/?tab=3');
  const theme = useTheme();
  const { user } = useAuth();
  const { t } = useTranslation();
  useDocumentTitle(t('nav.league'));
  const { showError } = useToast();

  const [tabValue, setTabValue] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [sortField, setSortField] = useState<SortField>('experiencePoints');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const [shareSnack, setShareSnack] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const pageSize = 25;
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  // Fase 4b: filtro de gênero do ranking ('ALL' = combinado).
  const [genderFilter, setGenderFilter] = useState<'ALL' | GameGender>('ALL');
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dense, setDense] = useState(true);
  const [inviteTarget, setInviteTarget] = useState<LeaguePlayer | null>(null);
  const [actionTarget, setActionTarget] = useState<LeaguePlayer | null>(null);
  const [messageTargetId, setMessageTargetId] = useState<string | null>(null);
  const [selectedInviteOptionId, setSelectedInviteOptionId] = useState('');
  const { create: createDirectChat, creating: creatingChat } = useCreateDirectChat();

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
    maxResults: pageSize,
    gender: genderFilter === 'ALL' ? null : genderFilter,
    search: debouncedSearch.trim() || null,
    sortField,
    sortDirection,
  }), [effectiveSeasonId, genderFilter, debouncedSearch, sortField, sortDirection]);

  const {
    players: allPlayers,
    totalCount,
    loading,
    error,
    refetch,
    loadMore,
    hasMore,
    loadingMore,
  } = useLeague(
    user?.id,
    filters,
    { enabled: !seasonLoading }
  );
  const {
    inviteOptions,
    loading: inviteOptionsLoading,
    error: inviteOptionsError,
    sending: inviteSending,
    sendInvite,
  } = useLeagueInvites();

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
    if (debouncedSearch.trim()) {
      const q = normalizeText(debouncedSearch.trim());
      result = result.filter(p =>
        normalizeText(p.userName).includes(q) ||
        p.userId.toLowerCase().includes(q.toLowerCase())
      );
    }
    const dir = sortDirection === 'asc' ? 1 : -1;
    const getVal = (p: LeaguePlayer, field: SortField): number => {
      switch (field) {
        case 'winRate': return p.gamesPlayed > 0 ? (p.wins / p.gamesPlayed) : 0;
        case 'losses': return Math.max(0, p.gamesPlayed - p.wins);
        case 'name': return 0;
        case 'experiencePoints': return p.experiencePoints ?? 0;
        default: return p[field] || 0;
      }
    };
    if (sortField === 'name') {
      result = [...result].sort((a, b) => dir * a.userName.localeCompare(b.userName));
    } else if (sortField !== 'experiencePoints' || sortDirection !== 'desc') {
      result = [...result].sort((a, b) => {
        const aVal = getVal(a, sortField);
        const bVal = getVal(b, sortField);
        return dir * (bVal - aVal);
      });
    }
    return result;
  }, [players, debouncedSearch, sortField, sortDirection]);

  const isDefaultRankView = sortField === 'experiencePoints' &&
    sortDirection === 'desc' &&
    !debouncedSearch.trim();
  const hasCompleteLeagueWindow = !hasMore && allPlayers.length >= totalCount;
  const displayPositions = useMemo(() => {
    const posMap = new Map<string, number>();
    filteredAndSorted.forEach((p, i) => posMap.set(p.id, i + 1));
    return posMap;
  }, [filteredAndSorted]);

  // Sort consolidado: 1 único sort usado por realPositions E pointsToNext
  const sortedByPoints = useMemo(
    () => [...allPlayers].sort((a, b) =>
      (b.experiencePoints ?? 0) - (a.experiencePoints ?? 0) ||
      b.points - a.points ||
      a.userName.localeCompare(b.userName)
    ),
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
    () => currentUserPlayer && isDefaultRankView ? realPositions.get(currentUserPlayer.id) || null : null,
    [currentUserPlayer, isDefaultRankView, realPositions]
  );

  // pointsToNext reutiliza sortedByPoints (sem sort duplicado)
  const pointsToNext = useMemo(() => {
    if (!isDefaultRankView) return null;
    if (!currentUserPosition || currentUserPosition <= 1) return null;
    const above = sortedByPoints[currentUserPosition - 2];
    if (!above || !currentUserPlayer) return null;
    const diff = (above.experiencePoints ?? 0) - (currentUserPlayer.experiencePoints ?? 0);
    return { name: above.userName, diff, position: currentUserPosition - 1 };
  }, [isDefaultRankView, sortedByPoints, currentUserPosition, currentUserPlayer]);

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
    const text = `Estou em ${currentUserPosition}º lugar na Liga ${DIVISION_CONFIG[currentUserPlayer.division]?.label || currentUserPlayer.division} com ${currentUserPlayer.experiencePoints ?? 0} XP!`;
    if (navigator.share) {
      try { await navigator.share({ text, url }); } catch { /* cancelled */ }
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareSnack(true);
      } catch {
        showError(t('feedback.share.copyToClipboardError'));
      }
    }
  }, [currentUserPlayer, currentUserPosition, showError, t]);

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
    if (!isDefaultRankView) return `${position}ª posição nesta ordenação`;
    if (position === 1) return 'Líder da temporada!';
    if (position === 2) return 'Vice-líder, quase lá!';
    if (position === 3) return 'Top 3 - Zona de promoção';
    if (position <= PROMO_TOP) return 'Zona de promoção';
    if (
      hasCompleteLeagueWindow &&
      position > allPlayers.length - RELEG_BOTTOM &&
      allPlayers.length > RELEG_BOTTOM * 2
    ) return 'Zona de rebaixamento';
    return `${position}ª posição`;
  }, [allPlayers.length, hasCompleteLeagueWindow, isDefaultRankView]);

  const isLoading = loading || seasonLoading;

  const handleLoadMore = useCallback(() => {
    void loadMore();
  }, [loadMore]);

  const handleSeasonChange = useCallback((seasonId: string) => {
    setSelectedSeasonId(seasonId);
  }, []);

  const handleTableSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const canInviteFromLeague = useCallback((player: LeaguePlayer) => (
    !!user &&
    !player.isCurrentUser &&
    player.canReceiveInvites === true &&
    inviteOptions.length > 0
  ), [inviteOptions.length, user]);

  const handleOpenInvite = useCallback((player: LeaguePlayer) => {
    setInviteTarget(player);
    setSelectedInviteOptionId((prev) => {
      if (prev && inviteOptions.some((option) => option.id === prev)) return prev;
      return inviteOptions[0]?.id ?? '';
    });
  }, [inviteOptions]);

  const handleCloseInvite = useCallback(() => {
    if (inviteSending) return;
    setInviteTarget(null);
  }, [inviteSending]);

  const handleOpenActions = useCallback((player: LeaguePlayer) => {
    setActionTarget(player);
  }, []);

  const handleCloseActions = useCallback(() => {
    if (creatingChat || inviteSending) return;
    setActionTarget(null);
  }, [creatingChat, inviteSending]);

  const selectedInviteOption = useMemo<LeagueInviteOption | undefined>(
    () => inviteOptions.find((option) => option.id === selectedInviteOptionId),
    [inviteOptions, selectedInviteOptionId],
  );

  const handleSendInvite = useCallback(async () => {
    if (!inviteTarget || !selectedInviteOption) return;
    await sendInvite({
      userId: inviteTarget.userId,
      userName: inviteTarget.userName,
      userPhoto: inviteTarget.userPhoto,
    }, selectedInviteOption);
    setInviteTarget(null);
  }, [inviteTarget, selectedInviteOption, sendInvite]);

  const canMessageFromLeague = useCallback((player: LeaguePlayer) => (
    !!user && !player.isCurrentUser
  ), [user]);

  const handleMessagePlayer = useCallback(async (player: LeaguePlayer) => {
    if (!canMessageFromLeague(player)) return;
    setMessageTargetId(player.userId);
    try {
      const chatId = await createDirectChat(player.userId);
      setActionTarget(null);
      navigate(`/messages/${chatId}`);
    } catch (err) {
      showError(err instanceof Error ? err.message : t('directMessages.createError'));
    } finally {
      setMessageTargetId(null);
    }
  }, [canMessageFromLeague, createDirectChat, navigate, showError, t]);

  const handleInviteFromActions = useCallback((player: LeaguePlayer) => {
    setActionTarget(null);
    handleOpenInvite(player);
  }, [handleOpenInvite]);

  return (
    <Box>
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
          {!embedded && (
            <IconButton onClick={goBack} aria-label={t('common.back')}>
              <BackIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ ml: embedded ? 0 : 1, flex: 1 }}>
            {t('nav.league')}
          </Typography>
          <IconButton onClick={() => setShowSearch(v => !v)} aria-label={t('a11y.searchPlayer')} size="small">
            <SearchIcon />
          </IconButton>
          {!isMdUp && (
            <IconButton onClick={() => setShowSort(v => !v)} aria-label={t('a11y.sort')} size="small">
              <SortIcon />
            </IconButton>
          )}
          {currentUserPlayer && (
            <IconButton onClick={handleShare} aria-label={t('a11y.sharePosition')} size="small">
              <ShareIcon />
            </IconButton>
          )}
        </Box>

        {seasons.length > 1 && (
          <Box sx={{ px: 2, pb: 1 }}>
            <FormControl size="small" fullWidth>
              {/* #2213: InputLabel fornece label acessível ao Select de temporada */}
              <InputLabel id="league-season-label">{t('league.season')}</InputLabel>
              <Select
                labelId="league-season-label"
                label={t('league.season')}
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
              placeholder={t('placeholder.searchPlayer')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              inputProps={{ maxLength: 200 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')} aria-label={t('a11y.clearSearch')} sx={{ minWidth: 44, minHeight: 44 }}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment>
                ) : null,
              }}
            />
          </Box>
        </Collapse>

        {!isMdUp && (
        <Collapse in={showSort}>
          <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Box sx={{ overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, flex: 1 }}>
            <ToggleButtonGroup
              value={sortField}
              exclusive
              onChange={(_, v) => v && setSortField(v)}
              size="small"
              sx={{ flexWrap: 'nowrap' }}
            >
              {SORT_OPTIONS.map(opt => (
                <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
                  {t(opt.labelKey)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            </Box>
            <Tooltip title={sortDirection === 'desc' ? t('league.sortDesc') : t('league.sortAsc')} arrow>
              <IconButton
                size="small"
                onClick={() => setSortDirection((prev) => prev === 'desc' ? 'asc' : 'desc')}
                aria-label={sortDirection === 'desc' ? t('league.sortDesc') : t('league.sortAsc')}
              >
                {sortDirection === 'desc' ? <ArrowDownIcon /> : <ArrowUpIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Collapse>
        )}

        <Box sx={{ px: 2, pb: 1, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          <ToggleButtonGroup
            value={genderFilter}
            exclusive
            size="small"
            onChange={(_, v) => v && setGenderFilter(v)}
            aria-label={t('games.genderFilter.all')}
            sx={{ flexWrap: 'nowrap' }}
          >
            <ToggleButton value="ALL" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.all')}
            </ToggleButton>
            <ToggleButton value="MALE" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.male')}
            </ToggleButton>
            <ToggleButton value="FEMALE" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.female')}
            </ToggleButton>
            <ToggleButton value="MIXED" sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}>
              {t('games.genderFilter.mixed')}
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label={t('a11y.leagueDivisions')}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {t('league.tabAll')}
                <Chip label={divisionCounts.ALL || 0} size="small" sx={{ height: 18, fontSize: '0.75rem', minWidth: 24 }} />
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
                  <Chip label={divisionCounts[div] || 0} size="small" sx={{ height: 18, fontSize: '0.75rem', minWidth: 24 }} />
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
              fontSize: '0.75rem',
              height: 20,
            }}
          />
          <Typography variant="body2" fontWeight={700}>
            {currentUserPlayer.experiencePoints ?? 0} XP
          </Typography>
        </Box>
      )}

      <PullToRefresh onRefresh={handleRefresh}>
      <Box
        ref={listContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      <PageContainer maxWidth="list">
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
            <Typography variant="h6" color="text.secondary">{t('league.emptyTitle')}</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
              {t('league.emptyMessage')}
            </Typography>
            <Button variant="outlined" onClick={() => setSearch('')}>{t('league.clearSearch')}</Button>
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
            actionLabel={t('league.createGame')}
            actionIcon={<SoccerIcon />}
            onAction={() => navigate('/game/create')}
            secondaryActionLabel={t('groups.discoverGroupsBtn')}
            secondaryActionIcon={<PersonAddIcon />}
            onSecondaryAction={() => navigate('/groups/discover')}
          />
        ) : (
          <Fade in key={tabValue}>
          <Box>
            {pointsToNext && currentUserPlayer && (
              <Alert severity="info" sx={{ mb: 2 }} icon={<ArrowUpIcon />}>
                <Trans
                  i18nKey="league.pointsToNext"
                  values={{ diff: pointsToNext.diff, name: pointsToNext.name, position: pointsToNext.position }}
                  components={{ 1: <strong />, 3: <strong /> }}
                />
              </Alert>
            )}

            {allPlayers.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={t('league.loadedCount', {
                      loaded: allPlayers.length,
                      total: totalCount,
                    })}
                    size="small"
                    sx={{ bgcolor: alpha(theme.palette.info.main, 0.08), color: 'text.primary' }}
                  />
                  <Chip
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TrophyIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                        <Trans i18nKey="league.topPromoLabel" values={{ count: PROMO_TOP }} components={{ 0: <span /> }} />
                      </Box>
                    }
                    size="small"
                    sx={{ bgcolor: alpha(theme.palette.success.main, 0.08), color: 'text.primary' }}
                  />
                  {isDefaultRankView && hasCompleteLeagueWindow && allPlayers.length > RELEG_BOTTOM * 2 && (
                    <Chip
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <ArrowDownIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                          <Trans i18nKey="league.bottomRelegLabel" values={{ count: RELEG_BOTTOM }} components={{ 0: <span /> }} />
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

            {isMdUp ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <FormControlLabel
                    control={<Switch checked={dense} onChange={(e) => setDense(e.target.checked)} size="small" />}
                     label={t('league.compact')}
                  />
                </Box>
                <TableContainer>
                  <Table size={dense ? 'small' : 'medium'} stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" sx={{ fontWeight: 700 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDirection : 'desc'} onClick={() => handleTableSort('name')}>
                            {t('commandPalette.player')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'experiencePoints'} direction={sortField === 'experiencePoints' ? sortDirection : 'desc'} onClick={() => handleTableSort('experiencePoints')}>
                            {t('league.sortXp')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'gamesPlayed'} direction={sortField === 'gamesPlayed' ? sortDirection : 'desc'} onClick={() => handleTableSort('gamesPlayed')}>
                            {t('league.sortGames')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'wins'} direction={sortField === 'wins' ? sortDirection : 'desc'} onClick={() => handleTableSort('wins')}>
                            V
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>E</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'losses'} direction={sortField === 'losses' ? sortDirection : 'desc'} onClick={() => handleTableSort('losses')}>
                            D
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'goals'} direction={sortField === 'goals' ? sortDirection : 'desc'} onClick={() => handleTableSort('goals')}>
                            GP
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>GC</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>SG</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'mvpCount'} direction={sortField === 'mvpCount' ? sortDirection : 'desc'} onClick={() => handleTableSort('mvpCount')}>
                            MVP
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          <TableSortLabel active={sortField === 'winRate'} direction={sortField === 'winRate' ? sortDirection : 'desc'} onClick={() => handleTableSort('winRate')}>
                            %
                          </TableSortLabel>
                        </TableCell>
                        {!!user && (
                          <TableCell align="right" sx={{ fontWeight: 700 }}>{t('common.actions')}</TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredAndSorted.map((player) => {
                        const position = (isDefaultRankView ? realPositions : displayPositions).get(player.id) ?? -1;
                        const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;
                        const lossCount = Math.max(0, player.gamesPlayed - player.wins);
                        return (
                          <TableRow
                            key={player.id}
                            hover
                            selected={player.isCurrentUser}
                            sx={player.isCurrentUser ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } : undefined}
                          >
                            <TableCell padding="checkbox">
                              <Tooltip title={getPositionTooltip(position)} arrow placement="top">
                                <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', ...getPositionStyle(position) }}>
                                  {position >= 1 && position <= 3 ? <TrophyIcon sx={{ fontSize: 14 }} /> : position > 0 ? position : '—'}
                                </Box>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PlayerAvatar name={player.userName} photoUrl={player.userPhoto} size={32} level={player.level} />
                                <Box sx={{ minWidth: 0 }}>
                                  <Button
                                    color="inherit"
                                    size="small"
                                    onClick={() => handleOpenActions(player)}
                                    sx={{
                                      minWidth: 0,
                                      p: 0,
                                      justifyContent: 'flex-start',
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      maxWidth: '100%',
                                    }}
                                  >
                                    <Typography variant="body2" fontWeight={600} noWrap>
                                      {player.userName}
                                    </Typography>
                                  </Button>
                                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <TeamBadge teamId={player.favoriteTeam} size={14} />
                                    <Chip label={DIVISION_CONFIG[player.division]?.label ?? player.division} size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
                                    {player.isCurrentUser && <Chip label="Você" size="small" color="primary" sx={{ height: 16, fontSize: '0.65rem' }} />}
                                  </Box>
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={700} color={getDivisionColor(player.division, theme)}>
                                {player.experiencePoints ?? 0}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{player.gamesPlayed}</TableCell>
                            <TableCell align="right">{player.wins}</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">{lossCount}</TableCell>
                            <TableCell align="right">{player.goals}</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">—</TableCell>
                            <TableCell align="right">{player.mvpCount || 0}</TableCell>
                            <TableCell align="right">{winRate}%</TableCell>
                            {!!user && (
                              <TableCell align="right">
                                {canInviteFromLeague(player) && (
                                  <Tooltip title={t('league.invitePlayer')} arrow>
                                    <IconButton
                                      size="small"
                                      aria-label={t('league.invitePlayerAria', { name: player.userName })}
                                      onClick={() => handleOpenInvite(player)}
                                      disabled={inviteSending}
                                    >
                                      <PersonAddIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {canMessageFromLeague(player) && (
                                  <Tooltip title={t('league.messagePlayer')} arrow>
                                    <IconButton
                                      size="small"
                                      aria-label={t('league.messagePlayerAria', { name: player.userName })}
                                      onClick={() => handleMessagePlayer(player)}
                                      disabled={creatingChat || messageTargetId === player.userId}
                                    >
                                      {messageTargetId === player.userId ? (
                                        <CircularProgress size={18} />
                                      ) : (
                                        <MessageIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <List disablePadding aria-label={t('league.standingsAria')}>
                {filteredAndSorted.map((player) => {
                  const position = (isDefaultRankView ? realPositions : displayPositions).get(player.id) ?? -1;
                  const isPromoZone = isDefaultRankView && position >= 1 && position <= PROMO_TOP;
                  const isRelegZone = isDefaultRankView &&
                    hasCompleteLeagueWindow &&
                    position > allPlayers.length - RELEG_BOTTOM &&
                    allPlayers.length > RELEG_BOTTOM * 2 &&
                    position > 0;
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
                      canInvite={canInviteFromLeague(player)}
                      inviteDisabled={inviteSending}
                      onInvite={handleOpenInvite}
                      canMessage={canMessageFromLeague(player)}
                      messageDisabled={creatingChat}
                      messageLoading={messageTargetId === player.userId}
                      onMessage={handleMessagePlayer}
                      onOpenActions={handleOpenActions}
                    />
                  );
                })}
              </List>
            )}

            {hasMore && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  startIcon={loadingMore ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {loadingMore ? t('common.loading') : t('league.loadMore')}
                </Button>
              </Box>
            )}
          </Box>
          </Fade>
        )}
      </PageContainer>
      </Box>
      </PullToRefresh>

      {/* #2178: ScreenFab padronizado — navega para posição do usuário */}
      {currentUserPlayer && !showSticky && (
        <ScreenFab
          icon={<MyLocationIcon />}
          aria-label={t('a11y.goToMyPosition')}
          onClick={scrollToMe}
          sx={{
            bottom: { xs: 80, md: 24 },
            right: { xs: 16, md: 24 },
            zIndex: 12,
          }}
        />
      )}

      <Snackbar
        open={shareSnack}
        autoHideDuration={3000}
        onClose={() => setShareSnack(false)}
        message={t('league.positionCopied', 'Posição copiada!')}
      />

      <Dialog
        open={!!actionTarget}
        onClose={handleCloseActions}
        fullWidth
        maxWidth="xs"
        aria-labelledby="league-player-actions-title"
      >
        <DialogTitle id="league-player-actions-title">
          {t('league.playerActionsTitle', { name: actionTarget?.userName ?? '' })}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
            <PlayerAvatar
              name={actionTarget?.userName || ''}
              photoUrl={actionTarget?.userPhoto}
              size={48}
              level={actionTarget?.level || 0}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {actionTarget?.userName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {actionTarget?.experiencePoints ?? 0} XP
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
            px: 3,
            pb: 2,
          }}
        >
          <Button onClick={handleCloseActions} disabled={creatingChat || inviteSending}>
            {t('common.cancel')}
          </Button>
          <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              variant="outlined"
              startIcon={messageTargetId === actionTarget?.userId ? <CircularProgress size={16} /> : <MessageIcon />}
              disabled={!actionTarget || !canMessageFromLeague(actionTarget) || creatingChat}
              onClick={() => actionTarget && handleMessagePlayer(actionTarget)}
            >
              {t('league.messagePlayer')}
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              disabled={!actionTarget || !canInviteFromLeague(actionTarget) || inviteSending}
              onClick={() => actionTarget && handleInviteFromActions(actionTarget)}
            >
              {t('league.invitePlayer')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!inviteTarget}
        onClose={handleCloseInvite}
        fullWidth
        maxWidth="sm"
        aria-labelledby="league-invite-dialog-title"
      >
        <DialogTitle id="league-invite-dialog-title">
          {t('league.inviteDialogTitle', { name: inviteTarget?.userName ?? '' })}
        </DialogTitle>
        <DialogContent>
          {inviteOptionsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : inviteOptionsError ? (
            <Alert severity="error">{inviteOptionsError}</Alert>
          ) : inviteOptions.length === 0 ? (
            <Alert severity="info">{t('league.noInviteOptions')}</Alert>
          ) : (
            <RadioGroup
              value={selectedInviteOptionId}
              onChange={(event) => setSelectedInviteOptionId(event.target.value)}
            >
              {inviteOptions.map((option) => (
                <FormControlLabel
                  key={option.id}
                  value={option.id}
                  control={<Radio />}
                  label={
                    <Box sx={{ py: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {option.type === 'group' ? t('league.inviteToGroup') : t('league.inviteToGame')}: {option.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.helper}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInvite} disabled={inviteSending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSendInvite}
            disabled={!selectedInviteOption || inviteSending}
            startIcon={inviteSending ? <CircularProgress size={16} /> : <PersonAddIcon />}
          >
            {t('league.sendInvite')}
          </Button>
        </DialogActions>
      </Dialog>

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
  canInvite,
  inviteDisabled,
  onInvite,
  canMessage,
  messageDisabled,
  messageLoading,
  onMessage,
  onOpenActions,
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
  canInvite: boolean;
  inviteDisabled: boolean;
  onInvite: (player: LeaguePlayer) => void;
  canMessage: boolean;
  messageDisabled: boolean;
  messageLoading: boolean;
  onMessage: (player: LeaguePlayer) => void;
  onOpenActions: (player: LeaguePlayer) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
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

  const handleInvite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onInvite(player);
  }, [onInvite, player]);

  const handleMessage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onMessage(player);
  }, [onMessage, player]);

  const handleOpenActions = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenActions(player);
  }, [onOpenActions, player]);

  return (
    <Card
      ref={cardRef}
      onClick={() => onToggleExpand(player.id)}
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={t('league.togglePlayerAria', { name: player.userName })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand(player.id);
        }
      }}
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
              <Button
                color="inherit"
                size="small"
                onClick={handleOpenActions}
                sx={{
                  minWidth: 0,
                  p: 0,
                  justifyContent: 'flex-start',
                  textTransform: 'none',
                  fontWeight: 700,
                }}
              >
                <Typography variant="subtitle1" fontWeight={600} noWrap>
                  {player.userName}
                </Typography>
              </Button>
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
              {player.experiencePoints ?? 0}
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

          {canInvite && (
            <Tooltip title={t('league.invitePlayer')} arrow>
              <IconButton
                onClick={handleInvite}
                aria-label={t('league.invitePlayerAria', { name: player.userName })}
                disabled={inviteDisabled}
              >
                <PersonAddIcon />
              </IconButton>
            </Tooltip>
          )}

          {canMessage && (
            <Tooltip title={t('league.messagePlayer')} arrow>
              <IconButton
                onClick={handleMessage}
                aria-label={t('league.messagePlayerAria', { name: player.userName })}
                disabled={messageDisabled}
              >
                {messageLoading ? <CircularProgress size={20} /> : <MessageIcon />}
              </IconButton>
            </Tooltip>
          )}

          <IconButton
            onClick={handleToggle}
            aria-label={t('league.togglePlayerAria', { name: player.userName })}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={isExpanded}>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, textAlign: 'center' }}>
            <StatBox label={t('league.victories')} value={player.wins} color={theme.palette.success.main} />
            <StatBox label={t('statistics.losses')} value={Math.max(0, player.gamesPlayed - player.wins)} color={theme.palette.error.main} />
            <StatBox label={t('statistics.winRate')} value={`${winRate}%`} color={theme.palette.primary.main} />
            <StatBox label={t('league.goals')} value={player.goals} color={theme.palette.warning.main} />
            <StatBox label={t('league.assists')} value={player.assists || 0} color={theme.palette.info.main} />
            <StatBox label={t('league.mvpCount')} value={player.mvpCount || 0} color={theme.palette.secondary.main} />
          </Box>
          {player.isCurrentUser && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
              {isPromoZone ? 'Você está na zona de promoção!' : isRelegZone ? 'Atenção: zona de rebaixamento' : 'Continue jogando para subir!'}
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
