import React, {useState} from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  Google as GoogleIcon,
  Lock as LockIcon,
  Phone as PhoneIcon,
  LinkOutlined as LinkIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import {useAuth} from '../../contexts/AuthContext';
import {useToast} from '../../contexts/ToastContext';
import {useTranslation} from 'react-i18next';
import {createLogger} from '../../utils/logger';
import {getAuthErrorMessage} from '../../utils/firebaseErrors';

const logger = createLogger('ConnectedAccounts');

// #3189: provedores de login que sabemos exibir (senha, Google, telefone).
const PROVIDER_META: Record<string, {labelKey: string; Icon: React.ElementType}> = {
  password: {labelKey: 'settings.connectedAccounts.providerPassword', Icon: LockIcon},
  'google.com': {labelKey: 'settings.connectedAccounts.providerGoogle', Icon: GoogleIcon},
  phone: {labelKey: 'settings.connectedAccounts.providerPhone', Icon: PhoneIcon},
};

/**
 * #3189: Seção "Contas conectadas" — lista os provedores de login vinculados
 * à conta atual e permite vincular/desvincular Google. Desvincular Google só
 * é permitido se restar um método primário (senha); telefone não conta.
 */
export const ConnectedAccounts: React.FC = () => {
  const {t} = useTranslation();
  const {firebaseUser, linkGoogleAccount, unlinkGoogleAccount} = useAuth();
  const {showSuccess, showError} = useToast();
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);

  const providers = firebaseUser?.providerData ?? [];
  const providerIds = providers.map((p) => p.providerId);
  const hasGoogle = providerIds.includes('google.com');
  const hasPassword = providerIds.includes('password');
  // Guard: só permite desvincular Google se sobrar senha (método primário).
  const canUnlinkGoogle = hasGoogle && hasPassword;

  const handleLink = async () => {
    setLinking(true);
    try {
      await linkGoogleAccount();
      showSuccess(t('settings.connectedAccounts.linkSuccess'));
    } catch (err) {
      logger.error('linkGoogleAccount falhou:', err);
      showError(getAuthErrorMessage(err, t('settings.connectedAccounts.linkError')));
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkConfirm = async () => {
    setConfirmUnlinkOpen(false);
    setUnlinking(true);
    try {
      await unlinkGoogleAccount();
      showSuccess(t('settings.connectedAccounts.unlinkSuccess'));
    } catch (err) {
      logger.error('unlinkGoogleAccount falhou:', err);
      const message = (err as Error)?.message || '';
      // Guard local de método primário — mensagem específica
      if (message === 'app/require-primary-method') {
        showError(t('settings.connectedAccounts.cannotUnlinkWithoutPrimary'));
      } else {
        showError(getAuthErrorMessage(err, t('settings.connectedAccounts.unlinkError')));
      }
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Card sx={{mb: 2}}>
      <CardContent>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1.5}}>
          <LinkIcon color="action" />
          <Typography variant="subtitle2" fontWeight="bold">
            {t('settings.connectedAccounts.title')}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
          {t('settings.connectedAccounts.subtitle')}
        </Typography>

        <List disablePadding aria-label={t('settings.connectedAccounts.title')}>
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider.providerId];
            const Icon = meta?.Icon ?? LinkIcon;
            const label = meta ? t(meta.labelKey) : provider.providerId;
            return (
              <ListItem
                key={provider.providerId}
                disableGutters
                secondaryAction={
                  <Chip
                    size="small"
                    color="success"
                    variant="outlined"
                    label={t('settings.connectedAccounts.connected')}
                  />
                }
              >
                <ListItemIcon sx={{minWidth: 36}}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={label}
                  secondary={provider.email || provider.phoneNumber || undefined}
                />
              </ListItem>
            );
          })}
        </List>

        <Box sx={{mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
          {!hasGoogle && (
            <Button
              variant="outlined"
              size="small"
              startIcon={linking ? <CircularProgress size={16} /> : <GoogleIcon />}
              onClick={handleLink}
              disabled={linking || unlinking}
            >
              {linking
                ? t('common.loading')
                : t('settings.connectedAccounts.linkGoogle')}
            </Button>
          )}
          {hasGoogle && (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={unlinking ? <CircularProgress size={16} /> : <LinkOffIcon />}
              onClick={() => setConfirmUnlinkOpen(true)}
              disabled={unlinking || linking || !canUnlinkGoogle}
              title={
                !canUnlinkGoogle
                  ? t('settings.connectedAccounts.cannotUnlinkWithoutPrimary')
                  : undefined
              }
            >
              {unlinking
                ? t('common.loading')
                : t('settings.connectedAccounts.unlinkGoogle')}
            </Button>
          )}
          {!canUnlinkGoogle && hasGoogle && (
            <Typography variant="caption" color="text.secondary" sx={{alignSelf: 'center'}}>
              {t('settings.connectedAccounts.cannotUnlinkWithoutPrimary')}
            </Typography>
          )}
        </Box>
      </CardContent>

      <Dialog
        open={confirmUnlinkOpen}
        onClose={() => setConfirmUnlinkOpen(false)}
        fullWidth
        maxWidth="xs"
        role="alertdialog"
        aria-labelledby="unlink-google-title"
        aria-describedby="unlink-google-desc"
      >
        <DialogTitle id="unlink-google-title">
          {t('settings.connectedAccounts.unlinkConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="unlink-google-desc">
            {t('settings.connectedAccounts.unlinkConfirmDesc')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmUnlinkOpen(false)} autoFocus>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUnlinkConfirm} color="error" variant="contained" startIcon={<LinkOffIcon />}>
            {t('settings.connectedAccounts.unlinkGoogle')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default ConnectedAccounts;
