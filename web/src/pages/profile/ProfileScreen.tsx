import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import { RatingEvolutionChart } from '../../components/profile/RatingEvolutionChart';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Alert,
  alpha,
  Paper,
  LinearProgress,
  CircularProgress,
  Avatar,
  Stack,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  MilitaryTech as MilitaryTechIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  BarChart as StatsIcon,
  WorkspacePremium as BadgeIcon,
  Security as ShieldIcon,
  DirectionsRun as RunnerIcon,
  SportsHandball as MidIcon,
  Sports as DefIcon,
  Groups as GroupsIcon,
  DeleteOutline as DeleteIcon,
  Handshake as HandshakeIcon,
  AccessTime as TimeIcon,
  TaskAlt as CommitmentIcon,
} from '@mui/icons-material';
import Grid from '@mui/material/Unstable_Grid2';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { usePlayerDetail } from '../../hooks/usePlayers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { PlayerAvatar } from '../../components/common/GameCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorScreen } from '../../components/common/ErrorScreen';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { TeamBadge } from '../../components/team/TeamBadge';
import { PageContainer } from '../../components/common/PageContainer';
import { DIVISION_CONFIG } from '../../types/gamification';
import { useTranslation } from 'react-i18next';
import { getEffectiveRating, type User } from '../../types/user';
import { isLookingForGameToday } from '../../utils/lookingForGameToday';
import { useFavoriteSquads } from '../../hooks/useFavoriteSquads';

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

export const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/?tab=4');
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.profile'));
  const queryClient = useQueryClient();

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'ProfileScreen' });

  const isOwnProfile = !userId || userId === currentUser?.id;
  const targetUserId = userId || currentUser?.id;

  const { player: profile, loading, error } = usePlayerDetail(targetUserId);
  const {
    squads: favoriteSquads,
    loading: favoriteSquadsLoading,
    error: favoriteSquadsError,
    deletingId: deletingFavoriteSquadId,
    deleteFavoriteSquad,
  } = useFavoriteSquads();
  const animatedLevel = useCountUp(profile?.level ?? 0);
  const animatedXp = useCountUp(profile?.xp ?? 0);
  const animatedMvps = useCountUp(profile?.mvpCount ?? 0);
  const lookingForGameToday = isLookingForGameToday(profile);

  if (loading) {
    return <LoadingScreen variant="cards" />;
  }

  if (error) {
    return (
      // #2178: ErrorScreen padronizado
      <ErrorScreen
        message={t('profile.loadError', { error })}
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['player', targetUserId] })}
        onBack={navigateBack}
        backLabel={t('common.back')}
      />
    );
  }

  if (!profile) {
    return (
      <PageContainer maxWidth="detail">
        <EmptyState
          icon={<PersonIcon sx={{ fontSize: 64 }} />}
          title={t('profile.notFound')}
          description={t('profile.notFoundDesc', 'O perfil que você procura não está disponível.')}
        />
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button startIcon={<BackIcon />} onClick={navigateBack}>
            {t('common.back')}
          </Button>
        </Box>
      </PageContainer>
    );
  }

  const divisionConfig = DIVISION_CONFIG[profile.division as keyof typeof DIVISION_CONFIG] || DIVISION_CONFIG.BRONZE;

  return (
    <Box>
      <ScreenHeader
        title={t('profile.title')}
        onBack={navigateBack}
        backAriaLabel={t('common.back')}
        actions={
          isOwnProfile ? (
            <IconButton onClick={() => navigate('/profile/edit')} aria-label={t('profile.editProfile')}>
              <EditIcon />
            </IconButton>
          ) : undefined
        }
      />

      <PageContainer maxWidth="detail">
        <Grid container spacing={2}>
          <Grid xs={12} md={8}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <PlayerAvatar
                    name={profile.name}
                    photoUrl={profile.photoUrl}
                    size={80}
                    level={profile.level}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography
                        variant="h5"
                        fontWeight={700}
                        sx={{
                          minWidth: 0,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {profile.name}
                      </Typography>
                      <Box sx={{ flexShrink: 0 }}>
                        <TeamBadge teamId={profile.favoriteTeam} size={24} />
                      </Box>
                    </Box>
                    {/* Chip da divisão: identidade via border + bg sutil, texto sempre legível (#1380)
                        Antes usava color: divisionConfig.color como foreground, mas SILVER (#C0C0C0)
                        sobre paper escuro dava contraste ~1.4:1 (WCAG fail). */}
                    <Chip
                      label={divisionConfig.label}
                      size="small"
                      variant="outlined"
                      sx={{
                        bgcolor: alpha(divisionConfig.color, 0.12),
                        color: 'text.primary',
                        borderColor: divisionConfig.color,
                        fontWeight: 600,
                        mt: 0.5,
                      }}
                    />
                    {lookingForGameToday && (
                      <Chip
                        label={t('profile.lookingForGameActive')}
                        size="small"
                        color="success"
                        sx={{ mt: 0.5, ml: 0.75 }}
                      />
                    )}
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid xs={6} sm={4} md={3} lg={3} xl={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="primary">
                        {animatedLevel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.level')}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6} sm={4} md={3} lg={3} xl={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="secondary">
                        {animatedXp}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.totalXp')}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid xs={6} sm={4} md={3} lg={3} xl={3}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {animatedMvps}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.mvps')}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t('profile.statistics')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid xs={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SoccerIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {t('profile.games')}
                        </Typography>
                        <Typography variant="h6">{profile.gamesPlayed}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrophyIcon color="action" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {t('profile.victories')}
                        </Typography>
                        <Typography variant="h6">{profile.wins}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SoccerIcon color="success" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {t('profile.goals')}
                        </Typography>
                        <Typography variant="h6">{profile.goals}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid xs={6} md={3}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TrendingIcon color="info" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {t('profile.assists')}
                        </Typography>
                        <Typography variant="h6">{profile.assists}</Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: 'success.main', color: 'success.contrastText' }}>
                    <HandshakeIcon />
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {t('profile.reputation.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('profile.reputation.description')}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={profile.reputationReviewsCount > 0 ? 'success' : 'default'}
                    label={t('profile.reputation.count', { count: profile.reputationReviewsCount })}
                  />
                </Stack>

                {profile.reputationReviewsCount > 0 ? (
                  <Grid container spacing={2}>
                    <Grid xs={12} sm={4}>
                      <Paper variant="outlined" sx={{ p: 1.5, height: '100%' }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('profile.reputation.overall')}
                        </Typography>
                        <Typography variant="h4" fontWeight={800} color="success.main">
                          {profile.reputationOverallAvg.toFixed(1)}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(profile.reputationOverallAvg / 5) * 100}
                          color="success"
                          sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                        />
                      </Paper>
                    </Grid>
                    <Grid xs={12} sm={8}>
                      <Stack spacing={1.25}>
                        {[
                          {
                            icon: <TimeIcon color="info" />,
                            label: t('profile.reputation.punctuality'),
                            value: profile.reputationPunctualityAvg,
                          },
                          {
                            icon: <ShieldIcon color="success" />,
                            label: t('profile.reputation.respect'),
                            value: profile.reputationRespectAvg,
                          },
                          {
                            icon: <CommitmentIcon color="primary" />,
                            label: t('profile.reputation.commitment'),
                            value: profile.reputationCommitmentAvg,
                          },
                        ].map((item) => (
                          <Stack direction="row" spacing={1} alignItems="center" key={item.label}>
                            {item.icon}
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2">{item.label}</Typography>
                              <LinearProgress
                                variant="determinate"
                                value={(item.value / 5) * 100}
                                sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                              />
                            </Box>
                            <Typography variant="body2" fontWeight={700}>
                              {item.value.toFixed(1)}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Grid>
                  </Grid>
                ) : (
                  <Alert severity="info">
                    {t('profile.reputation.empty')}
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  {t('profile.skillsByPosition')}
                </Typography>
                <Grid container spacing={2}>
                  {([
                    { role: 'STRIKER' as const, label: t('profile.positionForward'), icon: <RunnerIcon color="error" /> },
                    { role: 'MID' as const, label: t('profile.midfield'), icon: <MidIcon color="warning" /> },
                    { role: 'DEFENDER' as const, label: t('profile.positionDefender'), icon: <DefIcon color="info" /> },
                    { role: 'GOALKEEPER' as const, label: t('profile.positionGoalkeeper'), icon: <ShieldIcon color="success" /> },
                  ]).map(({ role, label, icon }) => {
                    const rating = getEffectiveRating(profile as unknown as User, role);
                    return (
                      <Grid xs={6} sm={6} md={3} lg={3} xl={3} key={role}>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            {icon}
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                          </Box>
                          <Typography variant="h6" fontWeight={700}>
                            {rating > 0 ? rating.toFixed(1) : '—'}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={rating > 0 ? (rating / 5) * 100 : 0}
                            sx={{ height: 6, borderRadius: 3, mt: 0.5 }}
                          />
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
                {profile.autoRatingSamples > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {t('profile.autoRatingBasedOn', { count: profile.autoRatingSamples })}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {profile.autoRatingSamples > 0 && (
              <RatingEvolutionChart userId={profile.id} />
            )}
          </Grid>

          {isOwnProfile && (
            <Grid xs={12} md={4}>
              <Card>
                {/* Ícones tintados com primary.main p/ consistência com AppSidebar
                    e melhor vibrância em ambos os modos (default action.active fica
                    apagado: rgba(0,0,0,.54) no light, rgba(255,255,255,.56) no dark). */}
                <List disablePadding aria-label={t('profile.menuOptions')}>
                  <ListItemButton onClick={() => navigate('/statistics')}>
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      <StatsIcon />
                    </ListItemIcon>
                    <ListItemText primary={t('profile.detailedStats')} />
                  </ListItemButton>
                  <Divider />
                  <ListItemButton onClick={() => navigate('/badges')}>
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      <BadgeIcon />
                    </ListItemIcon>
                    <ListItemText primary={t('profile.achievements')} />
                  </ListItemButton>
                  <Divider />
                  <ListItemButton onClick={() => navigate('/level-journey')}>
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      <MilitaryTechIcon />
                    </ListItemIcon>
                    <ListItemText primary={t('profile.levelJourney')} />
                  </ListItemButton>
                  <Divider />
                  <ListItemButton onClick={() => navigate('/settings')}>
                    <ListItemIcon sx={{ color: 'primary.main' }}>
                      <SettingsIcon />
                    </ListItemIcon>
                    <ListItemText primary={t('nav.settings')} />
                  </ListItemButton>
                </List>
              </Card>

              <Card sx={{ mt: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <GroupsIcon color="primary" />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {t('profile.favoriteSquads.title')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.favoriteSquads.description')}
                      </Typography>
                    </Box>
                  </Box>

                  {favoriteSquadsLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        {t('profile.favoriteSquads.loading')}
                      </Typography>
                    </Box>
                  ) : favoriteSquadsError ? (
                    <Alert severity="warning">{t('profile.favoriteSquads.loadError')}</Alert>
                  ) : favoriteSquads.length === 0 ? (
                    <Box sx={{ py: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('profile.favoriteSquads.empty')}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        {t('profile.favoriteSquads.emptyHint')}
                      </Typography>
                    </Box>
                  ) : (
                    <List disablePadding aria-label={t('profile.favoriteSquads.title')}>
                      {favoriteSquads.map((squad) => (
                        <ListItem
                          key={squad.id}
                          disablePadding
                          secondaryAction={
                            <IconButton
                              edge="end"
                              aria-label={t('profile.favoriteSquads.deleteAria', { name: squad.name })}
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteFavoriteSquad(squad.id);
                              }}
                              disabled={deletingFavoriteSquadId === squad.id}
                            >
                              {deletingFavoriteSquadId === squad.id ? <CircularProgress size={18} /> : <DeleteIcon />}
                            </IconButton>
                          }
                        >
                          <ListItemButton sx={{ borderRadius: 2, px: 1, pr: 6 }}>
                            <ListItemIcon sx={{ color: 'primary.main', minWidth: 36 }}>
                              <GroupsIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={squad.name}
                              secondary={squad.playerNames.join(' · ')}
                              primaryTypographyProps={{ fontWeight: 600 }}
                              secondaryTypographyProps={{ noWrap: true }}
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </PageContainer>

      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
};
