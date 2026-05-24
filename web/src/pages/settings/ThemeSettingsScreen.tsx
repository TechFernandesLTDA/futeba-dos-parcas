import { useState } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
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
  useMediaQuery,
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
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type SupportedLanguage } from '../../contexts';
import { syncLanguageToFirestore } from '../../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';

export const ThemeSettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('settings.theme.title'));
  const goBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { mode, setMode } = useThemeContext();
  const { language, setLanguage } = useLanguage();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();

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
      showSuccess(t('settings.theme.clearCacheSuccess'));
    } catch {
      showError(t('settings.theme.clearCacheError'));
    }
  };

  const handleSyncData = () => {
    // Invalida o cache do React Query para forçar refetch de todos os dados
    queryClient.invalidateQueries();
    showSuccess(t('settings.theme.syncDataSuccess'));
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
          <IconButton onClick={goBack} aria-label={t('common.back')}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>
            {t('common.appearance')}
          </Typography>
        </Box>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
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
                primary={t('settings.theme.title')}
                secondary={
                  mode === 'dark'
                    ? t('settings.theme.darkDesc')
                    : mode === 'light'
                    ? t('settings.theme.lightDesc')
                    : t('settings.theme.systemDesc')
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
                aria-label={t('settings.theme.selection')}
                fullWidth
                size="small"
              >
                <ToggleButton value="light" aria-label={t('theme.light')}>
                  <LightModeIcon sx={{ mr: 0.5 }} fontSize="small" />
                  {t('theme.light')}
                </ToggleButton>
                <ToggleButton value="system" aria-label={t('theme.system')}>
                  <SystemIcon sx={{ mr: 0.5 }} fontSize="small" />
                  {t('theme.system')}
                </ToggleButton>
                <ToggleButton value="dark" aria-label={t('theme.dark')}>
                  <DarkModeIcon sx={{ mr: 0.5 }} fontSize="small" />
                  {t('theme.dark')}
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
                primary={t('settings.theme.pushNotifications')}
                secondary={t('settings.theme.pushNotificationsDesc')}
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
                primary={t('settings.theme.emailNotifications')}
                secondary={t('settings.theme.emailNotificationsDesc')}
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
                primary={t('settings.theme.clearCache')}
                secondary={t('settings.theme.clearCacheDesc')}
              />
            </ListItemButton>
            <Divider />
            <ListItemButton onClick={handleSyncData}>
              <ListItemIcon>
                <RefreshIcon />
              </ListItemIcon>
              <ListItemText
                primary={t('settings.theme.syncData')}
                secondary={t('settings.theme.syncDataDesc')}
              />
            </ListItemButton>
          </List>
        </Card>
      </Container>
    </Box>
  );
};
