import React, { useState } from 'react';

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
import { createLogger } from '../../utils/logger';

const logger = createLogger('CpfVerification');

/**
 * Etapa 2/2 do onboarding obrigatorio: verificacao de CPF.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R3, R6, polish 2026-05-05)
 */
export const CpfVerificationScreen: React.FC = () => {
  useDocumentTitle('Verificar CPF');
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
      // FIX 2026-05-11: força refresh do ID token ANTES de chamar verifyCpf.
      // Sintoma reportado (user Gustavo): "Sessão deslogado" = functions/unauthenticated.
      // Causa raiz provável: ID token expirou entre login+phone-verify e click no CPF;
      // App Check + auth token desync. getIdToken(true) renova token + força App Check
      // refresh ANTES da callable, eliminando a janela onde token está expirando.
      //
      // FIX 2026-05-15: se o refresh FALHAR, ABORTA aqui. Antes apenas logava +
      // toast e SEGUIA chamando verifyCpf com token stale → a callable rejeitava
      // com functions/unauthenticated, mostrando "Não foi possível validar sua
      // sessão" (erro reportado, duplicado em Alert + toast). Falhar cedo com
      // mensagem acionável evita o estado confuso.
      try {
        await firebaseUser.getIdToken(true);
      } catch (refreshErr) {
        logger.error('Failed to refresh ID token before verifyCpf:', refreshErr);
        const msg =
          'Não foi possível renovar sua sessão. Verifique sua conexão e ' +
          'tente novamente.';
        setError(msg);
        showError(msg);
        return;
      }

      logger.info('Calling verifyCpf', { uid: firebaseUser.uid, cpfMasked: '***.' + stripCpf(cpf).slice(-4) });
      const verifyResult = await verifyCpf({ cpf: stripCpf(cpf) });
      if (!verifyResult.data.success) {
        throw new Error('Falha ao verificar CPF');
      }
      await setUserVerified({});

      // FIX 2026-05-15: setUserVerified faz revokeRefreshTokens() no servidor.
      // Um getIdToken(true) logo em seguida corre contra o refresh token recém
      // revogado e pode lançar (auth/user-token-expired), caindo no catch e
      // mostrando "Não foi possível validar sua sessão" MESMO com a verificação
      // já concluída com sucesso no servidor. Aqui o refresh é best-effort: o
      // window.location.href = '/' abaixo recarrega a página e re-autentica,
      // relendo o custom claim verified=true. Logo, falha de refresh é não-fatal.
      try {
        await firebaseUser.getIdToken(true);
      } catch (postVerifyRefreshErr) {
        logger.warn(
          'Post-verify token refresh failed (não-fatal — hard reload re-autentica):',
          postVerifyRefreshErr,
        );
      }

      setSuccess(true);
      showSuccess('Conta verificada!');
      // Hard reload pra ProtectedRoute re-ler custom claim verified=true.
      // navigate() mantem instancia React e o cache de verified em memoria.
      setTimeout(() => {
        window.location.href = '/';
      }, 1400);
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = (err as { message?: string }).message || '';
      // Log detalhado pra debug: code + message + appCheckRejected flag se houver
      logger.error('verifyCpf failed', {
        code,
        message,
        details: (err as { details?: unknown }).details,
        uid: firebaseUser?.uid,
      });

      let userMsg = 'Não foi possível verificar agora. Tente novamente em instantes.';

      if (code === 'functions/already-exists') {
        userMsg = 'Este CPF já está em outra conta. Use seu próprio CPF.';
      } else if (code === 'functions/invalid-argument') {
        userMsg = 'CPF inválido. Confira os dígitos.';
      } else if (code === 'functions/permission-denied') {
        userMsg = 'Complete a verificação de telefone antes de continuar.';
      } else if (code === 'functions/unauthenticated') {
        // Mensagem mais informativa: pode ser App Check rejection (web em modo
        // privado, AdBlock bloqueando reCAPTCHA, etc.) ou token expirado.
        userMsg = 'Não foi possível validar sua sessão. Recarregue a página e tente novamente. ' +
          'Se persistir, desabilite extensões/AdBlock ou tente em outro navegador.';
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
                  <a href="/privacy_policy.html" target="_blank" rel="noopener noreferrer">
                    Política de Privacidade
                  </a>{' '}
                  e os{' '}
                  <a href="/terms_of_service.html" target="_blank" rel="noopener noreferrer">
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
