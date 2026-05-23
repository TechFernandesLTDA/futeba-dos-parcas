import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function AppLayout() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        minHeight: '100dvh',
        width: '100%',
      }}
    >
      <Box component="nav" role="navigation" aria-label="Menu principal">
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
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
