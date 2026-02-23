import { useState } from 'react';
import { Box, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  Person,
} from '@mui/icons-material';

import { HomeTab } from './tabs/HomeTab';
import { GamesTab } from './tabs/GamesTab';
import { GroupsTab } from './tabs/GroupsTab';
import { ProfileTab } from './tabs/ProfileTab';

export function HomeScreen() {
  const [tab, setTab] = useState(0);

  const tabs = [
    <HomeTab key="home" />,
    <GamesTab key="games" />,
    <GroupsTab key="groups" />,
    <ProfileTab key="profile" />,
  ];

  const tabConfigs = [
    { icon: <HomeIcon />, label: 'Início' },
    { icon: <SportsSoccer />, label: 'Jogos' },
    { icon: <Groups />, label: 'Grupos' },
    { icon: <Person />, label: 'Perfil' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, pb: 7, overflow: 'auto' }}>
        {tabs[tab]}
      </Box>

      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        }}
        elevation={3}
      >
        <BottomNavigation
          value={tab}
          onChange={(_, newValue) => setTab(newValue)}
          showLabels
          sx={{
            bgcolor: 'background.paper',
            height: 64,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
            },
          }}
        >
          {tabConfigs.map((config, index) => (
            <BottomNavigationAction
              key={index}
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
    </Box>
  );
}
