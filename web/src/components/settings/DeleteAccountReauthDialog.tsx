import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface DeleteAccountReauthDialogProps {
  open: boolean;
  /** true enquanto reautentica ou repete a exclusão. */
  busy: boolean;
  errorMessage: string | null;
  methods: { password: boolean; google: boolean };
  onSubmitPassword: (password: string) => void;
  onGoogle: () => void;
  onCancel: () => void;
}

/**
 * Pede reautenticação (senha e/ou Google) quando a callable `deleteAccount`
 * responde `requires-recent-login` (#4391).
 */
export const DeleteAccountReauthDialog: React.FC<DeleteAccountReauthDialogProps> = ({
  open,
  busy,
  errorMessage,
  methods,
  onSubmitPassword,
  onGoogle,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  // Não mantém a senha em memória depois de fechar o diálogo
  useEffect(() => {
    if (!open) setPassword('');
  }, [open]);

  const hasAnyMethod = methods.password || methods.google;

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onCancel()}
      fullWidth
      maxWidth="sm"
      aria-labelledby="delete-reauth-title"
      aria-describedby="delete-reauth-desc"
    >
      <DialogTitle id="delete-reauth-title">{t('settings.deleteReauthTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText id="delete-reauth-desc" sx={{ mb: 2 }}>
          {hasAnyMethod ? t('settings.deleteReauthDesc') : t('settings.deleteReauthUnavailable')}
        </DialogContentText>
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }} role="alert">
            {errorMessage}
          </Alert>
        )}
        {methods.password && (
          <TextField
            autoFocus
            fullWidth
            type="password"
            autoComplete="current-password"
            label={t('settings.deletePasswordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            inputProps={{ 'aria-label': t('settings.deletePasswordAria'), maxLength: 128 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password && !busy) onSubmitPassword(password);
            }}
          />
        )}
        {methods.google && (
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={onGoogle}
            disabled={busy}
            sx={{ mt: methods.password ? 2 : 0 }}
            aria-label={t('settings.deleteReauthGoogleAria')}
          >
            {t('settings.deleteReauthGoogle')}
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        {methods.password && (
          <Button
            onClick={() => onSubmitPassword(password)}
            color="error"
            variant="contained"
            disabled={busy || !password}
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            aria-label={t('settings.deleteReauthConfirmAria')}
          >
            {busy ? t('common.deleting') : t('settings.deleteReauthConfirm')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
