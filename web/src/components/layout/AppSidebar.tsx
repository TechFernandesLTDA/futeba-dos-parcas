import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tooltip,
} from '@mui/material';
import {
  Home as HomeIcon,
  SportsSoccer,
  Groups,
  EmojiEvents,
  Person,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const RAIL_WIDTH = 80;
const DRAWER_WIDTH = 240;

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  matchPaths?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { icon: <HomeIcon />, label: 'Início', path: '/?tab=0', matchPaths: ['/'] },
  { icon: <SportsSoccer />, label: 'Jogos', path: '/?tab=1', matchPaths: ['/games', '/game'] },
  { icon: <Groups />, label: 'Grupos', path: '/?tab=2', matchPaths: ['/groups', '/group'] },
  { icon: <EmojiEvents />, label: 'Liga', path: '/?tab=3', matchPaths: ['/ranking', '/league'] },
  { icon: <Person />, label: 'Perfil', path: '/?tab=4', matchPaths: ['/profile'] },
];

function isItemActive(item: NavItem, currentPath: string, currentSearch: string): boolean {
  if (currentPath === '/') {
    const tab = new URLSearchParams(currentSearch).get('tab') || '0';
    return item.path === `/?tab=${tab}`;
  }
  return item.matchPaths?.some((mp) => currentPath.startsWith(mp)) ?? false;
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
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
        <Box
          sx={{ p: 1.5, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}
          onClick={() => navigate('/')}
          role="link"
          aria-label="Ir para Início"
        >
          <SportsSoccer sx={{ color: 'primary.main', fontSize: 32 }} />
        </Box>
        <List sx={{ pt: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search);
            return (
              <Tooltip key={item.label} title={item.label} placement="right">
                <ListItemButton
                  selected={active}
                  onClick={() => navigate(item.path)}
                  sx={{
                    flexDirection: 'column',
                    py: 1.5,
                    '&.Mui-selected': {
                      bgcolor: 'action.selected',
                      '& .MuiListItemIcon-root': { color: 'primary.main' },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', mb: 0.5 }}>
                    {item.icon}
                  </ListItemIcon>
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: active ? 600 : 400,
                      color: active ? 'primary.main' : 'text.secondary',
                    }}
                  >
                    {item.label}
                  </Typography>
                </ListItemButton>
              </Tooltip>
            );
          })}
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
        <Box
          sx={{
            p: 2,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
          onClick={() => navigate('/')}
          role="link"
          aria-label="Ir para Início"
        >
          <SportsSoccer sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h6" fontWeight={700} color="primary.main">
            Futeba dos Parças
          </Typography>
        </Box>
        <List>
          {NAV_ITEMS.map((item) => {
            const active = isItemActive(item, location.pathname, location.search);
            return (
              <ListItemButton
                key={item.label}
                selected={active}
                onClick={() => navigate(item.path)}
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
                <ListItemIcon sx={{ color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </>
  );
}
