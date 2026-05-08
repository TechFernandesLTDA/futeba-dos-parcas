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
  SportsSoccer,
  ArrowBack,
} from '@mui/icons-material';
import { useTheme } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { getAuthErrorMessage } from '../../utils/firebaseErrors';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function RegisterScreen() {
  useDocumentTitle('Cadastro');
  const theme = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const validate = () => {
    if (!name.trim()) {
      setError('Digite seu nome');
      return false;
    }
    if (name.trim().length < 3) {
      setError('Nome deve ter pelo menos 3 caracteres');
      return false;
    }
    if (!email) {
      setError('Digite seu email');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Digite um email válido');
      return false;
    }
    if (!password) {
      setError('Digite sua senha');
      return false;
    }
    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      return false;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      await signUp(email, password, name.trim());
      navigate(resolveRedirect(), { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err, 'Erro ao criar conta. Tente novamente'));
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
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <IconButton
              onClick={() => navigate('/login')}
              sx={{ position: 'absolute', left: 16, top: 16 }}
              aria-label="Voltar para login"
            >
              <ArrowBack />
            </IconButton>
            
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <SportsSoccer sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography component="h1" variant="h5" fontWeight="bold">
              Criar Conta
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Junte-se à pelada!
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} role="alert" aria-live="assertive">
              {error}
            </Alert>
          )}

          <form onSubmit={handleRegister} aria-label="Formulário de cadastro">
            <TextField
              fullWidth
              label="Nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
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
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
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
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Confirmar senha"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
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
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Criar conta'}
            </Button>
          </form>

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
              Já tem conta?{' '}
              <Link component={RouterLink} to="/login" underline="hover">
                Entrar
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
