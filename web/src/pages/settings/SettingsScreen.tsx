import { PageContainer } from '../../components/common/PageContainer';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigateBack } from '../../hooks/useNavigateBack';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
  Avatar,
  Alert,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Edit as EditIcon,
  Palette as PaletteIcon,
  Info as InfoIcon,
  EmojiEvents as TrophyIcon,
  RateReview as FeedbackIcon,
  DeleteForever as DeleteForeverIcon,
  Notifications as NotificationsIcon,
  NewReleases as NewReleasesIcon,
  RocketLaunch as RocketLaunchIcon,
} from '@mui/icons-material';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { snakeToCamel } from '../../utils/firestoreHelpers';
import { useToast } from '../../contexts/ToastContext';
import { createLogger } from '../../utils/logger';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { FeedbackDialog } from '../../components/feedback/FeedbackDialog';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { ErrorState } from '../../components/common/ErrorState';
import { ConnectedAccounts } from '../../components/settings/ConnectedAccounts';
import { DeleteAccountReauthDialog } from '../../components/settings/DeleteAccountReauthDialog';
import { DeleteAccountBlockedGroupsDialog } from '../../components/settings/DeleteAccountBlockedGroupsDialog';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import { TeamBadge } from '../../components/team/TeamBadge';
import { avatarSizes } from '../../theme/iconSizes';

const logger = createLogger('SettingsScreen');

interface Settings {
  notifications: boolean;
  emailNotifications: boolean;
  gameReminders: boolean;
}

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.settings'));
  const navigate = useNavigate();
  const goBack = useNavigateBack();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Fluxo de exclusão de conta — LGPD art. 18
  const [deleteStep1Open, setDeleteStep1Open] = useState(false);
  const [deleteStep2Open, setDeleteStep2Open] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const {
    status: deleteStatus,
    blockingGroups,
    errorMessage: deleteErrorMessage,
    reauthMethods,
    start: startDeleteAccount,
    reauthenticateWithPassword,
    reauthenticateWithGoogle,
    reset: resetDeleteAccount,
  } = useDeleteAccount();
  const deleting = deleteStatus === 'deleting';
  const reauthOpen = deleteStatus === 'needs-reauth' || deleteStatus === 'reauthenticating';

  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    emailNotifications: true,
    gameReminders: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    try {
      const settingsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
      const docSnap = await getDoc(settingsRef);
      if (docSnap.exists()) {
        setSettings(snakeToCamel(docSnap.data()) as Settings);
      }
    } catch (error) {
      logger.error('Error loading settings:', error);
      setError(t('settings.loadError'));
    }
    setLoading(false);
  }, [user, t]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const settingsRef = doc(db, 'users', user.id, 'preferences', 'notifications');
        const docSnap = await getDoc(settingsRef);
        if (cancelled) return;
        if (docSnap.exists()) {
          setSettings(snakeToCamel(docSnap.data()) as Settings);
        }
      } catch (error) {
        if (cancelled) return;
        logger.error('Error loading settings:', error);
        setError(t('settings.loadError'));
      }
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, t]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
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

  // Executa a exclusão definitiva da conta via Cloud Function (#4391).
  // O hook só desloga em caso de sucesso; erros mantêm a sessão.
  const handleDeleteAccountConfirm = async () => {
    if (!user || deleteEmailInput.trim().toLowerCase() !== user.email?.toLowerCase()) return;
    await startDeleteAccount();
  };

  const closeDeleteFlow = () => {
    resetDeleteAccount();
    setDeleteStep2Open(false);
  };

  return (
    <Box sx={{ pb: 4 }}>
      <ScreenHeader
        title={t('settings.title')}
        onBack={goBack}
        backAriaLabel={t('common.back')}
      />

      <PageContainer maxWidth="form">
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => { setError(null); loadSettings(); }}
          />
        ) : loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            <Card sx={{ mb: 2 }}>
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  flexDirection: { xs: 'column', sm: 'row' },
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
                  <Avatar
                    src={user?.photoUrl}
                    alt={user?.name || t('settings.defaultUserName')}
                    sx={{ width: avatarSizes.md, height: avatarSizes.md, bgcolor: 'primary.main' }}
                  >
                    {(user?.name || t('settings.defaultUserName')).charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {user?.name || t('settings.defaultUserName')}
                      </Typography>
                      <TeamBadge teamId={user?.favoriteTeam} size={24} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {user?.email}
                    </Typography>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => navigate('/profile/edit')}
                  sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }}
                >
                  {t('profile.editProfile')}
                </Button>
              </CardContent>
            </Card>

            {/* #3189: Contas conectadas — vincular/desvincular Google */}
            <ConnectedAccounts />

            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  {t('nav.notifications')}
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: 1,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.notifications}
                        onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
                      />
                    }
                    label={t('settings.pushNotifications')}
                    sx={{ m: 0, px: 1, minHeight: 48, border: 1, borderColor: 'divider', borderRadius: 2 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.emailNotifications}
                        onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                      />
                    }
                    label={t('settings.emailNotifications')}
                    sx={{ m: 0, px: 1, minHeight: 48, border: 1, borderColor: 'divider', borderRadius: 2 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.gameReminders}
                        onChange={(e) => setSettings({ ...settings, gameReminders: e.target.checked })}
                      />
                    }
                    label={t('settings.gameReminders')}
                    sx={{ m: 0, px: 1, minHeight: 48, border: 1, borderColor: 'divider', borderRadius: 2 }}
                  />
                </Box>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    onClick={handleSaveSettings}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={20} /> : undefined}
                    sx={{ minHeight: 48, width: { xs: '100%', sm: 'auto' } }}
                  >
                    {saving ? t('common.saving') : t('settings.saveSettings')}
                  </Button>
                </Box>
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
                <ListItemButton onClick={() => navigate('/guide')}>
                  <ListItemIcon>
                    <RocketLaunchIcon />
                  </ListItemIcon>
                  <ListItemText primary={t('settings.playerGuide')} secondary={t('settings.playerGuideDesc')} />
                </ListItemButton>
                <Divider />
                <ListItemButton onClick={() => navigate('/owner/onboarding')}>
                  <ListItemIcon>
                    <BusinessIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={t('settings.ownerOnboardingTitle')}
                    secondary={t('settings.ownerOnboardingDesc')}
                  />
                </ListItemButton>
                <Divider />
                {user?.role === 'ADMIN' && (
                  <>
                    <ListItemButton onClick={() => navigate('/settings/gamification')}>
                      <ListItemIcon>
                        <TrophyIcon />
                      </ListItemIcon>
                      <ListItemText primary={t('settings.gamificationTitle')} secondary={t('settings.gamificationDesc')} />
                    </ListItemButton>
                    <Divider />
                  </>
                )}
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
      </PageContainer>

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
        open={deleteStep2Open && (deleteStatus === 'idle' || deleteStatus === 'deleting' || deleteStatus === 'error')}
        onClose={() => !deleting && closeDeleteFlow()}
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
            inputProps={{ 'aria-describedby': 'delete-step2-desc', maxLength: 254 }}
          />
          {deleteStatus === 'error' && deleteErrorMessage && (
            <Alert severity="error" sx={{ mt: 2 }} role="alert">
              {deleteErrorMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteFlow} disabled={deleting}>
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

      {/* Reautenticação exigida pela callable (login com mais de 10 minutos) */}
      <DeleteAccountReauthDialog
        open={reauthOpen}
        busy={deleteStatus === 'reauthenticating'}
        errorMessage={deleteErrorMessage}
        methods={reauthMethods}
        onSubmitPassword={(password) => { void reauthenticateWithPassword(password); }}
        onGoogle={() => { void reauthenticateWithGoogle(); }}
        onCancel={closeDeleteFlow}
      />

      {/* Grupos de que o usuário é dono e que ainda têm outros membros */}
      <DeleteAccountBlockedGroupsDialog
        open={deleteStatus === 'blocked-groups'}
        groups={blockingGroups}
        onClose={closeDeleteFlow}
      />
    </Box>
  );
};
