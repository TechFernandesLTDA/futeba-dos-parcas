import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, BottomNavigation, BottomNavigationAction, Paper, Snackbar, Button } from '@mui/material';
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Conteúdo principal com scroll */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          pb: '72px', // Espaço para a bottom nav
        }}
      >
        {tabValue === 0 && <HomeTab />}
        {tabValue === 1 && <GamesTab />}
        {tabValue === 2 && <GroupsTab />}
        {tabValue === 3 && <RankingsTab />}
        {tabValue === 4 && <ProfileTab />}
      </Box>

      {/* Bottom Navigation - 5 botões (igual ao Android) */}
      {/* Em sm+ respeita MobileShell (480px centrado) */}
      <Paper
        sx={{
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
          onChange={(_, newValue) => setSearchParams({ tab: newValue.toString() })}
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
        sx={{ bottom: 80 }}
      />
    </Box>
  );
}
