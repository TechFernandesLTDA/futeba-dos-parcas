import Grid from '@mui/material/Unstable_Grid2';
import { PageContainer } from '../../components/common/PageContainer';
import React, { useState, useCallback } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Alert,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  useTheme,
  alpha,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  Compare as CompareIcon,
  SportsSoccer as SoccerIcon,
  TrendingUp as TrendingIcon,
  EmojiEvents as TrophyIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useQuery } from '@tanstack/react-query';
import { useHeadToHead, HeadToHeadMatch } from '../../hooks/useHeadToHead';
import type { HeadToHeadPeriod } from '../../utils/headToHeadPeriod';
import { PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { TeamBadge } from '../../components/team/TeamBadge';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { buildFriendlyComparisonSummary, type FriendlyComparisonLabels } from '../../utils/friendlyComparison';
import { getEffectiveLevel } from '../../utils/xpAccounting';

const logger = createLogger('HeadToHeadScreen');

interface PlayerSearchResult {
  id: string;
  name: string;
  photoUrl?: string;
  favoriteTeam?: string;
  level: number;
}

async function searchPlayers(term: string): Promise<PlayerSearchResult[]> {
  if (term.trim().length < 2) return [];
  const q = query(
    collection(db, 'users'),
    where('name_lower', '>=', term.toLowerCase()),
    where('name_lower', '<=', term.toLowerCase() + '\uf8ff'),
    where('is_searchable', '==', true),
    orderBy('name_lower'),
    limit(10)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map((doc) => {
      const raw = doc.data();
      const data = snakeToCamel(raw) as Record<string, unknown>;
      return {
        id: doc.id,
        name: (data.name as string) || 'Jogador',
        photoUrl: (data.photoUrl as string) || (raw.photo_url as string) || undefined,
        favoriteTeam: (data.favoriteTeam as string) || (raw.favorite_team as string) || undefined,
        level: getEffectiveLevel({ ...raw, ...data }),
      };
    });
  } catch (err) {
    logger.error('Error searching players:', err);
    throw err;
  }
}

export const HeadToHeadScreen: React.FC = () => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  useDocumentTitle(t('page.title.headToHead'));
  const goBack = useNavigateBack();
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectingPlayer, setSelectingPlayer] = useState<1 | 2 | null>(null);
  const [player1, setPlayer1] = useState<PlayerSearchResult | null>(null);
  const [player2, setPlayer2] = useState<PlayerSearchResult | null>(null);
  const [period, setPeriod] = useState<HeadToHeadPeriod>('all');

  const { data: searchResults = [], isLoading: searching } = useQuery({
    queryKey: ['playerSearch', searchTerm],
    queryFn: () => searchPlayers(searchTerm),
    enabled: searchTerm.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const { stats, loading, error } = useHeadToHead(player1?.id, player2?.id, period);

  const handleSelectPlayer = useCallback(
    (player: PlayerSearchResult) => {
      if (selectingPlayer === 1) {
        setPlayer1(player);
      } else if (selectingPlayer === 2) {
        setPlayer2(player);
      }
      setSelectingPlayer(null);
      setSearchTerm('');
    },
    [selectingPlayer]
  );

  const handleClearPlayer = useCallback(
    (which: 1 | 2) => {
      if (which === 1) setPlayer1(null);
      else setPlayer2(null);
    },
    []
  );

  const canCompare = !!player1 && !!player2 && player1.id !== player2.id;
  const friendlyLabels: FriendlyComparisonLabels = {
    title: t('headToHead.friendly.title'),
    games: t('headToHead.games'),
    opponents: t('headToHead.opponents'),
    sameTeam: t('headToHead.sameTeam'),
    goals: t('headToHead.goals'),
    assists: t('headToHead.assists'),
    mvp: 'MVP',
    directWins: t('headToHead.friendly.directWins'),
    draws: t('headToHead.friendly.draws'),
    together: t('headToHead.friendly.together'),
    balancedHeadline: t('headToHead.friendly.balancedHeadline'),
    winsHeadline: (playerName) => t('headToHead.friendly.winsHeadline', { player: playerName }),
    goalsHeadline: (playerName) => t('headToHead.friendly.goalsHeadline', { player: playerName }),
  };
  const friendlyComparison =
    player1 && player2 && stats
      ? buildFriendlyComparisonSummary(player1.name, player2.name, stats, friendlyLabels)
      : null;

  const handleShareFriendlyComparison = useCallback(async () => {
    if (!friendlyComparison) return;

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: t('headToHead.friendly.shareTitle'),
          text: friendlyComparison.shareText,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(friendlyComparison.shareText);
      showSuccess(t('headToHead.friendly.copySuccess'));
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(friendlyComparison.shareText);
        showSuccess(t('headToHead.friendly.copySuccess'));
      } catch {
        showError(t('headToHead.friendly.shareError'));
      }
    }
  }, [friendlyComparison, showError, showSuccess, t]);

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.default',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton
            onClick={goBack}
            aria-label={t('a11y.back')}
          >
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1 }}>
            {t('headToHead.title')}
          </Typography>
        </Box>
      </Box>

      <PageContainer maxWidth="dashboard">
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              {t('headToHead.selectPlayers')}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid xs={5}>
                <PlayerSlot
                  label={t('headToHead.playerOne')}
                  player={player1}
                  onSelect={() => setSelectingPlayer(1)}
                  onClear={() => handleClearPlayer(1)}
                />
              </Grid>
              <Grid xs={2} sx={{ textAlign: 'center' }}>
                <CompareIcon sx={{ fontSize: 32, color: 'text.disabled' }} />
                <Typography variant="caption" display="block" color="text.secondary">
                  VS
                </Typography>
              </Grid>
              <Grid xs={5}>
                <PlayerSlot
                  label={t('headToHead.playerTwo')}
                  player={player2}
                  onSelect={() => setSelectingPlayer(2)}
                  onClear={() => handleClearPlayer(2)}
                />
              </Grid>
            </Grid>
            {player1 && player2 && player1.id === player2.id && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {t('headToHead.selectDifferentPlayers')}
              </Alert>
            )}
            <FormControl size="small" fullWidth sx={{ mt: 2 }}>
              <InputLabel id="head-to-head-period-label">{t('headToHead.period.label')}</InputLabel>
              <Select
                labelId="head-to-head-period-label"
                label={t('headToHead.period.label')}
                value={period}
                onChange={(event) => setPeriod(event.target.value as HeadToHeadPeriod)}
                disabled={loading}
              >
                <MenuItem value="all">{t('headToHead.period.all')}</MenuItem>
                <MenuItem value="30d">{t('headToHead.period.last30Days')}</MenuItem>
                <MenuItem value="90d">{t('headToHead.period.last90Days')}</MenuItem>
                <MenuItem value="365d">{t('headToHead.period.last365Days')}</MenuItem>
              </Select>
            </FormControl>
          </CardContent>
        </Card>

        {selectingPlayer && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                {t('headToHead.searchPlayer', { number: selectingPlayer })}
              </Typography>
              <TextField
                aria-label={t('a11y.searchPlayer')}
                size="small"
                fullWidth
                placeholder={t('placeholder.enterPlayerName')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                inputProps={{ maxLength: 200 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: searching ? (
                    <InputAdornment position="end">
                      <CircularProgress size={16} />
                    </InputAdornment>
                  ) : searchTerm ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchTerm('')} aria-label={t('a11y.clearSearch')} sx={{ minWidth: 44, minHeight: 44 }}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              {searchResults.length > 0 && (
                <List disablePadding sx={{ mt: 1 }}>
                  {searchResults.map((p) => (
                    <ListItemButton
                      key={p.id}
                      onClick={() => handleSelectPlayer(p)}
                      disabled={
                        (selectingPlayer === 1 && player2?.id === p.id) ||
                        (selectingPlayer === 2 && player1?.id === p.id)
                      }
                    >
                      <ListItemAvatar>
                        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} size={40} level={p.level} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              {p.name}
                            </Typography>
                            <TeamBadge teamId={p.favoriteTeam} size={18} />
                          </Box>
                        }
                        secondary={`Nível ${p.level}`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
              {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
                  {t('headToHead.noPlayersFound')}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {canCompare && !loading && !error && !stats && (
          <EmptyState
            icon={<SoccerIcon />}
            title={t('empty.selectTwoPlayers')}
            description={t('empty.selectTwoPlayersDesc')}
          />
        )}

        {canCompare && loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {canCompare && error && (
          <ErrorState message={error} />
        )}

        {canCompare && stats && stats.totalGames === 0 && (
          <EmptyState
            icon={<SoccerIcon />}
            title={t('empty.noCommonGames')}
            description={t('empty.noCommonGamesDesc')}
          />
        )}

        {canCompare && stats && stats.totalGames > 0 && player1 && player2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {friendlyComparison && (
              <Card
                sx={{
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.success.main, 0.1)})`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                      <Box>
                        <Typography variant="overline" color="primary.main" fontWeight={700}>
                          {t('headToHead.friendly.eyebrow')}
                        </Typography>
                        <Typography variant="h6" fontWeight={800}>
                          {friendlyComparison.headline}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {t('headToHead.friendly.subtitle')}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        startIcon={<ShareIcon />}
                        onClick={handleShareFriendlyComparison}
                        sx={{ flexShrink: 0, textTransform: 'none' }}
                      >
                        {t('headToHead.friendly.share')}
                      </Button>
                    </Box>

                    <Grid container spacing={2} alignItems="stretch">
                      <Grid xs={12} md={5}>
                        <FriendlyPlayerPanel
                          name={friendlyComparison.playerOne.name}
                          wins={friendlyComparison.playerOne.wins}
                          goals={friendlyComparison.playerOne.goals}
                          assists={friendlyComparison.playerOne.assists}
                          mvp={friendlyComparison.playerOne.mvp}
                        />
                      </Grid>
                      <Grid xs={12} md={2}>
                        <Box
                          sx={{
                            height: '100%',
                            minHeight: 72,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.background.paper, 0.7),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                          }}
                        >
                          <Typography variant="h6" fontWeight={800}>
                            {stats.p1WinsAgainst} x {stats.p2WinsAgainst}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('headToHead.friendly.directWins')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={12} md={5}>
                        <FriendlyPlayerPanel
                          name={friendlyComparison.playerTwo.name}
                          wins={friendlyComparison.playerTwo.wins}
                          goals={friendlyComparison.playerTwo.goals}
                          assists={friendlyComparison.playerTwo.assists}
                          mvp={friendlyComparison.playerTwo.mvp}
                        />
                      </Grid>
                    </Grid>
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('headToHead.summary')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="primary">
                        {stats.totalGames}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('headToHead.games')}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="error.main">
                        {stats.gamesAgainst}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('headToHead.opponents')}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid xs={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="success.main">
                        {stats.gamesTogether}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('headToHead.sameTeam')}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {stats.gamesAgainst > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    {t('headToHead.directMatches')}
                  </Typography>
                  <Grid container spacing={2} alignItems="center">
                    <Grid xs={5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {stats.p1WinsAgainst}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {player1.name}
                      </Typography>
                    </Grid>
                    <Grid xs={2} sx={{ textAlign: 'center' }}>
                      <Chip
                        label={`${stats.drawsAgainst}E`}
                        size="small"
                        sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'text.primary' }}
                      />
                    </Grid>
                    <Grid xs={5} sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={700} color="success.main">
                        {stats.p2WinsAgainst}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {player2.name}
                      </Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', height: 8 }}>
                      <Box
                        sx={{
                          width: `${stats.gamesAgainst > 0 ? (stats.p1WinsAgainst / stats.gamesAgainst) * 100 : 0}%`,
                          bgcolor: 'success.main',
                        }}
                      />
                      <Box
                        sx={{
                          width: `${stats.gamesAgainst > 0 ? (stats.drawsAgainst / stats.gamesAgainst) * 100 : 0}%`,
                          bgcolor: 'warning.main',
                        }}
                      />
                      <Box
                        sx={{
                          width: `${stats.gamesAgainst > 0 ? (stats.p2WinsAgainst / stats.gamesAgainst) * 100 : 0}%`,
                          bgcolor: 'error.main',
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                      <Typography variant="caption">{stats.p1WinRate}%</Typography>
                      <Typography variant="caption">{stats.p2WinRate}%</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('headToHead.statistics')}
                </Typography>
                <Grid container spacing={2}>
                  <StatCompareRow
                    label={t('headToHead.goals')}
                    p1Value={stats.p1TotalGoals}
                    p2Value={stats.p2TotalGoals}
                    icon={<SoccerIcon sx={{ color: theme.palette.primary.main }} />}
                  />
                  <StatCompareRow
                    label={t('headToHead.assists')}
                    p1Value={stats.p1TotalAssists}
                    p2Value={stats.p2TotalAssists}
                    icon={<TrendingIcon sx={{ color: theme.palette.secondary.main }} />}
                  />
                  <StatCompareRow
                    label="MVP"
                    p1Value={stats.p1MvpCount}
                    p2Value={stats.p2MvpCount}
                    icon={<TrophyIcon sx={{ color: theme.palette.warning.main }} />}
                  />
                  <StatCompareRow
                    label={t('headToHead.avgGoalsPerGame')}
                    p1Value={stats.totalGames > 0 ? (stats.p1TotalGoals / stats.totalGames).toFixed(1) : '0.0'}
                    p2Value={stats.totalGames > 0 ? (stats.p2TotalGoals / stats.totalGames).toFixed(1) : '0.0'}
                  />
                  <StatCompareRow
                    label={t('headToHead.avgAssistsPerGame')}
                    p1Value={stats.totalGames > 0 ? (stats.p1TotalAssists / stats.totalGames).toFixed(1) : '0.0'}
                    p2Value={stats.totalGames > 0 ? (stats.p2TotalAssists / stats.totalGames).toFixed(1) : '0.0'}
                  />
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  {t('headToHead.matchHistory')}
                </Typography>
                {stats.matches.map((match, idx) => (
                  <React.Fragment key={match.gameId}>
                    <MatchTimelineItem match={match} player1Name={player1.name} player2Name={player2.name} />
                    {idx < stats.matches.length - 1 && <Divider sx={{ my: 1 }} />}
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          </Box>
        )}
      </PageContainer>
    </Box>
  );
};

const PlayerSlot: React.FC<{
  label: string;
  player: PlayerSearchResult | null;
  onSelect: () => void;
  onClear: () => void;
}> = ({ label, player, onSelect, onClear }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  if (player) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} size={56} level={player.level} />
        <Typography variant="body2" fontWeight={600} noWrap sx={{ mt: 0.5 }}>
          {player.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 0.5 }}>
          <Button size="small" variant="outlined" onClick={onSelect} sx={{ fontSize: theme.typography.caption.fontSize, textTransform: 'none', minHeight: 44 }}>
            Trocar
          </Button>
          <IconButton onClick={onClear} aria-label={t('a11y.remove')}>
            <CloseIcon sx={{ fontSize: theme.typography.caption.fontSize }} />
          </IconButton>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: 'center' }}>
      <Box
        onClick={onSelect}
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: `2px dashed ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          cursor: 'pointer',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        <SearchIcon sx={{ color: 'text.disabled' }} />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {label}
      </Typography>
    </Box>
  );
};

const StatCompareRow: React.FC<{
  label: string;
  p1Value: number | string;
  p2Value: number | string;
  icon?: React.ReactNode;
}> = ({ label, p1Value, p2Value, icon }) => {
  const p1Num = typeof p1Value === 'number' ? p1Value : parseFloat(p1Value);
  const p2Num = typeof p2Value === 'number' ? p2Value : parseFloat(p2Value);
  const p1Highlight = p1Num > p2Num;
  const p2Highlight = p2Num > p1Num;

  return (
    <Grid xs={12}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography
          variant="body2"
          fontWeight={p1Highlight ? 700 : 400}
          color={p1Highlight ? 'primary.main' : 'text.primary'}
          sx={{ width: 40, textAlign: 'right' }}
        >
          {p1Value}
        </Typography>
        {icon && <Box sx={{ fontSize: 16 }}>{icon}</Box>}
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center' }}>
          {label}
        </Typography>
        <Typography
          variant="body2"
          fontWeight={p2Highlight ? 700 : 400}
          color={p2Highlight ? 'primary.main' : 'text.primary'}
          sx={{ width: 40, textAlign: 'left' }}
        >
          {p2Value}
        </Typography>
      </Box>
    </Grid>
  );
};

const FriendlyPlayerPanel: React.FC<{
  name: string;
  wins: number;
  goals: number;
  assists: number;
  mvp: number;
}> = ({ name, wins, goals, assists, mvp }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box
      sx={{
        height: '100%',
        borderRadius: 2,
        bgcolor: alpha(theme.palette.background.paper, 0.72),
        p: 2,
      }}
    >
      <Typography variant="subtitle2" fontWeight={800} noWrap>
        {name}
      </Typography>
      <Grid container spacing={1} sx={{ mt: 1 }}>
        <Grid xs={6}>
          <FriendlyMetric label={t('headToHead.friendly.directWins')} value={wins} />
        </Grid>
        <Grid xs={6}>
          <FriendlyMetric label={t('headToHead.goals')} value={goals} />
        </Grid>
        <Grid xs={6}>
          <FriendlyMetric label={t('headToHead.assists')} value={assists} />
        </Grid>
        <Grid xs={6}>
          <FriendlyMetric label="MVP" value={mvp} />
        </Grid>
      </Grid>
    </Box>
  );
};

const FriendlyMetric: React.FC<{
  label: string;
  value: number;
}> = ({ label, value }) => (
  <Box>
    <Typography variant="h6" fontWeight={800} color="primary.main" lineHeight={1}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Box>
);

const MatchTimelineItem: React.FC<{
  match: HeadToHeadMatch;
  player1Name: string;
  player2Name: string;
}> = ({ match, player1Name, player2Name }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const resultColor = match.draw
    ? theme.palette.warning.main
    : match.p1Won
    ? theme.palette.success.main
    : match.p2Won
    ? theme.palette.error.main
    : theme.palette.text.secondary;
  const resultLabel = match.draw
    ? t('headToHead.draw')
    : match.p1Won
    ? t('headToHead.playerWon', { player: player1Name })
    : t('headToHead.playerWon', { player: player2Name });

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Chip
            label={match.sameTeam ? t('headToHead.sameTeam') : t('headToHead.opponents')}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.75rem',
              bgcolor: match.sameTeam
                ? alpha(theme.palette.success.main, 0.1)
                : alpha(theme.palette.error.main, 0.1),
              color: 'text.primary',
            }}
          />
          {match.groupName && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {match.groupName}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {match.date} • {match.team1Name} {match.team1Score} x {match.team2Score} {match.team2Name}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography variant="caption" fontWeight={600} sx={{ color: resultColor }}>
          {resultLabel}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Typography variant="caption" color="text.secondary">
            {player1Name}: {match.p1Goals}{t('headToHead.goalAbbr')} {match.p1Assists}{t('headToHead.assistAbbr')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {player2Name}: {match.p2Goals}{t('headToHead.goalAbbr')} {match.p2Assists}{t('headToHead.assistAbbr')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
