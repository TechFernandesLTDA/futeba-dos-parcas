import { useState } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
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
  Security as SecurityIcon,
  Gavel as TermsIcon,
  PrivacyTip as PrivacyIcon,
  BugReport as BugIcon,
  Email as EmailIcon,
  Language as LanguageIcon,
  Smartphone as DeviceIcon,
  Storage as DataIcon,
  DeleteForever as DeleteIcon,
  SportsSoccer as SoccerIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { FeedbackDialog } from '../../components/feedback/FeedbackDialog';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useTranslation } from 'react-i18next';

export const AboutScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.about'));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const goBack = useNavigateBack();
  const theme = useTheme();
  const { user } = useAuth();

  // Versão e build lidos em build time via Vite define (package.json + CI run number).
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev';
  const buildNumber = import.meta.env.VITE_APP_BUILD ?? 'dev';

  const ua = navigator.userAgent;
  const browser = ua.includes('Firefox') ? 'Firefox' : ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : 'Desconhecido';

  return (
    <Box sx={{ pb: 4 }}>
      {/* #2174: header padronizado via ScreenHeader */}
      <ScreenHeader title="Sobre" onBack={goBack} />

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Card sx={{ mb: 2, textAlign: 'center' }}>
          <CardContent>
            <Avatar
              aria-label={t('a11y.logoWithBrand')}
              sx={{
                width: 80,
                height: 80,
                mx: 'auto',
                mb: 2,
                bgcolor: theme.palette.primary.main,
              }}
            >
              <SoccerIcon sx={{ fontSize: 40, color: theme.palette.primary.contrastText }} />
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
          <List disablePadding aria-label={t('a11y.legalLinks')}>
            <ListItemButton onClick={() => window.open('/terms_of_service.html', '_blank', 'noopener,noreferrer')}>
              <ListItemIcon>
                <TermsIcon />
              </ListItemIcon>
              <ListItemText primary="Termos de Uso" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('/privacy_policy.html', '_blank', 'noopener,noreferrer')}>
              <ListItemIcon>
                <PrivacyIcon />
              </ListItemIcon>
              <ListItemText primary="Política de Privacidade" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('/child_safety.html', '_blank', 'noopener,noreferrer')}>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Segurança Infantil" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('/delete_account.html', '_blank', 'noopener,noreferrer')}>
              <ListItemIcon>
                <DeleteIcon />
              </ListItemIcon>
              <ListItemText primary="Excluir Conta" secondary="Como solicitar exclusão da conta" />
            </ListItemButton>
          </List>
        </Card>

        <Card sx={{ mb: 2 }}>
          <List disablePadding aria-label={t('a11y.supportContact')}>
            <ListItemButton onClick={() => setFeedbackOpen(true)}>
              <ListItemIcon>
                <BugIcon />
              </ListItemIcon>
              <ListItemText primary="Reportar Problema" />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={() => window.open('mailto:techfernandesltda@gmail.com', '_blank', 'noopener,noreferrer')}>
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
            <List disablePadding dense aria-label={t('a11y.deviceInfo')}>
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
                <ListItemText primary="Navegador" secondary={browser} />
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
            {`© 2024-${new Date().getFullYear()} Futeba dos Parças`}
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
