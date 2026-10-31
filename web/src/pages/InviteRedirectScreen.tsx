import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export const InviteRedirectScreen: React.FC = () => {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    try {
      sessionStorage.setItem('inviteCode', code || '');
    } catch (error) {
      console.warn('Failed to save invite code to sessionStorage:', error);
    }

    if (!firebaseUser) {
      navigate(`/register?invite=${code}`, { replace: true });
      return;
    }

    navigate('/', { replace: true });
  }, [code, firebaseUser, loading, navigate]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50dvh' }}>
      <CircularProgress size={40} />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        {t('welcome.processingInvite')}
      </Typography>
    </Box>
  );
};
