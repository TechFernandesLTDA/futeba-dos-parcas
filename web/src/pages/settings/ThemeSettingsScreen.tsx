import { useCallback } from 'react';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
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
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  useMediaQuery,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  BrightnessAuto as SystemIcon,
  Contrast as OledIcon,
  Notifications as NotificationsIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme as useThemeContext } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type SupportedLanguage } from '../../contexts';
import { syncLanguageToFirestore } from '../../contexts/LanguageContext';
import type { ThemeMode } from '../../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { useNotificationSettings } from '../../hooks/useNotificationSettings';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { ScreenHeader } from '../../components/common/ScreenHeader';

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

  const { settings, setPreference, loading: notifLoading, error: notifError } = useNotificationSettings(user?.id);
  const [emailNotifications, setEmailNotifications] = useLocalStorage('emailNotifications', true);

  const handleLanguageChange = useCallback((lang: SupportedLanguage) => {
    setLanguage(lang);
    if (user?.id) {
      syncLanguageToFirestore(user.id, lang).catch(() => {});
    }
  }, [setLanguage, user?.id]);

  const handleClearCache = useCallback(() => {
    try {
      const keysToKeep: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('firebase:authUser:')) {
          keysToKeep.push(key);
        }
      }
      const preserved: Record<string, string> = {};
      keysToKeep.forEach((key) => {
        const val = localStorage.getItem(key);
        if (val !== null) preserved[key] = val;
      });
      localStorage.clear();
      Object.entries(preserved).forEach(([key, val]) => localStorage.setItem(key, val));
      showSuccess(t('settings.theme.clearCacheSuccess'));
    } catch {
      showError(t('settings.theme.clearCacheError'));
    }
  }, [showSuccess, showError, t]);

  const handleSyncData = useCallback(() => {
    queryClient.invalidateQueries();
    showSuccess(t('settings.theme.syncDataSuccess'));
  }, [queryClient, showSuccess, t]);

  const handleThemeModeChange = useCallback((_event: React.MouseEvent<HTMLElement>, newMode: ThemeMode | null) => {
    if (newMode !== null) setMode(newMode);
  }, [setMode]);

  const handlePushEnabledChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPreference('pushEnabled', e.target.checked);
  }, [setPreference]);

  const handleEmailNotificationsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmailNotifications(e.target.checked);
  }, [setEmailNotifications]);

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title={t('common.appearance')}
        onBack={goBack}
      />

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {notifError ? (
          <Alert severity="error" sx={{ mb: 2 }}>{notifError}</Alert>
        ) : notifLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : null}
        {/* Seletor de tema com 3 opções: claro, escuro, sistema.
            Substituímos o Switch binário que estava acoplado ao toggleTheme
            (ciclo light→dark→system), causando dessincronização entre estado
            exibido e tema aplicado. ToggleButtonGroup + setMode resolve isso
            de forma direta e sem ambiguidade. */}
        <Card sx={{ mb: 2 }}>
          <List disablePadding>
            <ListItem>
              <ListItemIcon>
                {mode === 'oled' ? (
                  <OledIcon />
                ) : mode === 'dark' ? (
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
                  mode === 'oled'
                    ? t('settings.theme.oledDesc')
                    : mode === 'dark'
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
                onChange={handleThemeModeChange}
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
                <ToggleButton value="oled" aria-label={t('theme.oled')}>
                  <OledIcon sx={{ mr: 0.5 }} fontSize="small" />
                  {t('theme.oled')}
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
                checked={settings.pushEnabled}
                onChange={handlePushEnabledChange}
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
                onChange={handleEmailNotificationsChange}
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
