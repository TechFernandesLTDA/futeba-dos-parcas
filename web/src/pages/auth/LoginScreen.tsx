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
  SportsSoccer,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';

export function LoginScreen() {
  useDocumentTitle('Login');
  const { t } = useTranslation();
  const theme = useTheme();
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
    const fromState = (location.state as { from?: { pathname?: string } } | null)
      ?.from?.pathname;
    const fromQuery = searchParams.get('redirect');
    const candidate = fromState || fromQuery || '/';
    // Apenas paths internos. Rejeita protocol-relative (`//`) e URLs absolutas.
    return candidate.startsWith('/') && !candidate.startsWith('//')
      ? candidate
      : '/';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await signIn(email, password);
      navigate(resolveRedirect(), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Erro ao fazer login. Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithGoogle();
      navigate(resolveRedirect(), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Erro ao fazer login com Google'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'center',
        p: 2,
        py: { xs: 2, sm: 2 },
      }}
    >
      <Card
        sx={{
          maxWidth: 420,
          width: '100%',
          borderRadius: 4,
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: `0 4px 12px ${theme.palette.primary.main}66`,
              }}
            >
              <SportsSoccer sx={{ fontSize: 40, color: theme.palette.primary.contrastText }} />
            </Box>
              <Typography component="h1" variant="h4" fontWeight="bold" color="primary">
                {t('common.appName')}
              </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Organize suas peladas!
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert" aria-live="assertive">
              {error}
            </Alert>
          )}

          <form onSubmit={handleLogin} aria-label="Formulário de login">
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
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
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
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
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
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
              sx={{
                py: 1.5,
                fontSize: '1rem',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                '&:hover': {
                  background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.dark})`,
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Entrar'}
            </Button>
          </form>

          <Box sx={{ textAlign: 'right', mt: 1 }}>
            <Link
              component={RouterLink}
              to="/forgot-password"
              variant="body2"
              underline="hover"
            >
              Esqueceu a senha?
            </Link>
          </Box>

          <Divider sx={{ my: 3 }}>ou</Divider>

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
                backgroundColor: `${theme.palette.info.main}0A`,
              },
            }}
          >
            Continuar com Google
          </Button>

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Não tem conta?{' '}
              <Link component={RouterLink} to="/register" underline="hover">
                Criar conta
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
