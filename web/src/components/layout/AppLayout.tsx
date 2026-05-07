import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

/**
 * Layout global para rotas de detalhe e formulários.
 * - Mobile (xs/sm): renderiza apenas o conteúdo (sem sidebar) — MobileShell já trata
 * - Tablet (md): NavigationRail à esquerda + conteúdo
 * - Desktop (lg+): Drawer expandido à esquerda + conteúdo
 *
 * HomeScreen NÃO usa este layout (tem sidebar própria via tabs).
 */
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
      <AppSidebar />
      <Box
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
