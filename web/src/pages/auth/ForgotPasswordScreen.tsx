import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Email,
  ArrowBack,
} from '@mui/icons-material';
import { useTheme, useMediaQuery, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { AppLogo } from '../../components/common/AppLogo';
import { sxPresets } from '../../theme/sxPresets';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  useDocumentTitle(t('auth.forgotPasswordTitle'));
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError(t('auth.forgotPasswordFillEmail'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword(normalizedEmail);
    } catch (err) {
      // FIX #930: Não distinguir auth/user-not-found — previne enumeração de email.
      // auth/invalid-email lança exceção antes do Firebase tentar enviar, então
      // é seguro exibir. Qualquer outro erro é tratado genericamente.
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-email') {
        setError(t('auth.forgotPasswordInvalidEmail'));
        setLoading(false);
        return;
      }
      // Para user-not-found e todos os outros erros: sempre exibir sucesso genérico.
      // Isso previne que um atacante enumere quais emails estão cadastrados.
    } finally {
      setLoading(false);
    }
    // Sempre exibir mensagem de sucesso, independente de o email existir ou não
    setSuccess(true);
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
      }}
    >
      {isMd && (
        <Box
          sx={{
            flex: 1,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          <AppLogo
            size="large"
            shape="circle"
            alt="Futeba dos Parças"
            sx={{ mb: 2 }}
          />
          <Typography variant="h5" fontWeight="bold" color="primary.contrastText">
            {t('auth.forgotPasswordTitle')}
          </Typography>
          <Typography variant="body1" sx={{ color: alpha(theme.palette.primary.contrastText, 0.8), mt: 0.5 }}>
            {t('auth.forgotPasswordSubtitle')}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          ...(isMd
            ? { bgcolor: 'background.paper' }
            : {
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                minHeight: '100dvh',
              }),
        }}
      >
      <Card
        sx={{
          maxWidth: 420,
          width: '100%',
          borderRadius: 4,
          boxShadow: isMd ? undefined : (t) => t.shadows[16],
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {!isMd && (
          <>
          <Box sx={{ mb: 2 }}>
            <IconButton onClick={() => navigate('/login')} sx={{ ml: -1 }} aria-label={t('auth.forgotPasswordBackAriaLabel')}>
              <ArrowBack />
            </IconButton>
          </Box>

          <Box sx={{ textAlign: 'center', mb: 4 }}>
            {/* Logo padronizada — AppLogo (PNG canônico do app) */}
            <AppLogo
              size="large"
              shape="circle"
              alt="Futeba dos Parças"
              sx={{ mx: 'auto', mb: 2 }}
            />
            <Typography variant="h5" fontWeight="bold">
              {t('auth.forgotPasswordTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('auth.forgotPasswordSubtitle')}
            </Typography>
          </Box>
          </>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert" aria-live="assertive">
              {error}
            </Alert>
          )}

          {success ? (
            <Box sx={{ textAlign: 'center' }}>
              <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} aria-live="polite">
                {t('auth.forgotPasswordEmailSent')}
              </Alert>
              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={() => navigate('/login')}
                sx={{ py: 1.5 }}
              >
                {t('auth.forgotPasswordBackToLogin')}
              </Button>
            </Box>
          ) : (
            <form onSubmit={handleReset} aria-label={t('auth.forgotPasswordFormAriaLabel')}>
              <TextField
                fullWidth
                label={t('auth.forgotPasswordEmailLabel')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                inputProps={{ autoComplete: 'email', maxLength: 254 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />

              <Button
                fullWidth
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={[
                  sxPresets.gradientPrimary,
                  {
                    py: 1.5,
                    fontSize: '1rem',
                  },
                ]}
              >
                {loading ? <CircularProgress size={24} sx={{ color: theme.palette.common.white }} /> : t('auth.forgotPasswordSendLink')}
              </Button>
            </form>
          )}

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {t('auth.forgotPasswordRememberPassword')}{' '}
              <Link component={RouterLink} to="/login" underline="hover">
                {t('auth.forgotPasswordSignIn')}
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
