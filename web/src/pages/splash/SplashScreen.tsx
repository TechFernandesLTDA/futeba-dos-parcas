import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, useTheme, alpha } from '@mui/material';
import { SportsSoccer as SoccerIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';

export const SplashScreen: React.FC = () => {
  useDocumentTitle();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { firebaseUser, loading, error } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (error) {
      navigate('/login');
      return;
    }

    const timer = setTimeout(() => {
      if (firebaseUser) {
        const hasCompletedSetup = localStorage.getItem('profileSetupComplete');
        const hasSeenGuide = localStorage.getItem('appGuideShown');
        
        if (!hasCompletedSetup) {
          navigate('/profile/setup');
        } else if (!hasSeenGuide) {
          navigate('/guide');
        } else {
          navigate('/');
        }
      } else {
        navigate('/welcome');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [firebaseUser, loading, navigate, error]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.common.white, 0.2),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': { transform: 'scale(1)', opacity: 1 },
            '50%': { transform: 'scale(1.05)', opacity: 0.8 },
            '100%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
      >
        <SoccerIcon sx={{ fontSize: 64, color: 'primary.contrastText' }} />
      </Box>

      <Typography variant="h4" fontWeight={700} color="primary.contrastText" gutterBottom>
        {t('common.appName')}
      </Typography>

      <Typography variant="body1" sx={{ color: alpha(theme.palette.primary.contrastText, 0.8), mb: 4 }}>
        Organize suas peladas
      </Typography>

      <CircularProgress sx={{ color: 'primary.contrastText' }} />
    </Box>
  );
};
