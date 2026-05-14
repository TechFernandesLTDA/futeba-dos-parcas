import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Snackbar,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
  Skeleton,
  AppBar,
  Toolbar,
  IconButton,
} from '@mui/material';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Badge } from '@mui/material';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../contexts/AuthContext';

// Carregamento lazy das tabs para reduzir bundle inicial da HomeScreen
const HomeTab = lazy(() => import('./tabs/HomeTab').then(m => ({ default: m.HomeTab })));
const GamesTab = lazy(() => import('./tabs/GamesTab').then(m => ({ default: m.GamesTab })));
const GroupsTab = lazy(() => import('./tabs/GroupsTab').then(m => ({ default: m.GroupsTab })));
const RankingsTab = lazy(() => import('./tabs/RankingsTab').then(m => ({ default: m.RankingsTab })));
const ProfileTab = lazy(() => import('./tabs/ProfileTab').then(m => ({ default: m.ProfileTab })));
const NotificationsScreenLazy = lazy(() => import('../ranking/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })));
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { NotificationBell } from '../../components/common/NotificationBell';

// Larguras dos navs adaptativos (Material 3 spec)
const RAIL_WIDTH = 80;     // md: NavigationRail (icon-only)
const DRAWER_WIDTH = 240;  // lg+: Drawer permanent (icon + label)

// Skeleton de carregamento para transição entre tabs
function TabSkeleton() {
  return (
    <Box sx={{ p: 2 }}>
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} variant="rounded" height={80} sx={{ mb: 1.5 }} />
      ))}
    </Box>
  );
}

export function HomeScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabValue = parseInt(searchParams.get('tab') || '0');
  const { permission, requestPermission } = useNotificationPermission();
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);

  const notificationIcon = useMemo(() => (
    <Badge badgeContent={unreadCount} color="error" invisible={unreadCount === 0} max={99}>
      <NotificationsIcon />
    </Badge>
  ), [unreadCount]);

  useEffect(() => {
    // Mostrar banner apenas se permissão ainda não foi decidida
    if (permission === 'default') {
      const timer = setTimeout(() => setShowNotifBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [permission]);

  // Memoizado para evitar recriação dos objetos JSX a cada render
  const tabConfigs = useMemo(() => [
    { icon: <HomeIcon />, label: t('nav.home') },
    { icon: <SportsSoccer />, label: t('nav.games') },
    { icon: <Groups />, label: t('nav.groups') },
    { icon: <EmojiEvents />, label: t('nav.league') },
    { icon: <Person />, label: t('nav.profile') },
    { icon: notificationIcon, label: t('nav.notifications', 'Notificações') },
  ], [t, notificationIcon]);

  // Bottom nav mobile: 5 itens (sem Notificações, igual Android) (#1211)
  const bottomNavConfigs = useMemo(() => tabConfigs.slice(0, 5), [tabConfigs]);

  // Estabilizado com useCallback para evitar recriação a cada render
  const handleTabChange = useCallback((idx: number) => {
    setSearchParams({ tab: idx.toString() });
  }, [setSearchParams]);

  // Handler estabilizado para o BottomNavigation
  const handleBottomNavChange = useCallback((_: React.SyntheticEvent, newValue: number) => {
    handleTabChange(newValue);
  }, [handleTabChange]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        height: '100dvh',
      }}
    >
      {/* Tablet (md): NavigationRail icon-only */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block', lg: 'none' },
          width: RAIL_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: RAIL_WIDTH,
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          },
        }}
        aria-label="Navegação principal"
      >
        <List sx={{ pt: 2 }}>
          {tabConfigs.map((config, idx) => (
            <Tooltip key={config.label} title={config.label} placement="right">
              <ListItemButton
                selected={tabValue === idx}
                onClick={() => handleTabChange(idx)}
                sx={{
                  flexDirection: 'column',
                  py: 1.5,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    justifyContent: 'center',
                    mb: 0.5,
                  }}
                >
                  {config.icon}
                </ListItemIcon>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: tabValue === idx ? 600 : 400,
                    color: tabValue === idx ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {config.label}
                </Typography>
              </ListItemButton>
            </Tooltip>
          ))}
        </List>
      </Drawer>

      {/* Desktop (lg+): Drawer permanent expanded */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          },
        }}
        aria-label="Navegação principal"
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SportsSoccer sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {t('common.appName')}
          </Typography>
        </Box>
        <List>
          {tabConfigs.map((config, idx) => (
            <ListItemButton
              key={config.label}
              selected={tabValue === idx}
              onClick={() => handleTabChange(idx)}
              sx={{
                borderRadius: 2,
                mx: 1,
                my: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'action.selected',
                  '& .MuiListItemIcon-root': { color: 'primary.main' },
                  '& .MuiListItemText-primary': {
                    color: 'primary.main',
                    fontWeight: 600,
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: 'text.secondary' }}>
                {config.icon}
              </ListItemIcon>
              <ListItemText primary={config.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      {/* Conteúdo principal com scroll */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          // pb apenas em mobile pra não ficar sob a bottom nav
          pb: { xs: '72px', md: 0 },
        }}
      >
        {/* AppBar mobile com NotificationBell (#1214) */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            display: { xs: 'flex', md: 'none' },
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar variant="dense">
            <SportsSoccer sx={{ color: 'primary.main', mr: 1 }} />
            <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ flex: 1 }}>
              {t('common.appName')}
            </Typography>
            <IconButton onClick={() => handleTabChange(5)} aria-label="Notificações" size="small">
              <NotificationBell unreadCount={unreadCount} />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Suspense local: evita desmontar o nav ao carregar chunk da tab */}
        <Suspense fallback={<TabSkeleton />}>
          {tabValue === 0 && <HomeTab />}
          {tabValue === 1 && <GamesTab />}
          {tabValue === 2 && <GroupsTab />}
          {tabValue === 3 && <RankingsTab />}
          {tabValue === 4 && <ProfileTab />}
          {tabValue === 5 && <NotificationsScreenLazy />}
        </Suspense>
      </Box>

      {/* Mobile (xs/sm): BottomNavigation - 5 botões (igual ao Android) */}
      {/* Em sm+ respeita MobileShell (480px centrado) */}
      <Paper
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: { xs: 0, sm: '50%' },
          right: { xs: 0, sm: 'auto' },
          transform: { sm: 'translateX(-50%)' },
          width: { xs: '100%', sm: 480 },
          maxWidth: 480,
          zIndex: 1000,
          // Safe area para dispositivos com notch/barra de gestos
          pb: 'env(safe-area-inset-bottom, 0px)',
        }}
        elevation={3}
      >
        <BottomNavigation
          value={tabValue < 5 ? tabValue : 99}
          onChange={handleBottomNavChange}
          showLabels
          aria-label="Navegação principal"
          sx={{
            bgcolor: 'background.paper',
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 0,
              px: 0.5,
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.65rem',
                '&.Mui-selected': {
                   fontSize: '0.75rem',
                },
              },
            },
          }}
        >
          {bottomNavConfigs.map((config) => (
            <BottomNavigationAction
              key={config.label}
              icon={config.icon}
              label={config.label}
              sx={{
                '&.Mui-selected': {
                  color: 'primary.main',
                  '& .MuiBottomNavigationAction-label': {
                    fontWeight: 600,
                  },
                },
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>

      {/* Banner de notificações */}
      <Snackbar
        open={showNotifBanner}
        message="Ative as notificações para receber alertas de jogos!"
        action={
          <>
            <Button color="secondary" size="small" onClick={() => setShowNotifBanner(false)}>
              Depois
            </Button>
            <Button color="primary" size="small" onClick={() => { requestPermission(); setShowNotifBanner(false); }}>
              Ativar
            </Button>
          </>
        }
        onClose={() => setShowNotifBanner(false)}
        sx={{ bottom: { xs: 80, md: 16 } }}
      />
    </Box>
  );
}
