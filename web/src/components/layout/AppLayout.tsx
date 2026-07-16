import { Box } from '@mui/material';
import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppSidebar } from './AppSidebar';
import { ConnectionStatus, useOnlineStatus } from '../common/ConnectionStatus';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { BreadcrumbOverrideContext, useAutoBreadcrumbs } from '../../hooks/useAutoBreadcrumbs';

function AppBreadcrumbsWrapper({ hidden }: { hidden: boolean }) {
  const items = useAutoBreadcrumbs();
  if (hidden) return null;
  return <AppBreadcrumbs items={items} />;
}

export function AppLayout({ children }: { children?: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const { t } = useTranslation();
  const [breadcrumbOverrideCount, setBreadcrumbOverrideCount] = useState(0);
  const registerBreadcrumbOverride = useCallback(() => {
    setBreadcrumbOverrideCount((count) => count + 1);
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      setBreadcrumbOverrideCount((count) => Math.max(0, count - 1));
    };
  }, []);

  return (
    <BreadcrumbOverrideContext.Provider value={registerBreadcrumbOverride}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          minHeight: '100dvh',
          width: '100%',
        }}
      >
        <Box
          component="nav"
          role="navigation"
          aria-label={t('a11y.mainMenu')}
          sx={{ display: 'flex', flexShrink: 0 }}
        >
          <AppSidebar />
        </Box>
        <Box
          component="main"
          role="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            minHeight: { xs: '100dvh', md: 0 },
            height: { md: '100dvh' },
          }}
        >
          <ConnectionStatus isOnline={isOnline} />
          <AppBreadcrumbsWrapper hidden={breadcrumbOverrideCount > 0} />
          {children ?? <Outlet />}
        </Box>
      </Box>
    </BreadcrumbOverrideContext.Provider>
  );
}
