import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Fade,
  LinearProgress,
} from '@mui/material';
import {
  Badge as BadgeIcon,
  CheckCircle as CheckCircleIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import { isValidCpf, formatCpf, stripCpf } from '../../utils/cpfValidator';
import { verifyCpf, setUserVerified } from '../../services/cloudFunctions';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/**
 * Etapa 2/2 do onboarding obrigatorio: verificacao de CPF.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R3, R6, polish 2026-05-05)
 */
export const CpfVerificationScreen: React.FC = () => {
  useDocumentTitle('Verificar CPF');
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showError, showSuccess } = useToast();

  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = stripCpf(e.target.value).slice(0, 11);
    if (digits.length === 11) {
      setCpf(formatCpf(digits));
    } else if (digits.length >= 9) {
      setCpf(
        `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}${
          digits.length > 9 ? '-' + digits.substring(9) : ''
        }`,
      );
    } else if (digits.length >= 6) {
      setCpf(
        `${digits.substring(0, 3)}.${digits.substring(3, 6)}${
          digits.length > 6 ? '.' + digits.substring(6) : ''
        }`,
      );
    } else if (digits.length >= 3) {
      setCpf(
        `${digits.substring(0, 3)}${digits.length > 3 ? '.' + digits.substring(3) : ''}`,
      );
    } else {
      setCpf(digits);
    }
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);

    if (!isValidCpf(cpf)) {
      setError('CPF inválido. Confira os dígitos.');
      return;
    }
    if (!firebaseUser) {
      setError('Sessão expirou. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      const verifyResult = await verifyCpf({ cpf: stripCpf(cpf) });
      if (!verifyResult.data.success) {
        throw new Error('Falha ao verificar CPF');
      }
      await setUserVerified({});
      await firebaseUser.getIdToken(true);

      setSuccess(true);
      showSuccess('Conta verificada!');
      setTimeout(() => navigate('/'), 1400);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = (err as { message?: string }).message || '';
      let userMsg = 'Não foi possível verificar agora. Tente novamente em instantes.';

      if (code === 'functions/already-exists') {
        userMsg = 'Este CPF já está em outra conta. Use seu próprio CPF.';
      } else if (code === 'functions/invalid-argument') {
        userMsg = 'CPF inválido. Confira os dígitos.';
      } else if (code === 'functions/permission-denied') {
        userMsg = message || 'Operação não permitida. Entre em contato com o suporte.';
      } else if (code === 'functions/unauthenticated') {
        userMsg = 'Sua sessão expirou. Faça login novamente.';
      } else if (code === 'functions/failed-precondition') {
        userMsg = 'Conclua a verificação de telefone primeiro.';
      }

      setError(userMsg);
      showError(userMsg);
    } finally {
      setLoading(false);
    }
  };

  const ProgressHeader = () => (
    <Box sx={{ mb: 3 }}>
      <Stepper activeStep={1} alternativeLabel sx={{ mb: 1 }}>
        <Step completed>
          <StepLabel>Telefone</StepLabel>
        </Step>
        <Step completed={success}>
          <StepLabel>CPF</StepLabel>
        </Step>
      </Stepper>
    </Box>
  );

  const SuccessState = () => (
    <Fade in timeout={400}>
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Tudo pronto! 🎉
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Sua conta está verificada.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Bora jogar uma pelada!
        </Typography>
        <LinearProgress sx={{ mt: 3, borderRadius: 1 }} />
      </Box>
    </Fade>
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        py: 3,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={3} sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <ProgressHeader />

            {success ? (
              <SuccessState />
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <BadgeIcon />
                  </Box>
                  <Box>
                    <Typography component="h1" variant="h6" fontWeight={700}>
                      Quase lá! Verificar CPF
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Etapa 2 de 2
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Seu CPF garante 1 conta por pessoa — sem bots ou contas falsas no ranking.
                </Typography>

                <Fade in={!!error} timeout={250} unmountOnExit>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                </Fade>

                <TextField
                  fullWidth
                  label="CPF"
                  placeholder="999.999.999-99"
                  value={cpf}
                  onChange={handleChange}
                  disabled={loading}
                  autoFocus
                  sx={{
                    mb: 2,
                    '& input': {
                      fontSize: '1.2rem',
                      letterSpacing: '0.05em',
                      textAlign: 'center',
                      fontWeight: 600,
                    },
                  }}
                  helperText="Apenas você verá seu CPF completo"
                  inputProps={{
                    inputMode: 'numeric',
                    maxLength: 14,
                    'aria-label': 'Número do CPF',
                  }}
                />

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleSubmit}
                  disabled={loading || !isValidCpf(cpf)}
                  sx={{ py: 1.5, borderRadius: 2 }}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {loading ? 'Verificando...' : 'Concluir verificação'}
                </Button>

                <Box
                  sx={{
                    mt: 3,
                    p: 2,
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    display: 'flex',
                    gap: 1.5,
                  }}
                >
                  <ShieldIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      <strong>Como protegemos seu CPF:</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Nunca exposto, mostrado mascarado para outros usuários (***.456.789-**),
                      criptografado em nossos servidores. LGPD-compliant.
                    </Typography>
                  </Box>
                </Box>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 2, textAlign: 'center' }}
                >
                  Ao continuar, você concorda com a{' '}
                  <a href="/privacy_policy.html" target="_blank" rel="noopener">
                    Política de Privacidade
                  </a>{' '}
                  e os{' '}
                  <a href="/terms_of_service.html" target="_blank" rel="noopener">
                    Termos de Uso
                  </a>
                  .
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
