import { useNavigate, useParams } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  alpha,
  Grid,
  Paper,
  LinearProgress,
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
  Refresh as RefreshIcon,
  Security as ShieldIcon,
  DirectionsRun as RunnerIcon,
  SportsHandball as MidIcon,
  Sports as DefIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { usePlayerDetail } from '../../hooks/usePlayers';
import { PlayerAvatar } from '../../components/common/GameCard';
import { TeamBadge } from '../../components/team/TeamBadge';
import { DIVISION_CONFIG } from '../../types/gamification';
import { useTranslation } from 'react-i18next';
import { getEffectiveRating } from '../../types/user';

export const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'ProfileScreen' });

  const isOwnProfile = !userId || userId === currentUser?.id;
  const targetUserId = userId || currentUser?.id;

  const { player: profile, loading, error } = usePlayerDetail(targetUserId);

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {/* Header skeleton */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" width={100} height={32} />
        </Box>

        {/* Profile card skeleton */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Skeleton variant="circular" width={80} height={80} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={36} />
                <Skeleton variant="text" width="30%" height={24} />
              </Box>
            </Box>
            <Grid container spacing={2}>
              {[0, 1, 2].map((i) => (
                <Grid item key={i} xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Skeleton variant="text" width="50%" height={32} sx={{ mx: 'auto' }} />
                    <Skeleton variant="text" width="60%" height={16} sx={{ mx: 'auto' }} />
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Stats card skeleton */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1.5 }} />
            <Grid container spacing={2}>
              {[0, 1, 2, 3].map((i) => (
                <Grid item key={i} xs={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton variant="text" width="50%" height={20} />
                      <Skeleton variant="text" width="30%" height={28} />
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Options list skeleton */}
        <Card>
          <Box sx={{ p: 2 }}>
            {[0, 1, 2, 3].map((i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="text" width={`${60 - i * 10}%`} height={24} />
              </Box>
            ))}
          </Box>
        </Card>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => queryClient.invalidateQueries()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('profile.loadError', { error })}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={navigateBack} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {t('profile.notFound')}
          </Typography>
        </Box>
        <Button startIcon={<BackIcon />} onClick={navigateBack} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </Container>
    );
  }

  const divisionConfig = DIVISION_CONFIG[profile.division as keyof typeof DIVISION_CONFIG] || DIVISION_CONFIG.BRONZE;

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
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={navigateBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ ml: 1, flex: 1 }}>
            {t('profile.title')}
          </Typography>
          {isOwnProfile && (
            <IconButton onClick={() => navigate('/profile/edit')} aria-label={t('profile.editProfile')}>
              <EditIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <Container maxWidth={isMd ? 'lg' : 'sm'} sx={{ py: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <PlayerAvatar
                    name={profile.name}
                    photoUrl={profile.photoUrl}
                    size={80}
                    level={profile.level}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="h5" fontWeight={700}>
                        {profile.name}
                      </Typography>
                      <TeamBadge teamId={profile.favoriteTeam} size={24} />
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
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="primary">
                        {profile.level}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.level')}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="secondary">
                        {profile.xp}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('profile.totalXp')}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                      <Typography variant="h5" fontWeight={700} color="warning.main">
                        {profile.mvpCount}
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
                  <Grid item xs={6} md={3}>
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
                  <Grid item xs={6} md={3}>
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
                  <Grid item xs={6} md={3}>
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
                  <Grid item xs={6} md={3}>
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
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                  Habilidades por Posição
                </Typography>
                <Grid container spacing={2}>
                  {([
                    { role: 'STRIKER' as const, label: 'Atacante', icon: <RunnerIcon color="error" /> },
                    { role: 'MID' as const, label: 'Meio-campo', icon: <MidIcon color="warning" /> },
                    { role: 'DEFENDER' as const, label: 'Zagueiro', icon: <DefIcon color="info" /> },
                    { role: 'GOALKEEPER' as const, label: 'Goleiro', icon: <ShieldIcon color="success" /> },
                  ]).map(({ role, label, icon }) => {
                    const rating = getEffectiveRating(profile as any, role);
                    return (
                      <Grid item xs={6} md={3} key={role}>
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
                    Baseado em {profile.autoRatingSamples} jogo(s) avaliado(s) automaticamente
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {isOwnProfile && (
            <Grid item xs={12} md={7}>
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
            </Grid>
          )}
        </Grid>
      </Container>

      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
};
