import { useState } from 'react';
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
  Button,
  useTheme,
  alpha,
  Chip,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Security as SecurityIcon,
  BugReport as BugIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';

export const ThemeSettingsScreen: React.FC = () => {
  useDocumentTitle('Tema');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { mode, toggleTheme } = useThemeContext();

  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

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
          <List disablePadding>
            <ListItem>
              <ListItemIcon>
                <NotificationsIcon />
              </ListItemIcon>
              <ListItemText
                primary="Notificações Push"
                secondary="Receber notificações no navegador"
              />
              <Switch
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
            </ListItem>
            <Divider />
            <ListItem>
              <ListItemIcon>
                <LanguageIcon />
              </ListItemIcon>
              <ListItemText
                primary="Notificações por Email"
                secondary="Receber atualizações por email"
              />
              <Switch
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
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
