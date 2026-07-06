import Grid from '@mui/material/Unstable_Grid2';
import { PageContainer } from '../../components/common/PageContainer';
import { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGamificationColors } from '../../hooks/useGamificationColors';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Tabs,
  Tab,
  Skeleton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  SportsSoccer,
  MilitaryTech as MedalIcon,
  Whatshot as FireIcon,
  ShieldOutlined as ShieldIcon,
  StyleOutlined as CardIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useStatistics } from '../../hooks/useStatistics';
import { getLevelTitle, getLevelColor } from '../../types/user';
import { PlayerAvatar, EmptyState } from '../../components/common/GameCard';
import { ErrorState } from '../../components/common/ErrorState';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { AppBreadcrumbs } from '../../components/layout/AppBreadcrumbs';
import { TeamBadge } from '../../components/team/TeamBadge';
import { DonutChart } from '../../components/charts/DonutChart';

export const StatisticsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.statistics'));
  const navigate = useNavigate();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const { user } = useAuth();
  const { showError } = useToast();
  const navigateBack = useNavigateBack();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabValue = parseInt(searchParams.get('tab') || '0');

  const { stats, loading, error, retry } = useStatistics(user?.id);

  const memoizedStats = useMemo(() => {
    if (!stats) return null;
    const games = stats.totalGames || 0;
    const winRate = games > 0 ? ((stats.totalWins / games) * 100).toFixed(1) : '0';
    const drawRate = games > 0 ? ((stats.totalDraws / games) * 100).toFixed(1) : '0';
    const lossRate = games > 0 ? ((stats.totalLosses / games) * 100).toFixed(1) : '0';
    const goalsPerGame = games > 0 ? (stats.totalGoals / games).toFixed(2) : '0.0';
    const assistsPerGame = games > 0 ? (stats.totalAssists / games).toFixed(2) : '0.0';
    const maxStreak = Math.max(stats.currentStreak, stats.bestStreak, 1);
    const maxGa = Math.max(stats.totalGoals, stats.totalAssists, 1);
    return { games, winRate, drawRate, lossRate, goalsPerGame, assistsPerGame, maxStreak, maxGa };
  }, [stats]);

  const handleTabChange = (_: React.SyntheticEvent, v: number) => {
    setSearchParams({ tab: v.toString() });
  };

  useEffect(() => {
    if (error) showError(error);
  }, [error, showError]);

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.default',
          zIndex: 10,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5 }}>
          <IconButton onClick={navigateBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1 }}>
            {t('statistics.title')}
          </Typography>
        </Box>
        <Tabs
          value={tabValue > 2 ? 0 : tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label={t('statistics.title')}
        >
          <Tab label={t('statistics.tabs.general')} />
          <Tab label={t('statistics.tabs.goals')} />
          <Tab label={t('statistics.tabs.achievements')} />
        </Tabs>
      </Box>

      <PageContainer maxWidth="dashboard">
        <AppBreadcrumbs
          items={[
            { label: t('common.home'), to: '/' },
            { label: t('statistics.title') },
          ]}
        />

        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Skeleton variant="circular" width={64} height={64} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="40%" height={20} sx={{ mt: 0.5 }} />
                    <Skeleton variant="text" width="30%" height={20} sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Skeleton variant="text" width={100} height={24} />
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Skeleton variant="circular" width={120} height={120} />
                </Box>
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {[1, 2, 3, 4].map(i => (
                    <Grid xs={6} sm={4} md={3} lg={2} key={i}>
                      <Skeleton variant="text" width="100%" height={48} />
                      <Skeleton variant="text" width="60%" height={16} sx={{ mx: 'auto' }} />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Skeleton variant="text" width={120} height={24} />
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Skeleton variant="rectangular" width={40} height={40} sx={{ borderRadius: 1 }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="30%" height={32} />
                    <Skeleton variant="text" width="50%" height={16} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>
        ) : error && !stats ? (
          <ErrorState message={error} onRetry={retry} retryLabel={t('statistics.retry')} />
        ) : !stats ? (
          <EmptyState
            icon={<SportsSoccer sx={{ fontSize: 64, color: 'text.disabled' }} />}
            title={t('statistics.noStatsYet')}
            description={t('statistics.noStatsYetDesc')}
            action={{
              label: t('statistics.browseGames'),
              onClick: () => navigate('/?tab=1'),
            }}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PlayerAvatar
                    name={user?.name || t('profile.defaultPlayerName')}
                    photoUrl={user?.photoUrl}
                    size={64}
                    level={stats.level}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h5" fontWeight={700}>
                        {user?.name || t('profile.defaultPlayerName')}
                      </Typography>
                      <TeamBadge teamId={user?.favoriteTeam} size={24} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('statistics.level')} {stats.level} &bull; {getLevelTitle(stats.level)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      <TrophyIcon sx={{ fontSize: 16, color: getLevelColor(stats.level, theme) }} />
                      <Typography variant="caption" fontWeight={600}>
                        {stats.experiencePoints} XP
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {tabValue === 0 && memoizedStats && (
              <>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('statistics.totalGames')}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid xs={6} sm={4} md={3} lg={2}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" fontWeight={700} color="primary">
                            {stats.totalGames}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('statistics.total')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={6} sm={4} md={3} lg={2}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" fontWeight={700} color="success.main">
                            {stats.totalWins}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('statistics.wins')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={6} sm={4} md={3} lg={2}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" fontWeight={700} color="warning.main">
                            {stats.totalDraws}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('statistics.draws')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={6} sm={4} md={3} lg={2}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" fontWeight={700} color="error.main">
                            {stats.totalLosses}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('statistics.losses')}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <DonutChart
                      wins={stats.totalWins}
                      draws={stats.totalDraws}
                      losses={stats.totalLosses}
                      total={stats.totalGames}
                      noDataLabel={t('statistics.noStatsAvailable')}
                    />
                    <Box sx={{ mt: 1, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('statistics.winRate')}: <strong>{memoizedStats.winRate}%</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ mt: 1.5 }}>
                      <Box sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden', height: 8 }}>
                        <Box sx={{ width: `${memoizedStats.winRate}%`, bgcolor: 'success.main', transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                        <Box sx={{ width: `${memoizedStats.drawRate}%`, bgcolor: 'warning.main', transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                        <Box sx={{ width: `${memoizedStats.lossRate}%`, bgcolor: 'error.main', transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography variant="caption">V: {memoizedStats.winRate}%</Typography>
                        <Typography variant="caption">E: {memoizedStats.drawRate}%</Typography>
                        <Typography variant="caption">D: {memoizedStats.lossRate}%</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('statistics.streak')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: stats.currentStreak > 0
                            ? alpha(theme.palette.warning.main, 0.15)
                            : alpha(theme.palette.action.disabledBackground, 0.5),
                        }}
                      >
                        <FireIcon
                          sx={{
                            fontSize: 32,
                            color: stats.currentStreak > 0 ? theme.palette.warning.main : theme.palette.text.disabled,
                          }}
                        />
                      </Box>
                      <Box>
                        <Typography variant="h4" fontWeight={700}>
                          {stats.currentStreak} {t('statistics.totalGames').toLowerCase()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {t('statistics.currentStreak')} &bull; {t('statistics.bestStreak')}: {stats.bestStreak}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" sx={{ width: 70 }}>{t('statistics.currentStreak')}</Typography>
                        <Box sx={{ flex: 1, height: 12, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                          <Box sx={{ height: '100%', width: `${Math.min((stats.currentStreak / memoizedStats.maxStreak) * 100, 100)}%`, bgcolor: 'warning.main', borderRadius: 1, transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                        </Box>
                        <Typography variant="caption" sx={{ width: 30, textAlign: 'right' }}>{stats.currentStreak}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ width: 70 }}>{t('statistics.bestStreak')}</Typography>
                        <Box sx={{ flex: 1, height: 12, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                          <Box sx={{ height: '100%', width: `${Math.min((stats.bestStreak / memoizedStats.maxStreak) * 100, 100)}%`, bgcolor: 'success.main', borderRadius: 1, transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                        </Box>
                        <Typography variant="caption" sx={{ width: 30, textAlign: 'right' }}>{stats.bestStreak}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}

            {tabValue === 1 && memoizedStats && (
              <>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('statistics.goalsAndAssists')}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid xs={12} sm={6} md={4}>
                        <Box
                          sx={{
                            textAlign: 'center',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.primary.main, 0.06),
                          }}
                        >
                          <SportsSoccer sx={{ fontSize: 40, color: theme.palette.primary.main }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.totalGoals}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.goals')}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {memoizedStats.goalsPerGame} {t('statistics.perGame')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={12} sm={6} md={4}>
                        <Box
                          sx={{
                            textAlign: 'center',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.secondary.main, 0.06),
                          }}
                        >
                          <TrendingIcon sx={{ fontSize: 40, color: theme.palette.secondary.main }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.totalAssists}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.assists')}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {memoizedStats.assistsPerGame} {t('statistics.perGame')}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" sx={{ width: 100 }}>{t('statistics.goals')}</Typography>
                        <Box sx={{ flex: 1, height: 14, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                          <Box sx={{ height: '100%', width: `${(stats.totalGoals / memoizedStats.maxGa) * 100}%`, bgcolor: 'primary.main', borderRadius: 1, transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                        </Box>
                        <Typography variant="caption" fontWeight={600}>{stats.totalGoals}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ width: 100 }}>{t('statistics.assists')}</Typography>
                        <Box sx={{ flex: 1, height: 14, borderRadius: 1, overflow: 'hidden', bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
                          <Box sx={{ height: '100%', width: `${(stats.totalAssists / memoizedStats.maxGa) * 100}%`, bgcolor: 'secondary.main', borderRadius: 1, transition: (tm) => tm.transitions.create('width', { duration: 500 }) }} />
                        </Box>
                        <Typography variant="caption" fontWeight={600}>{stats.totalAssists}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>

                {stats.totalSaves > 0 && (
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                        {t('statistics.savesGoalkeeper')}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(theme.palette.info.main, 0.15),
                          }}
                        >
                          <ShieldIcon sx={{ fontSize: 32, color: 'info.main' }} />
                        </Box>
                        <Box>
                          <Typography variant="h3" fontWeight={700} color="info.main">
                            {stats.totalSaves}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.savesMade')}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {tabValue === 2 && (
              <>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('statistics.awards')}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid xs={12} sm={6} md={4}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(gColors.gold, 0.1), borderRadius: 2 }}>
                          <TrophyIcon sx={{ fontSize: 40, color: gColors.gold }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.mvpCount}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.mvp')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={12} sm={6} md={4}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: alpha(gColors.level, 0.1), borderRadius: 2 }}>
                          <MedalIcon sx={{ fontSize: 40, color: gColors.level }} />
                          <Typography variant="h4" fontWeight={700}>
                            {stats.bestGkCount || 0}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.bestGoalkeeper')}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      {t('statistics.cards')}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid xs={12} sm={6} md={4}>
                        <Box
                          sx={{
                            textAlign: 'center',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.warning.main, 0.08),
                          }}
                        >
                          <CardIcon sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
                          <Typography variant="h4" fontWeight={700} color="warning.main">
                            {stats.yellowCards}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.yellow')}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={12} sm={6} md={4}>
                        <Box
                          sx={{
                            textAlign: 'center',
                            p: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                          }}
                        >
                          <CardIcon sx={{ fontSize: 32, color: 'error.main', mb: 1 }} />
                          <Typography variant="h4" fontWeight={700} color="error.main">
                            {stats.redCards}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('statistics.red')}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </>
            )}
          </Box>
        )}
      </PageContainer>
    </Box>
  );
};
