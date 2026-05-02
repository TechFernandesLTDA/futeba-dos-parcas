import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  useTheme,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useThemeContext } from '../../contexts/ThemeContext';

export const ThemeSettingsScreen: React.FC = () => {
  useDocumentTitle('Tema');
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode, toggleTheme } = useThemeContext();

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          zIndex: 10,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
          <IconButton onClick={() => navigate(-1)} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            Aparência
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2 }}>
          <List disablePadding>
            <ListItem>
              <ListItemIcon>
                {mode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
              </ListItemIcon>
              <ListItemText
                primary="Tema Escuro"
                secondary="Ativar modo escuro"
              />
              <Switch
                checked={mode === 'dark'}
                onChange={toggleTheme}
              />
            </ListItem>
          </List>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Idioma
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label="Português" color="primary" />
              <Chip label="English" variant="outlined" />
              <Chip label="Español" variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <List disablePadding>
            <ListItem button>
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText
                primary="Limpar Cache"
                secondary="Remover dados armazenados localmente"
              />
            </ListItem>
            <Divider />
            <ListItem button>
              <ListItemIcon>
                <RefreshIcon />
              </ListItemIcon>
              <ListItemText
                primary="Sincronizar Dados"
                secondary="Forçar sincronização com servidor"
              />
            </ListItem>
          </List>
        </Card>
      </Container>
    </Box>
  );
};
