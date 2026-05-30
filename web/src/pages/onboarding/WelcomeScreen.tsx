import { Box, Typography, Button, Link, useTheme, alpha } from '@mui/material';
import { ArrowForward as ArrowForwardIcon, SportsSoccer as SoccerIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { iconSizes } from '../../theme/iconSizes';

export const WelcomeScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('welcome.documentTitle'));
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
        color: theme.palette.primary.contrastText,
        p: 3,
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
          mb: 4,
        }}
      >
        <SoccerIcon sx={{ fontSize: iconSizes.hero }} />
      </Box>

      <Typography variant="h3" fontWeight={700} gutterBottom sx={{ textAlign: 'center' }}>
        {t('common.appName')}
      </Typography>

      <Typography variant="h6" sx={{ textAlign: 'center', opacity: 0.9, mb: 4, maxWidth: 300 }}>
        {t('welcome.subtitle')}
      </Typography>

      <Box sx={{ width: '100%', maxWidth: 300 }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          sx={{
            // #2271: WelcomeScreen tem fundo gradiente verde FIXO (não muda com tema),
            // então o botão usa branco fixo + texto verde; antes usava background.paper
            // (escuro no dark) e hover p/ branco causava flash. Agora base e hover são
            // consistentes.
            bgcolor: 'common.white',
            color: theme.palette.primary.dark,
            py: 1.5,
            mb: 2,
            '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.9) },
          }}
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate('/register')}
        >
          {t('auth.createAccountTitle')}
        </Button>

        <Button
          fullWidth
          variant="outlined"
          size="large"
          sx={{
            borderColor: 'primary.contrastText',
            color: 'primary.contrastText',
            py: 1.5,
            '&:hover': { borderColor: alpha(theme.palette.common.white, 0.8), bgcolor: alpha(theme.palette.common.white, 0.1) },
          }}
          onClick={() => navigate('/login')}
        >
          {t('welcome.haveAccount')}
        </Button>
      </Box>

      <Typography variant="caption" sx={{ mt: 4, opacity: 0.7 }}>
        {t('welcome.termsPrefix')}{' '}
        <Link href="/terms_of_service.html" color="primary" underline="hover">
          {t('onboarding.termsOfUse')}
        </Link>
        {' '}{t('onboarding.termsConnector')}{' '}
        <Link href="/privacy_policy.html" color="primary" underline="hover">
          {t('onboarding.privacyPolicy')}
        </Link>
      </Typography>
    </Box>
  );
};
