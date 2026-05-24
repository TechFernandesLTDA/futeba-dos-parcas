import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  CircularProgress,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Person as PersonIcon,
  Palette as PaletteIcon,
  Info as InfoIcon,
  EmojiEvents as TrophyIcon,
  RateReview as FeedbackIcon,
  DeleteForever as DeleteForeverIcon,
  Notifications as NotificationsIcon,
  NewReleases as NewReleasesIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useTranslation } from 'react-i18next';
import { FeedbackDialog } from '../../components/feedback/FeedbackDialog';
import { deleteAccount } from '../../services/cloudFunctions';
import { getFunctionErrorMessage } from '../../utils/firebaseErrors';
import { TeamBadge } from '../../components/team/TeamBadge';

const logger = createLogger('SettingsScreen');

interface Settings {
  notifications: boolean;
  emailNotifications: boolean;
  gameReminders: boolean;
}

export const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const goBack = useNavigateBack('/');
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const showErrorRef = useRef(showError);
  showErrorRef.current = showError;
  const { t } = useTranslation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Fluxo de exclusão de conta — LGPD art. 18
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    emailNotifications: true,
    gameReminders: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      // FIX C1: era `doc(db, 'users', uid, 'settings')` com 3 segments —
      // path inválido pra doc reference (Firebase v9 throwa). Silent fail
      // em prod desde release inicial: try/catch swallow → defaults useState.
      // Agora usa subcollection `users/{uid}/preferences/notifications` (4 segments).
      const settingsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        setSettings(snakeToCamel(docSnap.data()) as Settings);
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
      showError(t('settings.loadError'));
      showErrorRef.current(t('settings.loadError'));
    }
    setLoading(false);
  }, [user, showError, t]);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user, loadSettings]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // FIX C1: mesma correção do loadSettings — subcollection 4 segments.
      const settingsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      await setDoc(settingsRef, {
        notifications: settings.notifications,
        email_notifications: settings.emailNotifications,
        game_reminders: settings.gameReminders,
        updated_at: serverTimestamp(),
      }, { merge: true });
      showSuccess(t('settings.saveSuccess'));
    } catch (error) {
      logger.error('Error saving settings:', error);
      showError(t('settings.saveError'));
    }
    setSaving(false);
  };

  // Abre o passo 2 do fluxo de exclusão, fechando o passo 1
  const handleDeleteStep1Continue = () => {
    setDeleteStep1Open(false);
    setDeleteEmailInput('');
    setDeleteStep2Open(true);
  };

  // Executa a exclusão definitiva da conta via Cloud Function
  const handleDeleteAccountConfirm = async () => {
    if (!user || deleteEmailInput.trim().toLowerCase() !== user.email?.toLowerCase()) return;
    setDeleting(true);
    try {
      await deleteAccount();
      // Limpar cache e encerrar sessão — a CF já apagou os dados no backend
      await logout();
      navigate('/login', { replace: true });
      showSuccess(t('settings.deleteAccountSuccess'));
    } catch (err) {
      logger.error('Error deleting account:', err);
      showError(getFunctionErrorMessage(err, 'deleteAccount', t('settings.deleteAccountError')));
    } finally {
      setDeleting(false);
      setDeleteStep2Open(false);
    }
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
            {t('settings.title')}
          </Typography>
        </Box>
      </Box>

      <Container maxWidth={isMd ? 'md' : 'sm'} sx={{ py: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <PersonIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {user?.name || t('settings.defaultUserName')}
                      </Typography>
                      <TeamBadge teamId={user?.favoriteTeam} size={24} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {user?.email}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  {t('nav.notifications')}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.notifications}
                      onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                    />
                  }
                  label={t('settings.pushNotifications')}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.emailNotifications}
                      onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                    />
                  }
                  label={t('settings.emailNotifications')}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.gameReminders}
                      onChange={(e) => setSettings({ ...settings, gameReminders: e.target.checked })}
                    />
                  }
                  label={t('settings.gameReminders')}
                />
              </CardContent>
            </Card>

            <Card sx={{ mb: 2 }}>
              <List disablePadding aria-label={t('settings.configOptionsAria')}>
                <ListItemButton onClick={() => navigate('/settings/theme')}>
                  <ListItemIcon>
                    <PaletteIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('theme.title')} secondary={t('settings.customizeAppearance')} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => navigate('/settings/notifications')}>
                  <ListItemIcon>
                    <NotificationsIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('nav.notifications')} secondary={t('settings.notificationsPrefs')} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => navigate('/settings/gamification')}>
                  <ListItemIcon>
                    <TrophyIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('settings.gamification')} secondary={t('settings.gamificationDesc')} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => navigate('/whats-new')}>
                  <ListItemIcon>
                    <NewReleasesIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('whatsNew.settingsTitle')} secondary={t('whatsNew.settingsDesc')} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => navigate('/about')}>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('settings.aboutApp')} secondary={t('settings.appVersion', { version: import.meta.env.VITE_APP_VERSION ?? 'dev' })} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => setFeedbackOpen(true)}>
                  <ListItemIcon>
                    <FeedbackIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('feedback.sendFeedback')} secondary={t('settings.feedbackDesc')} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => navigate('/settings/feedbacks')}>
                  <ListItemIcon>
                    <FeedbackIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('feedback.myFeedbacks')} secondary={t('settings.myFeedbacksDesc')} />
                </ListItemButton>
              </List>
            </Card>

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSaveSettings}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={20} /> : undefined}
              >
                {saving ? t('common.saving') : t('settings.saveSettings')}
              </Button>
            </Box>

            {/* Seção de exclusão de conta — LGPD art. 18 */}
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                color="error"
                fullWidth
                onClick={() => setDeleteStep1Open(true)}
                startIcon={<DeleteForeverIcon />}
                aria-label={t('settings.deleteAccountAria')}
              >
                {t('settings.deleteAccount')}
              </Button>
            </Box>
          </>
        )}
      </Container>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Dialog passo 1: aviso sobre o que será excluído */}
      <Dialog
        open={deleteStep1Open}
        onClose={() => setDeleteStep1Open(false)}
        fullWidth
        maxWidth="sm"
        role="alertdialog"
        aria-labelledby="delete-step1-title"
        aria-describedby="delete-step1-desc"
      >
        <DialogTitle id="delete-step1-title">{t('settings.deleteStep1Title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-step1-desc" sx={{ mb: 2 }}>
            {t('settings.deleteStep1Desc')}
          </DialogContentText>
          <Box component="ul" sx={{ pl: 3, m: 0, color: 'text.secondary' }}>
            {[
              t('settings.deleteItemProfile'),
              t('settings.deleteItemHistory'),
              t('settings.deleteItemXp'),
              t('settings.deleteItemPhotos'),
              t('settings.deleteItemPrefs'),
            ].map((item) => (
              <Box component="li" key={item} sx={{ mb: 0.5 }}>
                <DialogContentText component="span" variant="body2">{item}</DialogContentText>
              </Box>
            ))}
          </Box>
          <DialogContentText sx={{ mt: 2 }} color="error">
            {t('settings.deleteStep1Warning')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteStep1Open(false)} autoFocus>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteStep1Continue}
            color="error"
            variant="outlined"
            startIcon={<DeleteForeverIcon />}
          >
            {t('common.continue')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog passo 2: confirmar com email para evitar exclusão acidental */}
      <Dialog
        open={deleteStep2Open}
        onClose={() => !deleting && setDeleteStep2Open(false)}
        fullWidth
        maxWidth="sm"
        role="alertdialog"
        aria-labelledby="delete-step2-title"
        aria-describedby="delete-step2-desc"
      >
        <DialogTitle id="delete-step2-title" color="error">
          {t('settings.deleteStep2Title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-step2-desc" sx={{ mb: 2 }}>
            {t('settings.deleteStep2Desc', { email: user?.email })}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label={t('settings.deleteEmailLabel')}
            type="email"
            value={deleteEmailInput}
            onChange={(e) => setDeleteEmailInput(e.target.value)}
            disabled={deleting}
            aria-label={t('settings.deleteEmailAria')}
            inputProps={{ 'aria-describedby': 'delete-step2-desc' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteStep2Open(false)} disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteAccountConfirm}
            color="error"
            variant="contained"
            startIcon={<DeleteForeverIcon />}
            disabled={
              deleting ||
              deleteEmailInput.trim().toLowerCase() !== user?.email?.toLowerCase()
            }
            aria-label={t('settings.deleteConfirmAria')}
          >
            {deleting ? t('common.deleting') : t('settings.deleteConfirmBtn')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
