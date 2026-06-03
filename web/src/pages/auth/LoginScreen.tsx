import React, { useState } from 'react';
import {
  useNavigate,
  useLocation,
  useSearchParams,
  Link as RouterLink,
} from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Google,
} from '@mui/icons-material';
import { useTheme, useMediaQuery, alpha } from '@mui/material';
import { getAuth } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '../../components/common/AppLogo';
import { sxPresets } from '../../theme/sxPresets';
import { pageSpacing } from '../../theme/pageTokens';

export function LoginScreen() {
  const { t } = useTranslation();
  useDocumentTitle(t('page.title.login'));
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  /**
   * Resolve destino pós-login com proteção anti open-redirect.
   *
   * Prioridade:
   * 1. `location.state.from.pathname` — set pelo ProtectedRoute quando user
   *    bate em rota protegida não-logado (deep link).
   * 2. `?redirect=` — set pelo JoinByInviteScreen e outras telas pós-login.
   * 3. `/` — fallback default.
   *
   * Anti open-redirect: aceita apenas paths internos (`/...`), rejeita
   * `//evil.com` (URLs protocol-relative) e qualquer URL absoluta.
   *
   * FIX #574 (regression #514): antes hardcoded `/`, descartava deep links e
   * convites por link.
   */
  const resolveRedirect = (): string => {
    // #2225: ProtectedRoute guarda o location COMPLETO em state.from. Antes lia
    // só pathname, descartando search/hash (deep links com query — ex.: ?tab=2
    // ou filtros — voltavam quebrados). Reconstrói pathname + search + hash.
    const from = (location.state as {
      from?: { pathname?: string; search?: string; hash?: string };
    } | null)?.from;
    const fromState = from?.pathname
      ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
      : undefined;
    const fromQuery = searchParams.get('redirect');
    const candidate = fromState || fromQuery || '/';
    // Apenas paths internos. Rejeita protocol-relative (`//`) e URLs absolutas.
    return candidate.startsWith('/') && !candidate.startsWith('//')
      ? candidate
      : '/';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // #1339: normaliza email (trim + lowercase) — evita mismatch de auth por
    // espaços/caixa. Validação de FORMATO fica com o Firebase Auth
    // (getAuthErrorMessage traduz auth/invalid-email); sem regex divergente aqui.
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    if (!normalizedEmail || !password) {
      setError(t('common.fillAllFields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(normalizedEmail, password);
      navigate(resolveRedirect(), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.loginFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithGoogle();
      if (!getAuth().currentUser) return;
      navigate(resolveRedirect(), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.googleLoginFailed')));
    } finally {
      setLoading(false);
    }
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
            alt={t('alt.logo')}
            sx={{ mb: 2, boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}` }}
          />
          <Typography component="h1" variant="h4" fontWeight="bold" color="primary.contrastText">
            {t('common.appName')}
          </Typography>
          <Typography variant="body1" sx={{ color: alpha(theme.palette.primary.contrastText, 0.8), mt: 0.5 }}>
            {t('auth.tagline')}
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
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
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <AppLogo
              size="large"
              shape="circle"
              alt={t('alt.logo')}
              sx={{
                mx: 'auto',
                mb: 2,
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
              }}
            />
              <Typography component="h1" variant="h4" fontWeight="bold" color="primary">
                {t('common.appName')}
              </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('auth.tagline')}
            </Typography>
          </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert" aria-live="assertive">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} aria-label={t('auth.login')}>
            <TextField
              fullWidth
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              inputProps={{ maxLength: 254 }}
              autoComplete="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              inputProps={{ maxLength: 128 }}
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      disabled={loading}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
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
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.dark})`,
                  },
                },
              ]}
            >
              {loading ? <CircularProgress size={24} sx={{ color: theme.palette.common.white }} /> : t('auth.login')}
            </Button>
          </form>

          <Box sx={{ textAlign: 'right', mt: 1 }}>
            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              underline="hover"
            >
              {t('auth.forgotPassword')}
            </Link>
          </Box>

          <Divider sx={{ my: pageSpacing.sectionSpacing }}>{t('common.or')}</Divider>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <Google />}
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{
              py: 1.5,
              borderColor: theme.palette.info.main,
              color: theme.palette.info.main,
              '&:hover': {
                borderColor: theme.palette.info.dark,
                backgroundColor: alpha(theme.palette.info.main, 0.04),
              },
            }}
          >
            {t('auth.continueWithGoogle')}
          </Button>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              {t('auth.noAccount')}{' '}
              <Link component={RouterLink} to="/register" underline="hover">
                {t('auth.createAccount')}
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
