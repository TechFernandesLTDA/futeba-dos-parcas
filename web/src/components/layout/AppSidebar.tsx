import React from 'react';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Typography,
  Tooltip,
  Badge,
  keyframes,
  Button,
  Divider,
  Avatar,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  KeyboardCommandKey as KeyboardIcon,
  Search as SearchIcon,
  BarChart as BarChartIcon,
  EmojiEvents as TrophyIcon,
  LocationOn as LocationIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadNotificationCount } from '../../hooks/useNotifications';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AppLogo } from '../common/AppLogo';
import { avatarSizes, iconSizes } from '../../theme/iconSizes';
import {
  NAV_ITEMS,
  RAIL_WIDTH_RESPONSIVE,
  DRAWER_WIDTH_RESPONSIVE,
  getActiveNavIndex,
} from '../../config/navItems';

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { unreadCount } = useUnreadNotificationCount(user?.id);
  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';
  const reducedMotion = useReducedMotion();

  // #2226: índice ativo via fonte única (compartilhada com MobileBottomNav).
  // Substitui o antigo isItemActive (lógica duplicada que destacava a seção
  // errada em rotas secundárias).
  const activeIndex = React.useMemo(
    () => getActiveNavIndex(location.pathname, location.search),
    [location.pathname, location.search],
  );

  return (
    <>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block', lg: 'none' },
          width: RAIL_WIDTH_RESPONSIVE,
          flexShrink: 0,
          height: '100%',
          '& .MuiDrawer-paper': {
            width: RAIL_WIDTH_RESPONSIVE,
            height: '100%',
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            backdropFilter: 'blur(16px)',
            backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
            '@supports not (backdrop-filter: blur(16px))': { backgroundColor: 'background.paper' },
            '@media (prefers-reduced-transparency: reduce)': { backdropFilter: 'none', backgroundColor: 'background.paper' },
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        aria-label={t('a11y.mainNav')}
      >
        <Box
          sx={{ p: 1.5, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
          onClick={() => navigate('/')}
          role="link"
          tabIndex={0}
          aria-label={t('nav.home')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/');
            }
          }}
        >
          <AppLogo size="small" shape="circle" alt={t('alt.logo')} />
        </Box>
        <Box sx={{ px: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Tooltip title={t('nav.search')} placement="right">
            <ListItemButton
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
              }}
              sx={{ flexDirection: 'column', py: 1, borderRadius: 2 }}
              aria-label={t('nav.search')}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mb: 0.5 }}>
                <SearchIcon />
              </ListItemIcon>
              <Typography variant="caption" color="text.secondary" fontSize="0.65rem">
                {t('nav.search')}
              </Typography>
            </ListItemButton>
          </Tooltip>
          <Tooltip title={t('games.createGame')} placement="right">
            <ListItemButton
              onClick={() => navigate('/game/create')}
              sx={{
                flexDirection: 'column',
                py: 1,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
              aria-label={t('games.createGame')}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mb: 0.5, color: 'inherit' }}>
                <AddIcon />
              </ListItemIcon>
              <Typography variant="caption" color="inherit" fontSize="0.65rem">
                {t('games.createGame')}
              </Typography>
            </ListItemButton>
          </Tooltip>
        </Box>
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item, idx) => {
            const active = activeIndex === idx;
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
                      animation: isNotifItem && unreadCount > 0 && !reducedMotion ? `${pulse} 2s ease-in-out infinite` : undefined,
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
          width: DRAWER_WIDTH_RESPONSIVE,
          flexShrink: 0,
          height: '100%',
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH_RESPONSIVE,
            height: '100%',
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            backdropFilter: 'blur(16px)',
            backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.8),
            '@supports not (backdrop-filter: blur(16px))': { backgroundColor: 'background.paper' },
            '@media (prefers-reduced-transparency: reduce)': { backdropFilter: 'none', backgroundColor: 'background.paper' },
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        aria-label={t('a11y.mainNav')}
      >
        <Box
          sx={{
            p: 1.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
          onClick={() => navigate('/')}
          role="link"
          tabIndex={0}
          aria-label={t('nav.home')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/');
            }
          }}
        >
          <AppLogo size="small" shape="circle" alt={t('alt.logo')} sx={{ width: iconSizes.sidebar, height: iconSizes.sidebar }} />
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {t('common.appName')}
          </Typography>
        </Box>
        <Box sx={{ px: 1.5, pb: 0.75 }}>
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
        <Divider sx={{ mx: 1.5, mb: 0.75 }} />
        <Box sx={{ px: 1.5, pb: 0.75 }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<SearchIcon />}
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
            }}
            sx={{
              borderRadius: 2,
              justifyContent: 'flex-start',
              color: 'text.secondary',
              borderColor: 'divider',
              textTransform: 'none',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            <Box sx={{ flex: 1, textAlign: 'left' }}>{t('nav.search')}...</Box>
            <Chip label="Ctrl+K" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem', ml: 1 }} />
          </Button>
        </Box>
        <List sx={{ py: 0.5 }}>
          <ListSubheader sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.75 }}>
            {t('nav.sectionPrimary')}
          </ListSubheader>
          {NAV_ITEMS.slice(0, 5).map((item, idx) => {
            const active = activeIndex === idx;
            return (
              <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
                <ListItemButton
                  selected={active}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2,
                    mx: 0.75,
                    my: 0.25,
                    py: 0.75,
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
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={t(item.labelKey)} />
                </ListItemButton>
              </Tooltip>
            );
          })}
          <ListSubheader sx={{ fontSize: '0.7rem', fontWeight: 600, lineHeight: 1.75 }}>
            {t('nav.sectionMore')}
          </ListSubheader>
          {[
            { labelKey: 'nav.statistics', path: '/statistics', icon: <BarChartIcon aria-hidden /> },
            { labelKey: 'nav.badges', path: '/badges', icon: <TrophyIcon aria-hidden /> },
            { labelKey: 'nav.locations', path: '/locations', icon: <LocationIcon aria-hidden /> },
            { labelKey: 'nav.settings', path: '/settings', icon: <SettingsIcon aria-hidden /> },
          ].map((item) => (
            <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
              <ListItemButton
                selected={location.pathname.startsWith(item.path)}
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: 2,
                  mx: 0.75,
                  my: 0.25,
                  py: 0.75,
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
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            </Tooltip>
          ))}
        </List>
        {/* #2192: entrada descobrível para os atalhos de teclado. Antes só
            acessíveis pressionando "?", sem nenhuma pista visual. */}
        <Box sx={{ mt: 'auto', px: 0.75, pb: 0.25 }}>
          <ListItemButton
            onClick={() => window.dispatchEvent(new Event('open-shortcuts'))}
            sx={{ borderRadius: 2, mx: 0.75, py: 0.75 }}
            aria-label={t('shortcuts.openLabel')}
          >
            <ListItemIcon sx={{ color: 'text.secondary' }}>
              <KeyboardIcon aria-hidden />
            </ListItemIcon>
            <ListItemText
              primary={t('shortcuts.title')}
              primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
            />
            <Chip label="?" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
          </ListItemButton>
        </Box>
        <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={user?.photoUrl} sx={{ width: avatarSizes.sidebar, height: avatarSizes.sidebar, bgcolor: 'primary.main' }}>
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
