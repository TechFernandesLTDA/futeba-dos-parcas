import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress, Box } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useProfileComplete } from '../../hooks/useProfileComplete';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const { profileComplete, loading } = useProfileComplete();
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const isOnboardingRoute = location.pathname.startsWith('/onboarding/');
  if (isOnboardingRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100dvh' }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (profileComplete === false) {
    return (
      <Dialog
        open={true}
        aria-modal="true"
        role="dialog"
        disableEscapeKeyDown
        onClose={() => {}}
      >
        <DialogTitle>{t('profile.gate.title')}</DialogTitle>
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
