import { useState } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  Avatar,
  Chip,
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
  DeleteForever as DeleteIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { FeedbackDialog } from '../../components/feedback/FeedbackDialog';

export const AboutScreen: React.FC = () => {
  useDocumentTitle('Sobre');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const goBack = useNavigateBack('/');
  const theme = useTheme();
  const { user } = useAuth();

  // Versão e build lidos em build time via Vite define (package.json + CI run number).
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const buildNumber = import.meta.env.VITE_APP_BUILD ?? 'dev';

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
          <IconButton onClick={goBack} aria-label="Voltar">
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
            <ListItemButton onClick={() => window.open('/terms_of_service.html', '_blank')}>
              <ListItemIcon>
                <TermsIcon />
              </ListItemIcon>
              <ListItemText primary="Termos de Uso" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('/privacy_policy.html', '_blank')}>
              <ListItemIcon>
                <PrivacyIcon />
              </ListItemIcon>
              <ListItemText primary="Política de Privacidade" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('/child_safety.html', '_blank')}>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Segurança Infantil" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('/delete_account.html', '_blank')}>
              <ListItemIcon>
                <DeleteIcon />
              </ListItemIcon>
              <ListItemText primary="Excluir Conta" secondary="Como solicitar exclusão da conta" />
            </ListItemButton>
          </List>
        </Card>

        <Card sx={{ mb: 2 }}>
          <List disablePadding aria-label="Suporte e contato">
            <ListItemButton>
              <ListItemIcon>
                <HelpIcon />
              </ListItemIcon>
              <ListItemText primary="Central de Ajuda" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => setFeedbackOpen(true)}>
              <ListItemIcon>
                <BugIcon />
              </ListItemIcon>
              <ListItemText primary="Reportar Problema" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('mailto:techfernandesltda@gmail.com', '_blank')}>
              <ListItemIcon>
                <EmailIcon />
              </ListItemIcon>
              <ListItemText primary="Contato" secondary="techfernandesltda@gmail.com" />
            </ListItemButton>
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
            © 2024-2026 Futeba dos Parças
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
            Feito com ❤️ para os amantes do futebol
          </Typography>
        </Box>
      </Container>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </Box>
  );
};
