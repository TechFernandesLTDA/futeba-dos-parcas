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
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { AppLogo } from '../common/AppLogo';
import { NAV_ITEMS, RAIL_WIDTH, DRAWER_WIDTH, NavItem } from '../../config/navItems';

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

function isItemActive(item: NavItem, currentPath: string, currentSearch: string): boolean {
  if (currentPath === '/') {
    const tab = new URLSearchParams(currentSearch).get('tab') || '0';
    return item.path === `/?tab=${tab}`;
  }
  return item.matchPaths.some((mp) => currentPath.startsWith(mp));
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <>
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
          <AppLogo size="small" shape="circle" alt="Futeba dos Parças" />
        </Box>
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search);
            const isNotifItem = item.path === '/notifications';
            const icon = isNotifItem ? (
              <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
                {item.icon}
              </Badge>
            ) : item.icon;
            return (
              <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
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
                    {React.cloneElement(icon, { 'aria-hidden': true })}
                  </ListItemIcon>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: active ? 600 : 400,
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {t(item.labelKey)}
                  </Typography>
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Drawer>

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
            const icon = isNotifItem ? (
              <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
                {item.icon}
              </Badge>
            ) : item.icon;
            return (
              <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
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
                    {React.cloneElement(icon, { 'aria-hidden': true })}
                  </ListItemIcon>
                  <ListItemText primary={t(item.labelKey)} />
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
