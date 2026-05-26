import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useScrollTrigger,
  Slide,
  Box,
} from '@mui/material';
import { pageSpacing } from '../../theme/pageTokens';
import {
  Home as HomeIcon,
  SportsSoccer as GamesIcon,
  People as GroupsIcon,
  EmojiEvents as LeagueIcon,
  Person as ProfileIcon,
} from '@mui/icons-material';

const NAV_ITEMS = [
  { label: 'Início', icon: <HomeIcon />, route: '/', matchRoutes: ['/'] },
  { label: 'Jogos', icon: <GamesIcon />, route: '/?tab=1', matchRoutes: ['/game/', '/games', '/public-games'] },
  { label: 'Grupos', icon: <GroupsIcon />, route: '/?tab=2', matchRoutes: ['/group/', '/groups'] },
  { label: 'Liga', icon: <LeagueIcon />, route: '/?tab=3', matchRoutes: ['/league', '/ranking'] },
  { label: 'Perfil', icon: <ProfileIcon />, route: '/?tab=4', matchRoutes: ['/profile', '/settings', '/statistics'] },
];

interface MobileBottomNavProps {
  children?: React.ReactNode;
}

export const MobileBottomNav = React.memo(function MobileBottomNav({ children }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on scroll down, show on scroll up
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  const activeValue = React.useMemo(() => {
    const path = location.pathname;
    const search = location.search;

    // Home exact match
    if ((path === '/' || path === '') && !search.includes('tab=')) return 0;
    // Tab-based navigation
    if (path === '/' && search.includes('tab=1')) return 1;
    if (path === '/' && search.includes('tab=2')) return 2;
    if (path === '/' && search.includes('tab=3')) return 3;
    if (path === '/' && search.includes('tab=4')) return 4;

    // Route matching
    for (let i = 0; i < NAV_ITEMS.length; i++) {
      for (const matchRoute of NAV_ITEMS[i].matchRoutes) {
        if (path.startsWith(matchRoute)) return i;
      }
    }

    return 0;
  }, [location.pathname, location.search]);

  return (
    <>
      {children}
      <Slide appear={false} direction="up" in={!trigger}>
        <Paper
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            pb: 'env(safe-area-inset-bottom, 0px)',
            zIndex: 1100,
            display: { xs: 'flex', md: 'none' },
            justifyContent: 'center',
          }}
          elevation={3}
        >
          <BottomNavigation
            value={activeValue}
            onChange={(_e, newValue) => {
              navigate(NAV_ITEMS[newValue].route);
            }}
            showLabels
            sx={{
              width: '100%',
              maxWidth: 480,
              height: 64,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 44,
                minHeight: 44,
                padding: '6px 0',
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.675rem',
                '&.Mui-selected': {
                  fontSize: '0.7rem',
                },
              },
            }}
          >
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.label}
                label={item.label}
                icon={item.icon}
                aria-label={item.label}
              />
            ))}
          </BottomNavigation>
        </Paper>
      </Slide>
      {/* Spacer to prevent content from being hidden behind the nav bar */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, height: `calc(${pageSpacing.bottomBarHeight}px + env(safe-area-inset-bottom, 0px))` }} />
    </>
  );
});

export default MobileBottomNav;
