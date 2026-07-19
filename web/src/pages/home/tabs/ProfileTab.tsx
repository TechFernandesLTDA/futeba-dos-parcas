import { PageContainer } from '../../../components/common/PageContainer';
import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Avatar,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
  useMediaQuery,
  alpha,
  Skeleton,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  EmojiEvents,
  MilitaryTech,
  LocalFireDepartment,
  Settings,
  Edit,
  Logout,
  SportsSoccer,
  TrendingUp,
  Timeline,
  Star,
  Shield,
  DirectionsRun,
  SportsKabaddi,
  ChevronRight,
  AdminPanelSettings,
  Stadium,
  BugReport,
  Dashboard,
} from '@mui/icons-material';
import { getLevelColor } from '../../../types/user';
import { getLevelBadgeImage, getLevelBadgeDescription, handleBadgeImageError } from '../../../utils/levelBadge';
import { getLocationsPath } from '../../../config/navItems';
import { getXpProgress, getLevelEntry } from '../../../types/gamification';
import { getEffectiveLevel, getExperiencePoints } from '../../../utils/xpAccounting';
import { useGamificationColors } from '../../../hooks/useGamificationColors';
import { iconSizes } from '../../../theme/iconSizes';
import { pageSpacing } from '../../../theme/pageTokens';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../contexts/ToastContext';
import { createLogger } from '../../../utils/logger';
import { useDocumentTitle } from '../../../hooks/useDocumentTitle';
import { TeamBadge } from '../../../components/team/TeamBadge';
import { useLookingForGameToday } from '../../../hooks/useLookingForGameToday';
import { isLookingForGameToday } from '../../../utils/lookingForGameToday';
import { useBadges } from '../../../hooks/useBadges';
import { getNearBadgeInsights, getNearLevelInsight } from '../../../utils/gamificationInsights';

const logger = createLogger('ProfileTab');

// #2272: função pura movida para fora do componente — não precisa ser recriada
// a cada render.
function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function ProfileTab() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.profile'));
  const { user, firebaseUser, logout, loading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const gColors = useGamificationColors();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { showError, showSuccess } = useToast();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { setLookingForGameToday, loading: lookingForGameLoading } = useLookingForGameToday(firebaseUser?.uid);
  const lookingForGameToday = isLookingForGameToday(user);
  const { unlockedIds } = useBadges(user?.id);

  // Calcular progresso usando LevelTable (fonte única de verdade)
  const xpData = (user ?? {}) as unknown as Record<string, unknown>;
  const currentXp = getExperiencePoints(xpData);
  const currentLevel = getEffectiveLevel(xpData, currentXp);
  const levelProgress = getXpProgress(currentXp) * 100;
  const currentEntry = getLevelEntry(currentLevel);
  const nextEntry = currentLevel < 20 ? getLevelEntry(currentLevel + 1) : null;
  const xpInLevel = currentXp - currentEntry.xpRequired;
  const xpNeededForNext = nextEntry ? nextEntry.xpRequired - currentEntry.xpRequired : 0;
  const levelColor = getLevelColor(currentLevel, theme);
  const isDarkTheme = theme.palette.mode === 'dark';
  const profileHeaderBackground = isDarkTheme
    ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
    : `linear-gradient(135deg, ${theme.palette.surfaceBright} 0%, ${alpha(theme.palette.primary.light, 0.2)} 55%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`;
  const profileHeaderTextColor = isDarkTheme
    ? theme.palette.primary.contrastText
    : theme.palette.text.primary;
  const profileHeaderMutedColor = isDarkTheme
    ? alpha(theme.palette.primary.contrastText, 0.85)
    : theme.palette.text.secondary;
  const profileLevelCardBg = isDarkTheme
    ? alpha(theme.palette.common.white, 0.15)
    : alpha(theme.palette.background.paper, 0.82);
  const profileLevelCardBorder = isDarkTheme
    ? alpha(theme.palette.common.white, 0.25)
    : alpha(theme.palette.primary.main, 0.16);
  const nearLevelInsight = getNearLevelInsight(currentXp);
  const nearBadgeInsights = getNearBadgeInsights(user as unknown as Record<string, unknown>, unlockedIds);

  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      setAnimatedProgress(levelProgress);
    });
    return () => cancelAnimationFrame(timer);
  }, [levelProgress]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      logger.error('Erro ao sair:', error);
      showError(t('profile.signOutError'));
    }
  };

  const handleLookingForGameToggle = async () => {
    const nextValue = !lookingForGameToday;
    try {
      await setLookingForGameToday(nextValue);
      await refreshUser();
      showSuccess(t(nextValue ? 'profile.lookingForGameEnabled' : 'profile.lookingForGameDisabled'));
    } catch (error) {
      logger.error('Erro ao atualizar disponibilidade de jogo:', error);
      showError(t('profile.lookingForGameError'));
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isFieldOwner = user?.role === 'FIELD_OWNER';

  // Inclui a descoberta pública de quadras para PLAYER no mobile; donos e
  // admins recebem a mesma entrada, apontando para a gestão (#3737).
  const menuItems = useMemo(() => [
    { icon: <Timeline />, label: t('profile.starRoad'), onClick: () => navigate('/level-journey') },
    { icon: <MilitaryTech />, label: t('profile.badges'), onClick: () => navigate('/badges') },
    { icon: <TrendingUp />, label: t('profile.statistics'), onClick: () => navigate('/statistics') },
    {
      icon: <Stadium />,
      label: isAdmin || isFieldOwner ? t('profile.adminMenu.manageFields') : t('nav.locations'),
      onClick: () => navigate(getLocationsPath(user?.role)),
    },
    { icon: <Settings />, label: t('profile.settings'), onClick: () => navigate('/settings') },
  ], [isAdmin, isFieldOwner, navigate, t, user?.role]);

  // Memoizado: recriado apenas quando role do usuário muda
  const adminMenuItems = useMemo<Array<{ icon: React.ReactNode; label: string; onClick: () => void }>>(() => {
    const items: Array<{ icon: React.ReactNode; label: string; onClick: () => void }> = [];
    if (isFieldOwner) {
      items.push({
        icon: <Dashboard />,
        label: t('profile.adminMenu.ownerDashboard'),
        onClick: () => navigate('/owner/dashboard'),
      });
    }
    if (isAdmin) {
      items.push({
        icon: <AdminPanelSettings />,
        label: t('profile.manageUsers'),
        onClick: () => navigate('/admin/users'),
      });
      items.push({
        icon: <BugReport />,
        label: t('profile.adminMenu.feedbackOperations'),
        onClick: () => navigate('/admin/feedback'),
      });
      items.push({
        icon: <EmojiEvents />,
        label: t('profile.adminMenu.gameReview'),
        onClick: () => navigate('/admin/game-reviews'),
      });
      items.push({
        icon: <EmojiEvents />,
        label: t('profile.leagueSettings'),
        onClick: () => navigate('/settings/gamification'),
      });
      items.push({
        icon: <BugReport />,
        label: t('profile.adminMenu.devTools'),
        onClick: () => navigate('/dev'),
      });
    }
    return items;
  }, [isAdmin, isFieldOwner, navigate, t]);

  // Memoizado: recriado apenas quando ratings do usuário ou tema mudam
  const positionRatings = useMemo(() => [
    { icon: <SportsSoccer fontSize="small" />, label: t('profile.positionStriker'), value: user?.strikerRating || 0, autoValue: user?.autoStrikerRating || 0, color: theme.palette.error.main },
    { icon: <DirectionsRun fontSize="small" />, label: t('profile.positionMidfielder'), value: user?.midRating || 0, autoValue: user?.autoMidRating || 0, color: theme.palette.warning.main },
    { icon: <Shield fontSize="small" />, label: t('profile.positionDefender'), value: user?.defenderRating || 0, autoValue: user?.autoDefenderRating || 0, color: theme.palette.info.main },
    { icon: <SportsKabaddi fontSize="small" />, label: t('profile.positionGoalkeeper'), value: user?.gkRating || 0, autoValue: user?.autoGkRating || 0, color: theme.palette.success.main },
  ], [user?.strikerRating, user?.midRating, user?.defenderRating, user?.gkRating, user?.autoStrikerRating, user?.autoMidRating, user?.autoDefenderRating, user?.autoGkRating, theme.palette, t]);

  if (loading) {
    return (
      <Box sx={{ pb: pageSpacing.pagePaddingBottom }}>
        <Box
          sx={{
            background: profileHeaderBackground,
            pt: 2,
            pb: 6,
            px: 2,
            textAlign: 'center',
          }}
        >
          <Skeleton variant="circular" width={100} height={100} sx={{ mx: 'auto', bgcolor: alpha(theme.palette.common.white, 0.2) }} />
          <Skeleton variant="text" width={200} height={40} sx={{ mx: 'auto', mt: 2, bgcolor: alpha(theme.palette.common.white, 0.2) }} />
          <Skeleton variant="text" width={150} height={24} sx={{ mx: 'auto', mt: 0.5, bgcolor: alpha(theme.palette.common.white, 0.2) }} />
        </Box>
        <Box sx={{ px: 2, mt: -3, display: 'flex', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={90} sx={{ flex: 1, borderRadius: 3 }} />
          ))}
        </Box>
        <Box sx={{ px: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 3 }} />
        </Box>
        <Box sx={{ px: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 3 }} />
        </Box>
        <Box sx={{ px: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 3 }} />
        </Box>
      </Box>
    );
  }

  if (!firebaseUser && !loading) {
    return (
      <Box sx={{ pb: pageSpacing.pagePaddingBottom, px: pageSpacing.pagePadding, pt: 4, textAlign: 'center' }}>
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
        >
          {t('profile.signInPrompt')}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/login')} sx={{ borderRadius: 3 }}>
          {t('profile.goToLogin')}
        </Button>
      </Box>
    );
  }

  if (firebaseUser && !user && !loading) {
    return (
      <Box sx={{ pb: pageSpacing.pagePaddingBottom, px: pageSpacing.pagePadding, pt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refreshUser()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('profile.loadErrorSimple')}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: pageSpacing.pagePaddingBottom }}>
      {/* Profile Header */}
      <Box
        sx={{
          background: profileHeaderBackground,
          pt: 2,
          pb: 6,
          px: 2,
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <Avatar
            src={user?.photoUrl}
            slotProps={{ img: { loading: 'lazy' } }}
            sx={{
              width: 100,
              height: 100,
              bgcolor: 'background.paper',
              color: 'primary.main',
              fontSize: '2.5rem',
              fontWeight: 'bold',
              border: '4px solid',
              borderColor: 'background.paper',
              boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.2)}`,
            }}
          >
            {user?.name ? getInitials(user.name) : '?'}
          </Avatar>

          {/* Level Badge */}
          <Box
            sx={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              width: 42,
              height: 42,
              filter: `drop-shadow(0 2px 6px ${levelColor}80)`,
            }}
          >
            <Box
              component="img"
              src={getLevelBadgeImage(currentLevel)}
              onError={handleBadgeImageError}
              loading="lazy"
              decoding="async"
              alt={getLevelBadgeDescription(currentLevel, currentEntry.name)}
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
          <Typography variant="h5" fontWeight="bold" sx={{ color: profileHeaderTextColor }}>
            {user?.name || 'Jogador'}
          </Typography>
          <TeamBadge teamId={user?.favoriteTeam} size={28} />
        </Box>

        {user?.nickname && (
          <Typography variant="body2" sx={{ color: profileHeaderMutedColor }}>
            "{user.nickname}"
          </Typography>
        )}

        <Typography variant="body2" sx={{ color: profileHeaderMutedColor, mt: 0.5 }}>
          {user?.email}
        </Typography>

        {/* A ação principal precisa ficar acima da dobra também no desktop.
            Antes ela aparecia somente após todo o conteúdo do perfil. */}
        <Button
          variant="contained"
          startIcon={<Edit />}
          onClick={() => navigate('/profile/edit')}
          sx={{
            mt: 2,
            minWidth: { xs: 200, sm: 240 },
            minHeight: 48,
            borderRadius: 3,
            bgcolor: 'background.paper',
            color: 'primary.main',
            '&:hover': {
              bgcolor: (buttonTheme) => buttonTheme.palette.mode === 'dark'
                ? buttonTheme.palette.background.default
                : buttonTheme.palette.grey[100],
            },
          }}
        >
          {t('profile.editProfile')}
        </Button>

        {/* Level Card — glassmorphism para integrar com gradiente do header (#1370) */}
        <Card
          sx={{
            mt: 3,
            mx: 'auto',
            maxWidth: 300,
            borderRadius: 3,
            bgcolor: profileLevelCardBg,
            border: '1px solid',
            borderColor: profileLevelCardBorder,
            backdropFilter: 'blur(8px)',
            boxShadow: 'none',
            color: profileHeaderTextColor,
          }}
        >
          <CardActionArea
            onClick={() => navigate('/level-journey')}
            aria-label={t('profile.viewLevelJourneyAria', { level: currentLevel })}
            sx={{ borderRadius: 'inherit', color: 'inherit' }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: profileHeaderTextColor }}>
                  {t('profile.level')} {currentLevel}
                </Typography>
                <Typography variant="caption" fontWeight={600} sx={{ color: profileHeaderMutedColor }}>
                  {currentEntry.name}
                </Typography>
              </Box>

              <LinearProgress
                variant="determinate"
                value={animatedProgress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: alpha(profileHeaderTextColor, 0.14),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${levelColor}, ${alpha(levelColor, 0.7)})`,
                    transition: 'transform 1s ease-in-out',
                  },
                }}
              />

              <Typography
                variant="caption"
                sx={{ display: 'block', mt: 1, color: profileHeaderMutedColor }}
              >
                {currentLevel >= 20
                  ? t('player.card.maxLevel')
                  : `${Math.max(0, xpInLevel)} / ${xpNeededForNext} XP`}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </Box>

      <PageContainer maxWidth="list">
      {/* Stats Cards */}
      <Box sx={{ mt: -3 }}>
        <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, flexWrap: 'wrap' }}>
          <Card sx={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <SportsSoccer sx={{ color: 'primary.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" noWrap sx={{ textOverflow: 'ellipsis', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                {user?.totalGames || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('profile.games')}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <EmojiEvents sx={{ color: 'warning.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" noWrap sx={{ textOverflow: 'ellipsis', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                {user?.totalGoals || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('profile.goals')}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Star sx={{ color: 'secondary.main', mb: 0.5 }} />
              <Typography variant="h5" fontWeight="bold" noWrap sx={{ textOverflow: 'ellipsis', fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                {user?.mvpCount || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('profile.mvps')}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Card>
          <CardContent sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  {t('profile.lookingForGameTitle')}
                </Typography>
                <Chip
                  size="small"
                  color={lookingForGameToday ? 'success' : 'default'}
                  label={t(lookingForGameToday ? 'profile.lookingForGameActive' : 'profile.lookingForGameInactive')}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {t(lookingForGameToday ? 'profile.lookingForGameActiveDescription' : 'profile.lookingForGameDescription')}
              </Typography>
            </Box>
            <Button
              variant={lookingForGameToday ? 'outlined' : 'contained'}
              color={lookingForGameToday ? 'inherit' : 'success'}
              disabled={lookingForGameLoading}
              onClick={handleLookingForGameToggle}
              startIcon={lookingForGameLoading ? <CircularProgress size={18} color="inherit" /> : <SportsSoccer />}
              sx={{ borderRadius: 3, flexShrink: 0 }}
            >
              {t(lookingForGameToday ? 'profile.lookingForGameDisable' : 'profile.lookingForGameEnable')}
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Streak Card */}
      {(user?.currentStreak || 0) > 0 && (
        <Box sx={{ mt: 2 }}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${gColors.streak}20, ${gColors.streak}10)`,
              border: `1px solid ${gColors.streak}40`,
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <LocalFireDepartment sx={{ fontSize: iconSizes.xl, color: gColors.streak }} />
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {t('profile.streakActive', { count: user?.currentStreak || 0 })}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('profile.streakRecord', { count: user?.bestStreak || 0 })}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {(nearLevelInsight || nearBadgeInsights.length > 0) && (
        <Box sx={{ mt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                {t('profile.gamificationFocus')}
              </Typography>
              {nearLevelInsight && (
                <Alert severity="warning" sx={{ mb: nearBadgeInsights.length > 0 ? 1.5 : 0 }}>
                  {t('profile.nearLevelHint', {
                    xp: nearLevelInsight.remainingXp.toLocaleString('pt-BR'),
                    level: nearLevelInsight.level,
                    levelName: nearLevelInsight.levelName,
                  })}
                </Alert>
              )}
              {nearBadgeInsights.map((insight) => (
                <Alert key={insight.badgeId} severity="info" sx={{ mb: 1 }}>
                  {t('profile.nearBadgeHint', {
                    count: insight.remaining,
                    badge: insight.badge.name,
                    current: insight.currentValue,
                    target: insight.threshold,
                  })}
                </Alert>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Ratings por Posição - como Android */}
      <Box sx={{ mt: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('profile.skillsByPosition')}
            </Typography>
            {positionRatings.map((pos, index) => (
              <Box key={pos.label} sx={{ mb: index < positionRatings.length - 1 ? 1.5 : 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: pos.color }}>{pos.icon}</Box>
                    <Typography variant="body2">{pos.label}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600} color={pos.color}>
                      {pos.value.toFixed(1)}
                    </Typography>
                    {pos.autoValue > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                        Auto: {pos.autoValue.toFixed(1)}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(pos.value / 5) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: alpha(pos.color, 0.1),
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 3,
                      bgcolor: pos.color,
                    },
                  }}
                />
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, textAlign: 'right' }}>
              {t('profile.scaleLabel')}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Menu Items */}
      <Box sx={{ mt: 2 }}>
        <Card>
          <List disablePadding aria-label={t('a11y.profileMenu')}>
            {menuItems.map((item, index) => (
              <React.Fragment key={item.label}>
                {index > 0 && <Divider />}
                {/* #2136: ListItemButton em vez de ListItem component="button" —
                    o <button> nativo aplicava `color: ButtonText` e impedia o
                    ListItemText de herdar text.primary em dark/OLED. */}
                <ListItemButton onClick={item.onClick} aria-label={item.label}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                  <ChevronRight color="action" />
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        </Card>
      </Box>

      {/* Seção Administração — só ADMIN/FIELD_OWNER */}
      {adminMenuItems.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', pl: 1, fontWeight: 600 }}
          >
            Administração
          </Typography>
          <Card sx={{ mt: 0.5 }}>
            <List disablePadding aria-label={t('a11y.adminMenu')}>
              {adminMenuItems.map((item, index) => (
                <React.Fragment key={item.label}>
                  {index > 0 && <Divider />}
                  {/* #2136: ListItemButton para herdar text.primary em dark/OLED */}
                  <ListItemButton onClick={item.onClick} aria-label={item.label}>
                    <ListItemIcon sx={{ minWidth: 40, color: 'primary.main' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                    <ChevronRight color="action" />
                  </ListItemButton>
                </React.Fragment>
              ))}
            </List>
          </Card>
        </Box>
      )}

      {/* Account action */}
      <Box sx={{ mt: 2 }}>
        <Button
          variant="outlined"
          color="error"
          startIcon={<Logout />}
          fullWidth
          onClick={() => setLogoutDialogOpen(true)}
          sx={{ borderRadius: 3 }}
        >
          {t('nav.logout')}
        </Button>
      </Box>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        fullScreen={isMobile}
        fullWidth
        maxWidth="sm"
        aria-labelledby="logout-dialog-title"
      >
        <DialogTitle id="logout-dialog-title">{t('profile.logoutTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('profile.logoutMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogoutDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleLogout} color="error" variant="contained">
            {t('nav.logout')}
          </Button>
        </DialogActions>
      </Dialog>
      </PageContainer>
    </Box>
  );
}
