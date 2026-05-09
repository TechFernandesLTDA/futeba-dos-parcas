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
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  Chip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  BrightnessAuto as SystemIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type SupportedLanguage } from '../../contexts';
import { syncLanguageToFirestore } from '../../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

export const ThemeSettingsScreen: React.FC = () => {
  useDocumentTitle('Tema');
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode, setMode } = useThemeContext();
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    if (user?.id) {
      syncLanguageToFirestore(user.id, lang);
    }
  };

  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const handleClearCache = () => {
    try {
      localStorage.clear();
      showSuccess('Cache limpo com sucesso');
    } catch {
      showError('Erro ao limpar cache');
    }
  };

  const handleSyncData = () => {
    window.location.reload();
  };

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
          <IconButton onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/', { replace: true }); } }} aria-label="Voltar">
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('common.appearance')}
          </Typography>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        {/* Seletor de tema com 3 opções: claro, escuro, sistema.
            Substituímos o Switch binário que estava acoplado ao toggleTheme
            (ciclo light→dark→system), causando dessincronização entre estado
            exibido e tema aplicado. ToggleButtonGroup + setMode resolve isso
            de forma direta e sem ambiguidade. */}
        <Card sx={{ mb: 2 }}>
          <List disablePadding>
            <ListItem>
              <ListItemIcon>
                {mode === 'dark' ? (
                  <DarkModeIcon />
                ) : mode === 'light' ? (
                  <LightModeIcon />
                ) : (
                  <SystemIcon />
                )}
              </ListItemIcon>
              <ListItemText
                primary="Tema"
                secondary={
                  mode === 'dark'
                    ? 'Modo escuro'
                    : mode === 'light'
                    ? 'Modo claro'
                    : 'Automático (sistema)'
                }
              />
            </ListItem>
            <ListItem sx={{ pt: 0, pb: 2 }}>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_event, newMode) => {
                  // Ignora clique no botão já selecionado (newMode seria null)
                  if (newMode !== null) setMode(newMode);
                }}
                aria-label="Seleção de tema"
                fullWidth
                size="small"
              >
                <ToggleButton value="light" aria-label="Tema claro">
                  <LightModeIcon sx={{ mr: 0.5 }} fontSize="small" />
                  Claro
                </ToggleButton>
                <ToggleButton value="system" aria-label="Tema do sistema">
                  <SystemIcon sx={{ mr: 0.5 }} fontSize="small" />
                  Sistema
                </ToggleButton>
                <ToggleButton value="dark" aria-label="Tema escuro">
                  <DarkModeIcon sx={{ mr: 0.5 }} fontSize="small" />
                  Escuro
                </ToggleButton>
              </ToggleButtonGroup>
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
              {t('settings.language')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('settings.languageDesc')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {(['pt-BR', 'en', 'es'] as SupportedLanguage[]).map((lang) => (
                <Chip
                  key={lang}
                  label={t(`common.${lang === 'pt-BR' ? 'portuguese' : lang === 'en' ? 'english' : 'spanish'}`)}
                  color={language === lang ? 'primary' : 'default'}
                  variant={language === lang ? 'filled' : 'outlined'}
                  onClick={() => handleLanguageChange(lang)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </CardContent>
        </Card>

        <Card>
          <List disablePadding>
            <ListItemButton onClick={handleClearCache}>
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
              <ListItemText
                primary="Limpar Cache"
                secondary="Remover dados armazenados localmente"
              />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={handleSyncData}>
              <ListItemIcon>
                <RefreshIcon />
              </ListItemIcon>
              <ListItemText
                primary="Sincronizar Dados"
                secondary="Forçar sincronização com servidor"
              />
            </ListItemButton>
          </List>
        </Card>
      </Container>
    </Box>
  );
};
