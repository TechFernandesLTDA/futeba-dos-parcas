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
  Person,
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  Google,
  ArrowBack,
} from '@mui/icons-material';
import { useTheme, useMediaQuery, alpha } from '@mui/material';
import { getAuth } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '../../components/common/AppLogo';

export function RegisterScreen() {
  useDocumentTitle('Cadastro');
  const { t } = useTranslation();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // #1339: erros por campo (highlight + helperText) em vez de um único Alert genérico
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  /**
   * Resolve destino pós-cadastro (mesma lógica do LoginScreen).
   * Anti open-redirect: aceita apenas paths internos.
   * FIX #574: antes hardcoded `/`.
   */
  const resolveRedirect = (): string => {
    const fromState = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname;
    const fromQuery = searchParams.get('redirect');
    const candidate = fromState || fromQuery || '/';
    return candidate.startsWith('/') && !candidate.startsWith('//')
      ? candidate
      : '/';
  };

  const validate = (emailVal: string) => {
    const errs: typeof fieldErrors = {};
    if (!name.trim()) errs.name = t('auth.errorEnterName');
    else if (name.trim().length < 3) errs.name = t('auth.errorNameMinLength');

    if (!emailVal) errs.email = t('auth.errorEnterEmail');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) errs.email = t('auth.errorInvalidEmail');

    if (!password) errs.password = t('auth.errorEnterPassword');
    else if (password.length < 6) errs.password = t('auth.errorPasswordMinLength');

    if (password !== confirmPassword) errs.confirmPassword = t('auth.errorPasswordMismatch');

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // #1339: normaliza email (trim + lowercase) antes de validar e enviar,
    // evitando mismatch de autenticação por espaços/caixa (ex: " User@X.com ").
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== email) setEmail(normalizedEmail);
    if (!validate(normalizedEmail)) return;

    setLoading(true);
    setError('');

    try {
      let storedInviteCode: string | null = null;
      try {
        storedInviteCode = sessionStorage.getItem('inviteCode');
      } catch (error) {
        console.warn('Failed to read invite code from sessionStorage:', error);
      }
      const inviteCode = searchParams.get('invite') || storedInviteCode || undefined;
      if (inviteCode) {
        try {
          sessionStorage.removeItem('inviteCode');
        } catch (error) {
          console.warn('Failed to remove invite code from sessionStorage:', error);
        }
      }
      await signUp(normalizedEmail, password, name.trim(), inviteCode);
      navigate(resolveRedirect(), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, t('auth.registerFailed')));
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
            size="medium"
            shape="circle"
            alt="Futeba dos Parças"
            sx={{ mb: 2 }}
          />
          <Typography component="h1" variant="h5" fontWeight="bold" color="primary.contrastText">
            {t('auth.createAccountTitle')}
          </Typography>
          <Typography variant="body1" sx={{ color: alpha(theme.palette.primary.contrastText, 0.8), mt: 0.5 }}>
            {t('auth.joinTagline')}
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
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <IconButton
              onClick={() => navigate('/login')}
              sx={{ position: 'absolute', left: 16, top: 16 }}
              aria-label={t('auth.backToLogin')}
            >
              <ArrowBack />
            </IconButton>
            
            <AppLogo
              size="medium"
              shape="circle"
              alt="Futeba dos Parças"
              sx={{ mx: 'auto', mb: 2 }}
            />
            <Typography component="h1" variant="h5" fontWeight="bold">
              {t('auth.createAccountTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('auth.joinTagline')}
            </Typography>
          </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert" aria-live="assertive">
              {error}
            </Alert>
          )}

          <form onSubmit={handleRegister} aria-label={t('auth.createAccountTitle')}>
            <TextField
              fullWidth
              label={t('auth.fullName')}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
              }}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name}
              disabled={loading}
              inputProps={{ autoComplete: 'name', maxLength: 100 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
              }}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
              disabled={loading}
              inputProps={{ autoComplete: 'email', maxLength: 254 }}
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
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }));
              }}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password}
              disabled={loading}
              inputProps={{ autoComplete: 'new-password', maxLength: 128 }}
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
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label={t('auth.confirmPasswordField')}
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword)
                  setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
              }}
              error={!!fieldErrors.confirmPassword}
              helperText={fieldErrors.confirmPassword}
              disabled={loading}
              inputProps={{ autoComplete: 'new-password', maxLength: 128 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
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
              sx={{
                py: 1.5,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.dark})`,
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : t('auth.createAccount')}
            </Button>
          </form>

          <Divider sx={{ my: 3 }}>{t('common.or')}</Divider>

          <Button
            fullWidth
            variant="outlined"
            size="large"
            startIcon={<Google />}
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
              {t('auth.alreadyHaveAccount')}{' '}
              <Link component={RouterLink} to="/login" underline="hover">
                {t('auth.login')}
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
