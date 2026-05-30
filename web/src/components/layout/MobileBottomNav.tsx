import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  useScrollTrigger,
  Slide,
  Box,
} from '@mui/material';
import { pageSpacing } from '../../theme/pageTokens';
import { NAV_ITEMS } from '../../config/navItems';

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.showInBottomNav);

export const MobileBottomNav = React.memo(function MobileBottomNav({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 0,
  });

  const activeValue = React.useMemo(() => {
    const path = location.pathname;
    const search = location.search;

    if ((path === '/' || path === '') && !search.includes('tab=')) return 0;
    if (path === '/' && search.includes('tab=')) {
      const tab = new URLSearchParams(search).get('tab');
      const idx = BOTTOM_NAV_ITEMS.findIndex((item) => item.path === `/?tab=${tab}`);
      if (idx >= 0) return idx;
    }

    for (let i = 0; i < BOTTOM_NAV_ITEMS.length; i++) {
      for (const matchPath of BOTTOM_NAV_ITEMS[i].matchPaths) {
        if (path.startsWith(matchPath)) return i;
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
              navigate(BOTTOM_NAV_ITEMS[newValue].path);
            }}
            showLabels
            sx={{
              width: '100%',
              maxWidth: 480,
              height: pageSpacing.bottomBarHeight,
              '& .MuiBottomNavigationAction-root': {
                minWidth: 44,
                minHeight: 44,
                padding: '6px 0',
              },
              '& .MuiBottomNavigationAction-label': {
                fontSize: '0.75rem',
                '&.Mui-selected': {
                  fontSize: '0.75rem',
                },
              },
            }}
          >
            {BOTTOM_NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.labelKey}
                label={t(item.labelKey)}
                icon={item.icon}
                aria-label={t(item.labelKey)}
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
      </Slide>
      <Box sx={{ display: { xs: 'block', md: 'none' }, height: `calc(${pageSpacing.bottomBarHeight}px + env(safe-area-inset-bottom, 0px))` }} />
    </>
  );
});

export default MobileBottomNav;
