import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
  Badge,
  keyframes,
  Button,
  Divider,
  Avatar,
} from '@mui/material';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
  Notifications as NotificationsIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { AppLogo } from '../common/AppLogo';

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

const RAIL_WIDTH = 88;
const DRAWER_WIDTH = 240;

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  matchPaths?: string[];
}

function isItemActive(item: NavItem, currentPath: string, currentSearch: string): boolean {
  if (currentPath === '/') {
    const tab = new URLSearchParams(currentSearch).get('tab') || '0';
    return item.path === `/?tab=${tab}`;
  }
  return item.matchPaths?.some((mp) => currentPath.startsWith(mp)) ?? false;
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  const NAV_ITEMS: NavItem[] = [
    { icon: <HomeIcon />, label: t('nav.home'), path: '/?tab=0', matchPaths: [] },
    { icon: <SportsSoccer />, label: t('nav.games'), path: '/?tab=1', matchPaths: ['/games', '/game'] },
    { icon: <Groups />, label: t('nav.groups'), path: '/?tab=2', matchPaths: ['/groups', '/group'] },
    { icon: <EmojiEvents />, label: t('nav.league'), path: '/?tab=3', matchPaths: ['/ranking', '/league'] },
    {
      icon: (
        <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
          <NotificationsIcon />
        </Badge>
      ),
      label: t('nav.notifications'),
      path: '/notifications',
      matchPaths: ['/notifications'],
    },
    { icon: <Person />, label: t('nav.profile'), path: '/?tab=4', matchPaths: ['/profile', '/level-journey', '/settings', '/about', '/whats-new', '/search', '/locations', '/location', '/map', '/admin', '/dev', '/badges', '/statistics', '/evolution', '/weekly-recap', '/head-to-head'] },
  ];

  return (
    <>
      {/* Tablet (md): NavigationRail icon-only */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block', lg: 'none' },
          width: RAIL_WIDTH,
          flexShrink: 0,
          height: '100%',
          '& .MuiDrawer-paper': {
            width: RAIL_WIDTH,
            height: '100%',
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'surfaceContainerHigh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        aria-label="Navegação principal"
      >
        <Box
          sx={{ p: 1.5, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
          onClick={() => navigate('/')}
          role="link"
          aria-label="Ir para Início"
        >
          {/* Logo padronizada — substitui ícone SportsSoccer (não era brand asset) */}
          <AppLogo size="small" shape="circle" alt="Futeba dos Parças" />
        </Box>
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search);
            const isNotifItem = item.path === '/notifications';
            return (
              <Tooltip key={item.label} title={item.label} placement="right">
                <ListItemButton
                  selected={active}
                  onClick={() => navigate(item.path)}
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
                      animation: isNotifItem && unreadCount > 0 ? `${pulse} 2s ease-in-out infinite` : undefined,
                    }}
                  >
                    {React.cloneElement(item.icon as React.ReactElement, { 'aria-hidden': true })}
                  </ListItemIcon>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: active ? 600 : 400,
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.label}
                  </Typography>
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Drawer>

      {/* Desktop (lg+): Drawer permanent expanded */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          height: '100%',
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            height: '100%',
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'surfaceContainerHigh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        aria-label="Navegação principal"
      >
        <Box
          sx={{
            p: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
          onClick={() => navigate('/')}
          role="link"
          aria-label="Ir para Início"
        >
          {/* Logo padronizada — sidebar expandida */}
          <AppLogo size="small" shape="circle" alt="Futeba dos Parças" sx={{ width: 28, height: 28 }} />
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {t('common.appName')}
          </Typography>
        </Box>
        <Box sx={{ px: 2, pb: 1 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddIcon />}
            onClick={() => navigate('/game/create')}
            sx={{ borderRadius: 6 }}
          >
            {t('games.createGame')}
          </Button>
        </Box>
        <Divider sx={{ mx: 2, mb: 1 }} />
        <List>
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search);
            const isNotifItem = item.path === '/notifications';
            return (
              <Tooltip key={item.label} title={item.label} placement="right">
                <ListItemButton
                  selected={active}
                  onClick={() => navigate(item.path)}
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
                  <ListItemIcon
                    sx={{
                      color: 'text.secondary',
                      animation: isNotifItem && unreadCount > 0 ? `${pulse} 2s ease-in-out infinite` : undefined,
                    }}
                  >
                    {React.cloneElement(item.icon as React.ReactElement, { 'aria-hidden': true })}
                  </ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
        <Box sx={{ mt: 'auto', p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={user?.photoUrl} sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
              {userInitial}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user?.name || 'Usuário'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email || t('nav.profile')}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
