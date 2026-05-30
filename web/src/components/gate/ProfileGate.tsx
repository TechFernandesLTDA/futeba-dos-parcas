import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress, Box, Alert } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProfileComplete } from '../../hooks/useProfileComplete';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const { profileComplete, loading, refresh } = useProfileComplete();
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) { setTimedOut(false); return; }
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);

  const isOnboardingRoute = location.pathname.startsWith('/onboarding/');
  if (isOnboardingRoute) {
    return <>{children}</>;
  }

  if (!firebaseUser) {
    return <>{children}</>;
  }

  if (loading && !timedOut) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (loading && timedOut) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh', p: 2 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={refresh}>{t('common.retry')}</Button>
        }>
          {t('profile.gate.loadError', 'Não foi possível verificar seu perfil. Tente novamente.')}
        </Alert>
      </Box>
    );
  }

  if (profileComplete === false) {
    return (
      <Dialog
        open={true}
        aria-modal="true"
        role="dialog"
        aria-labelledby="profile-gate-title"
        disableEscapeKeyDown
        onClose={() => {}}
      >
        <DialogTitle id="profile-gate-title">{t('profile.gate.title')}</DialogTitle>
        <DialogContent>
          <Typography>{t('profile.gate.message')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            onClick={() => navigate(firebaseUser?.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone')}
          >
            {t('profile.gate.action')}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return <>{children}</>;
}
