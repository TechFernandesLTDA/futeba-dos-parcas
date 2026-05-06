import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
} from '@mui/icons-material';

import { HomeTab } from './tabs/HomeTab';
import { GamesTab } from './tabs/GamesTab';
import { GroupsTab } from './tabs/GroupsTab';
import { RankingsTab } from './tabs/RankingsTab';
import { ProfileTab } from './tabs/ProfileTab';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';

const TAB_TITLES = ['Início', 'Jogos', 'Grupos', 'Liga', 'Perfil'];

// Larguras dos navs adaptativos (Material 3 spec)
const RAIL_WIDTH = 80;     // md: NavigationRail (icon-only)
const DRAWER_WIDTH = 240;  // lg+: Drawer permanent (icon + label)

export function HomeScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabValue = parseInt(searchParams.get('tab') || '0');
  const { permission, requestPermission } = useNotificationPermission();
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  useDocumentTitle(TAB_TITLES[tabValue]);

  useEffect(() => {
    // Mostrar banner apenas se permissão ainda não foi decidida
    if (permission === 'default') {
      const timer = setTimeout(() => setShowNotifBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [permission]);

  const tabConfigs = [
    { icon: <HomeIcon />, label: 'Início' },
    { icon: <SportsSoccer />, label: 'Jogos' },
    { icon: <Groups />, label: 'Grupos' },
    { icon: <EmojiEvents />, label: 'Liga' },
    { icon: <Person />, label: 'Perfil' },
  ];

  const handleTabChange = (idx: number) => {
    setSearchParams({ tab: idx.toString() });
  };

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
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={700} color="primary.main">
            Futeba dos Parças
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
        {tabValue === 0 && <HomeTab />}
        {tabValue === 1 && <GamesTab />}
        {tabValue === 2 && <GroupsTab />}
        {tabValue === 3 && <RankingsTab />}
        {tabValue === 4 && <ProfileTab />}
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
          value={tabValue}
          onChange={(_, newValue) => handleTabChange(newValue)}
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
                  fontSize: '0.7rem',
                },
              },
            },
          }}
        >
          {tabConfigs.map((config) => (
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
