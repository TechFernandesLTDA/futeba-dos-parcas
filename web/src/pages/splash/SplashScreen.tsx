import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, useTheme, alpha } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '../../components/common/AppLogo';

const PROFILE_SETUP_COMPLETE_KEY = 'profileSetupComplete';
const APP_GUIDE_SHOWN_KEY = 'appGuideShown';

function readLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch (error) {
    console.warn('Failed to read onboarding flags from localStorage:', error);
    return false;
  }
}

export const SplashScreen: React.FC = () => {
  useDocumentTitle();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { firebaseUser, loading, error } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (error && !firebaseUser) {
      navigate('/login');
      return;
    }

    const timer = setTimeout(() => {
      if (firebaseUser) {
        const hasCompletedSetup = readLocalFlag(`${PROFILE_SETUP_COMPLETE_KEY}:${firebaseUser.uid}`);
        const hasSeenGuide = readLocalFlag(`${APP_GUIDE_SHOWN_KEY}:${firebaseUser.uid}`);
        
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
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
      }}
    >
      {/* Logo padronizada — AppLogo (PNG canônico do app) com pulse */}
      <AppLogo
        size="xlarge"
        shape="circle"
        alt={t('alt.logo')}
        sx={{
          mb: 3,
          bgcolor: alpha(theme.palette.common.white, 0.2),
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': { transform: 'scale(1)', opacity: 1 },
            '50%': { transform: 'scale(1.05)', opacity: 0.8 },
            '100%': { transform: 'scale(1)', opacity: 1 },
          },
        }}
      />

      <Typography variant="h4" fontWeight={700} color="primary.contrastText" gutterBottom>
        {t('common.appName')}
      </Typography>

      <Typography variant="body1" sx={{ color: alpha(theme.palette.primary.contrastText, 0.8), mb: 4 }}>
        {t('splash.tagline')}
      </Typography>

      <CircularProgress sx={{ color: 'primary.contrastText' }} />
    </Box>
  );
};
