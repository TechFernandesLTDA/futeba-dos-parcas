import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
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
import { usePrefetchHome } from '../../hooks/usePrefetchHome';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';

// Carregamento lazy das tabs para reduzir bundle inicial da HomeScreen
const HomeTab = lazy(() => import('./tabs/HomeTab').then(m => ({ default: m.HomeTab })));
const GamesTab = lazy(() => import('./tabs/GamesTab').then(m => ({ default: m.GamesTab })));
const GroupsTab = lazy(() => import('./tabs/GroupsTab').then(m => ({ default: m.GroupsTab })));
const RankingsTab = lazy(() => import('./tabs/RankingsTab').then(m => ({ default: m.RankingsTab })));
const ProfileTab = lazy(() => import('./tabs/ProfileTab').then(m => ({ default: m.ProfileTab })));
const NotificationsScreenLazy = lazy(() => import('../ranking/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })));
import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { NotificationBell } from '../../components/common/NotificationBell';
import { AppLogo } from '../../components/common/AppLogo';
import { WhatsNewPopupHost } from '../../components/whatsnew/WhatsNewPopupHost';
import { TeamOfTheWeek } from '../../components/game/TeamOfTheWeek';
import { QuickActions } from '../../components/home/QuickActions';

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
  const [mountedTabs, setMountedTabs] = useState<Set<number>>(() => new Set([tabValue]));
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const contentRef = useRef<HTMLDivElement>(null);

  // Prefetch de dados críticos da Home em paralelo
  usePrefetchHome();

  // Monitoramento de performance
  const { metrics } = usePerformanceMonitoring({ screenName: 'HomeScreen' });

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

  // Marca tab como montada na primeira visita para preservar estado (#1220)
  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(tabValue)) return prev;
      return new Set([...prev, tabValue]);
    });
  }, [tabValue]);

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
                id={`tab-${idx}`}
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
        {/* #1342: logo/nome clicável → volta para o início (tab 0).
            Padrão SaaS: header brand sempre leva à home. Acessível via
            teclado (role=button + Enter/Espaço) e foco visível. */}
        <Box
          onClick={() => handleTabChange(0)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTabChange(0);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${t('common.appName')} — ir para o início`}
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
            '&:focus-visible': {
              outline: (theme) => `2px solid ${theme.palette.primary.main}`,
              outlineOffset: 2,
            },
          }}
        >
          {/* Logo padronizada (AppLogo /logo.png circular) — alinhado a
              AppSidebar/MobileTopBar. Antes usava /icons/icon-192.png
              (PWA icon quadrado), divergente do resto do app. */}
          <AppLogo size="small" shape="circle" alt={t('common.appName')} sx={{ width: 32, height: 32 }} />
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {t('common.appName')}
          </Typography>
        </Box>
        <List>
          {tabConfigs.map((config, idx) => (
            <ListItemButton
              id={`tab-${idx}`}
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
          // pb apenas em mobile pra não ficar sob a bottom nav + safe area
          pb: { xs: 'calc(72px + env(safe-area-inset-bottom, 0px))', md: 0 },
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
            {/* Logo padronizada (AppLogo /logo.png circular) — alinhado a
                MobileTopBar das demais telas. */}
            <AppLogo size="small" shape="circle" alt={t('common.appName')} sx={{ width: 28, height: 28, mr: 1 }} />
            <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ flex: 1 }}>
              {t('common.appName')}
            </Typography>
            {/* NotificationBell já é um IconButton — não aninhar dentro de outro (#1321) */}
            <NotificationBell unreadCount={unreadCount} />
          </Toolbar>
        </AppBar>

        {/* Conteúdo com role tabpanel — SkipNav (#1241) já está em App.tsx via <SkipNav /> */}
        <Box
          ref={contentRef}
          role="tabpanel"
          id="main-tabpanel"
          aria-labelledby={`tab-${tabValue}`}
          sx={{ flex: 1 }}
        >
        {/* TOW: Time of the Week - ranking semanal estilo Cartola */}
        {tabValue === 0 && (
          <Box sx={{ px: { xs: 2, sm: 2 }, pb: 0, pt: 1 }}>
            <Suspense fallback={null}>
              <TeamOfTheWeek />
            </Suspense>
            <QuickActions />
          </Box>
        )}
        {/* Suspense local: evita desmontar o nav ao carregar chunk da tab */}
        <Suspense fallback={<TabSkeleton />}>
          {mountedTabs.has(0) && <Box sx={{ display: tabValue === 0 ? 'block' : 'none' }}><HomeTab /></Box>}
          {mountedTabs.has(1) && <Box sx={{ display: tabValue === 1 ? 'block' : 'none' }}><GamesTab /></Box>}
          {mountedTabs.has(2) && <Box sx={{ display: tabValue === 2 ? 'block' : 'none' }}><GroupsTab /></Box>}
          {mountedTabs.has(3) && <Box sx={{ display: tabValue === 3 ? 'block' : 'none' }}><RankingsTab /></Box>}
          {mountedTabs.has(4) && <Box sx={{ display: tabValue === 4 ? 'block' : 'none' }}><ProfileTab /></Box>}
          {mountedTabs.has(5) && <Box sx={{ display: tabValue === 5 ? 'block' : 'none' }}><NotificationsScreenLazy /></Box>}
        </Suspense>
        </Box>
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
                fontSize: '0.75rem',
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
        message={t('notifications.bannerMessage', 'Ative as notificações para receber alertas de jogos!')}
        action={
          <>
            <Button color="secondary" size="small" onClick={() => setShowNotifBanner(false)}>
              {t('common.later', 'Depois')}
            </Button>
            <Button color="primary" size="small" onClick={() => { requestPermission(); setShowNotifBanner(false); }}>
              {t('common.activate', 'Ativar')}
            </Button>
          </>
        }
        onClose={() => setShowNotifBanner(false)}
        sx={{ bottom: { xs: 80, md: 16 } }}
      />

      {/* Pop-up automático "Novidades" — aparece 1x após atualização do app */}
      <WhatsNewPopupHost />
      
      {/* Performance Overlay (dev mode apenas) */}
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
}
