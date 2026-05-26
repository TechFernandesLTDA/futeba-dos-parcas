import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { ConnectionStatus, useOnlineStatus } from '../common/ConnectionStatus';
import { AppBreadcrumbs } from './AppBreadcrumbs';
import { useAutoBreadcrumbs } from '../../hooks/useAutoBreadcrumbs';

function AppBreadcrumbsWrapper() {
  const items = useAutoBreadcrumbs();
  return <AppBreadcrumbs items={items} />;
}

export function AppLayout() {
  const isOnline = useOnlineStatus();

  return (
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
        aria-label="Menu principal"
        sx={{ display: 'flex', flexShrink: 0 }}
      >
        <AppSidebar />
      </Box>
      <Box
        component="main"
        role="main"
        id="main-content"
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          minHeight: '100dvh',
        }}
      >
        <ConnectionStatus isOnline={isOnline} />
        <AppBreadcrumbsWrapper />
        <Outlet />
      </Box>
    </Box>
  );
}
