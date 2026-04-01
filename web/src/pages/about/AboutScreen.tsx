import { useNavigate } from 'react-router-dom';
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
  useTheme,
  Avatar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Security as SecurityIcon,
  Gavel as TermsIcon,
  PrivacyTip as PrivacyIcon,
  Help as HelpIcon,
  BugReport as BugIcon,
  Email as EmailIcon,
  Language as LanguageIcon,
  Smartphone as DeviceIcon,
  Storage as DataIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const AboutScreen: React.FC = () => {
  useDocumentTitle('Sobre');
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();

  const appVersion = '1.10.7';
  const buildNumber = '30';

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
            Sobre
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, textAlign: 'center' }}>
          <CardContent>
            <Avatar
              aria-label="Logo do Futeba dos Parças"
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 2,
                bgcolor: theme.palette.primary.main,
                fontSize: 40,
              }}
            >
              ⚽
            </Avatar>
            <Typography variant="h5" fontWeight={700}>
              Futeba dos Parças
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Organize suas peladas com os amigos
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Chip label={`v${appVersion} (${buildNumber})`} size="small" />
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <List disablePadding aria-label="Links legais">
            <ListItem button onClick={() => window.open('https://futebadosparcas.web.app/terms_of_service.html', '_blank')}>
              <ListItemIcon>
                <TermsIcon />
              </ListItemIcon>
              <ListItemText primary="Termos de Uso" />
            </ListItem>
            <Divider />
            <ListItem button onClick={() => window.open('https://futebadosparcas.web.app/privacy_policy.html', '_blank')}>
              <ListItemIcon>
                <PrivacyIcon />
              </ListItemIcon>
              <ListItemText primary="Política de Privacidade" />
            </ListItem>
            <Divider />
            <ListItem button onClick={() => window.open('https://futebadosparcas.web.app/child_safety.html', '_blank')}>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Segurança Infantil" />
            </ListItem>
          </List>
        </Card>

        <Card sx={{ mb: 2 }}>
          <List disablePadding aria-label="Suporte e contato">
            <ListItem button>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText primary="Central de Ajuda" />
            </ListItem>
            <Divider />
            <ListItem button>
              <ListItemIcon>
                <BugIcon />
              </ListItemIcon>
              <ListItemText primary="Reportar Problema" />
            </ListItem>
            <Divider />
            <ListItem button onClick={() => window.open('mailto:suporte@futebadosparcas.com.br', '_blank')}>
              <ListItemIcon>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText primary="Contato" secondary="suporte@futebadosparcas.com.br" />
            </ListItem>
          </List>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Informações do Dispositivo
            </Typography>
            <List disablePadding dense aria-label="Informações do dispositivo">
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DeviceIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Plataforma" secondary="Web" />
              </ListItem>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <LanguageIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Navegador" secondary={navigator.userAgent.split(' ')[0]} />
              </ListItem>
              <ListItem sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <DataIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Usuário" secondary={user?.email || 'Não logado'} />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="caption" color="text.disabled">
            © 2024 Futeba dos Parças
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
            Feito com ❤️ para os amantes do futebol
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

import { Chip } from '@mui/material';
