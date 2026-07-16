import React, { useState } from 'react';
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
  Popover,
} from '@mui/material';
import {
  Add as AddIcon,
  KeyboardCommandKey as KeyboardIcon,
  Search as SearchIcon,
  MoreHoriz,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadNotificationCount } from '../../hooks/useNotifications';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { AppLogo } from '../common/AppLogo';
import { avatarSizes, iconSizes } from '../../theme/iconSizes';
import { md3TypeScale } from '../../theme';
import { getNavigationGlassStyles } from '../../theme/navigationGlass';
import { navigationControlTokens } from '../../theme/navigationControls';
import {
  NAV_ITEMS,
  PRIMARY_NAV_ITEMS,
  MORE_NAV_ITEMS,
  RAIL_WIDTH_RESPONSIVE,
  DRAWER_WIDTH_RESPONSIVE,
  getActiveNavIndex,
  resolveNavItemPath,
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
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);

  const activeIndex = React.useMemo(
    () => getActiveNavIndex(location.pathname, location.search),
    [location.pathname, location.search],
  );
  const moreActive = MORE_NAV_ITEMS.some((item) => NAV_ITEMS.indexOf(item) === activeIndex);
  const morePopoverId = 'app-sidebar-more-menu';
  const moreOpen = moreAnchor !== null;

  const openSearch = () => window.dispatchEvent(new Event('open-command-palette'));

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          MD RAIL (900–1199px) — ícones + captions, "Mais" em Popover
          ════════════════════════════════════════════════════════════ */}
      <Drawer
        variant="permanent"
        sx={(theme) => ({
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
            ...getNavigationGlassStyles(theme, 'desktop'),
            display: 'flex',
            flexDirection: 'column',
          },
        })}
        aria-label={t('a11y.mainNav')}
      >
        <Box
          component={RouterLink}
          to="/"
          sx={{ p: 1.5, display: 'flex', justifyContent: 'center', textDecoration: 'none', color: 'inherit' }}
          aria-label={t('nav.home')}
        >
          <AppLogo size="small" shape="circle" alt={t('alt.logo')} />
        </Box>
        <Box sx={{ px: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Tooltip title={t('nav.search')} placement="right">
            <ListItemButton
              onClick={openSearch}
              sx={{ flexDirection: 'column', py: 1.25, borderRadius: 2 }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mb: 0.5 }}>
                <SearchIcon sx={{ fontSize: iconSizes.lg }} />
              </ListItemIcon>
              <Typography variant="caption" color="text.secondary" noWrap>
                {t('nav.search')}
              </Typography>
            </ListItemButton>
          </Tooltip>
          <Tooltip title={t('games.createGame')} placement="right">
            <ListItemButton
              onClick={() => navigate('/game/create')}
              sx={{
                flexDirection: 'column',
                py: 1.25,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mb: 0.5, color: 'inherit' }}>
                <AddIcon sx={{ fontSize: iconSizes.lg }} />
              </ListItemIcon>
              <Typography variant="caption" color="inherit" noWrap>
                {t('games.createGame')}
              </Typography>
            </ListItemButton>
          </Tooltip>
        </Box>
        <List sx={{ pt: 1, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const realIdx = NAV_ITEMS.indexOf(item);
            const active = activeIndex === realIdx;
            return (
              <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
                <ListItemButton
                  selected={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(resolveNavItemPath(item, user?.role))}
                  sx={{
                    flexDirection: 'column',
                    py: 1.25,
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
                    {React.cloneElement(item.icon, { 'aria-hidden': true, sx: { fontSize: iconSizes.lg } })}
                  </ListItemIcon>
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      maxWidth: '100%',
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
          {/* #3728: "Mais" no rail md — abre Popover com items secundários */}
          <Tooltip title={t('nav.sectionMore')} placement="right">
            <ListItemButton
              onClick={(e) => setMoreAnchor(e.currentTarget)}
              selected={moreOpen || moreActive}
              aria-current={moreActive ? 'page' : undefined}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-controls={moreOpen ? morePopoverId : undefined}
              sx={{
                flexDirection: 'column',
                py: 1.25,
                '&.Mui-selected': { bgcolor: 'action.selected' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mb: 0.5 }}>
                <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
                  <MoreHoriz sx={{ fontSize: iconSizes.lg }} aria-hidden />
                </Badge>
              </ListItemIcon>
              <Typography variant="caption" color="text.secondary" noWrap>
                {t('nav.sectionMore')}
              </Typography>
            </ListItemButton>
          </Tooltip>
        </List>
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
          <ListItemButton
            onClick={() => navigate('/profile/edit')}
            sx={{ borderRadius: 2, justifyContent: 'center' }}
            aria-label={`${user?.name || t('settings.defaultUserName')} — ${t('profile.editProfile')}`}
          >
            <Avatar
              src={user?.photoUrl}
              sx={{ width: avatarSizes.sidebarCompact, height: avatarSizes.sidebarCompact, bgcolor: 'primary.main', color: 'primary.contrastText' }}
            >
              {userInitial}
            </Avatar>
          </ListItemButton>
        </Box>
      </Drawer>

      {/* Popover "Mais" do rail md */}
      <Popover
        id={morePopoverId}
        open={moreOpen}
        anchorEl={moreAnchor}
        onClose={() => setMoreAnchor(null)}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      >
        <List role="menu" sx={{ minWidth: 200, py: 0.5 }}>
          {MORE_NAV_ITEMS.map((item) => {
            const realIdx = NAV_ITEMS.indexOf(item);
            const active = activeIndex === realIdx;
            const isNotifItem = item.labelKey === 'nav.notifications';
            const icon = isNotifItem ? (
              <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
                {item.icon}
              </Badge>
            ) : item.icon;
            return (
              <ListItemButton
                key={item.labelKey}
                role="menuitem"
                selected={active}
                aria-current={active ? 'page' : undefined}
                aria-label={isNotifItem && unreadCount > 0
                  ? t('nav.notificationsAria', { count: unreadCount })
                  : undefined}
                onClick={() => {
                  navigate(resolveNavItemPath(item, user?.role));
                  setMoreAnchor(null);
                }}
                sx={{
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 600 },
                  },
                }}
              >
                <ListItemIcon sx={{ color: 'text.secondary', minWidth: 36 }}>
                  {isNotifItem ? icon : React.cloneElement(icon, { 'aria-hidden': true })}
                </ListItemIcon>
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            );
          })}
        </List>
      </Popover>

      {/* ════════════════════════════════════════════════════════════
          LG DRAWER (1200px+) — expandido com labels, seções Primária/Mais
          ════════════════════════════════════════════════════════════ */}
      <Drawer
        variant="permanent"
        sx={(theme) => ({
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
            ...getNavigationGlassStyles(theme, 'desktop'),
            display: 'flex',
            flexDirection: 'column',
          },
        })}
        aria-label={t('a11y.mainNav')}
      >
        <Box
          component={RouterLink}
          to="/"
          sx={{
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
            color: 'inherit',
          }}
          aria-label={t('nav.home')}
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
            onClick={openSearch}
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
            <Chip
              label="Ctrl+K"
              size="small"
              variant="outlined"
              sx={{ height: navigationControlTokens.shortcutChipHeight, ...md3TypeScale.labelMedium, ml: 1 }}
            />
          </Button>
        </Box>
        <List sx={{ py: 0.5, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <ListSubheader sx={{ typography: 'labelSmall', fontWeight: 600, lineHeight: 1.75 }}>
            {t('nav.sectionPrimary')}
          </ListSubheader>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const realIdx = NAV_ITEMS.indexOf(item);
            const active = activeIndex === realIdx;
            return (
              <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
                <ListItemButton
                  selected={active}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => navigate(resolveNavItemPath(item, user?.role))}
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
                    {React.cloneElement(item.icon, { sx: { fontSize: iconSizes.lg } })}
                  </ListItemIcon>
                  <ListItemText primary={t(item.labelKey)} />
                </ListItemButton>
              </Tooltip>
            );
          })}
          <ListSubheader sx={{ typography: 'labelSmall', fontWeight: 600, lineHeight: 1.75 }}>
            {t('nav.sectionMore')}
          </ListSubheader>
          {/* #3726/#3727: seção "Mais" agora deriva de NAV_ITEMS (fonte única).
              Notifications e Messages incluídos (antes ausentes no lg). */}
          {MORE_NAV_ITEMS.map((item) => {
            const realIdx = NAV_ITEMS.indexOf(item);
            const active = activeIndex === realIdx;
            const isNotifItem = item.labelKey === 'nav.notifications';
            const icon = isNotifItem ? (
              <Badge badgeContent={unreadCount} color="error" max={99} invisible={unreadCount === 0}>
                {item.icon}
              </Badge>
            ) : item.icon;
            return (
              <Tooltip key={item.labelKey} title={t(item.labelKey)} placement="right">
                <ListItemButton
                  selected={active}
                  aria-current={active ? 'page' : undefined}
                  aria-label={isNotifItem && unreadCount > 0
                    ? t('nav.notificationsAria', { count: unreadCount })
                    : undefined}
                  onClick={() => navigate(resolveNavItemPath(item, user?.role))}
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
                  <ListItemIcon
                    sx={{
                      color: 'text.secondary',
                      animation: isNotifItem && unreadCount > 0 && !reducedMotion ? `${pulse} 2s ease-in-out infinite` : undefined,
                    }}
                  >
                    {isNotifItem
                      ? icon
                      : React.cloneElement(icon, { 'aria-hidden': true, sx: { fontSize: iconSizes.lg } })}
                  </ListItemIcon>
                  <ListItemText primary={t(item.labelKey)} />
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
        {/* #2192: entrada descobrível para os atalhos de teclado. */}
        <ListItemButton
          onClick={() => window.dispatchEvent(new Event('open-shortcuts'))}
          sx={{ borderRadius: 2, mx: 0.75, py: 0.75, flexShrink: 0 }}
          aria-label={t('shortcuts.openLabel')}
        >
          <ListItemIcon sx={{ color: 'text.secondary' }}>
            <KeyboardIcon aria-hidden />
          </ListItemIcon>
          <ListItemText
            primary={t('shortcuts.title')}
            primaryTypographyProps={{ variant: 'body2', color: 'text.secondary' }}
          />
          <Chip
            label="?"
            size="small"
            variant="outlined"
            sx={{ height: navigationControlTokens.shortcutChipHeight, ...md3TypeScale.labelMedium }}
          />
        </ListItemButton>
        {/* #3733: rodapé permanece visível e leva diretamente à edição do perfil. */}
        <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
          <ListItemButton
            onClick={() => navigate('/profile/edit')}
            aria-label={`${user?.name || t('settings.defaultUserName')} — ${t('profile.editProfile')}`}
            sx={{
              minHeight: 64,
              borderRadius: 2,
              gap: 1.5,
              px: 1,
            }}
          >
            <Avatar src={user?.photoUrl} sx={{ width: avatarSizes.sidebar, height: avatarSizes.sidebar, bgcolor: 'primary.main' }}>
              {userInitial}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user?.name || t('settings.defaultUserName')}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.email || t('profile.editProfile')}
              </Typography>
            </Box>
            <EditIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
          </ListItemButton>
        </Box>
      </Drawer>
    </>
  );
}
