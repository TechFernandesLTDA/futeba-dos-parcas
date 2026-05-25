import React, { useEffect, useRef, useState } from 'react';
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
  Phone as PhoneIcon,
  CheckCircle as CheckCircleIcon,
  ArrowBack as BackIcon,
  ShieldOutlined as ShieldIcon,
} from '@mui/icons-material';
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  linkWithCredential,
  ConfirmationResult,
} from 'firebase/auth';
import { signInWithPhoneNumber } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PhoneVerification');

/**
 * Etapa 1/2 do onboarding obrigatorio: verificacao de telefone via SMS OTP.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R2, polish 2026-05-05)
 */
export const PhoneVerificationScreen: React.FC = () => {
  useDocumentTitle('Verificar telefone');
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [phone, setPhone] = useState('+55');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  useEffect(() => {
    return () => {
      verifierRef.current?.clear();
    };
  }, []);

  // Se phone já estiver vinculado, pula direto pra CPF
  useEffect(() => {
    if (firebaseUser?.phoneNumber) {
      navigate('/onboarding/cpf', { replace: true });
    }
  }, [firebaseUser, navigate]);

  // Cooldown resend (60s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const formatPhoneDisplay = (input: string): string => {
    const digits = input.replace(/\D/g, '');
    if (!digits.startsWith('55')) return input;
    if (digits.length <= 2) return `+${digits}`;
    if (digits.length <= 4) return `+${digits.substring(0, 2)} (${digits.substring(2)}`;
    if (digits.length <= 9)
      return `+${digits.substring(0, 2)} (${digits.substring(2, 4)}) ${digits.substring(4)}`;
    return `+${digits.substring(0, 2)} (${digits.substring(2, 4)}) ${digits.substring(4, 9)}-${digits.substring(9, 13)}`;
  };

  const handleSendOtp = async () => {
    setError(null);
    const normalized = phone.replace(/\D/g, '');
    if (!/^\d{12,13}$/.test(normalized)) {
      setError('Número incompleto. Inclua DDD + 9 + 8 dígitos.');
      return;
    }
    if (!firebaseUser) {
      setError('Sessão expirou. Faça login novamente.');
      return;
    }
    setLoading(true);
    try {
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(
          auth,
          recaptchaContainerRef.current!,
          { size: 'invisible' },
        );
      }
      const confirmation = await signInWithPhoneNumber(
        auth,
        `+${normalized}`,
        verifierRef.current,
      );
      confirmationRef.current = confirmation;
      setStep('otp');
      setResendCooldown(60);
      showSuccess('Código enviado por SMS');
    } catch (err) {
      const code = (err as { code?: string }).code;
      let msg = 'Erro ao enviar SMS. Verifique o número e tente novamente.';
      if (code === 'auth/invalid-phone-number') msg = 'Número inválido. Confira DDD e número.';
      else if (code === 'auth/too-many-requests') {
        msg = 'Muitas tentativas em sequência. Aguarde 5 minutos.';
        setResendCooldown(300); // 5 minutos
      }
      setError(msg);
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('O código deve ter 6 dígitos.');
      return;
    }
    if (!confirmationRef.current || !firebaseUser) {
      setError('Sessão expirou. Reinicie o processo.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(
        confirmationRef.current.verificationId,
        otp,
      );
      await linkWithCredential(firebaseUser, credential);
      // Force token refresh pra Firebase popular phoneNumber no userRecord
      await firebaseUser.getIdToken(true);

      // FIX: persistir phone no Firestore users/{uid} (antes era só linkado no
      // Auth provider, doc Firestore ficava sem phone — quebrava notificações
      // SMS, contato, recovery). Bug reportado 2026-05-11 (user Gustavo).
      const phoneNumber = firebaseUser.phoneNumber || `+${phone.replace(/\D/g, '')}`;
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          phone: phoneNumber,
          phone_verified: true,
          updated_at: serverTimestamp(),
        });
      } catch (firestoreErr) {
        logger.error('Failed to persist phone to users doc (non-fatal):', firestoreErr);
        showError('Telefone verificado, mas houve um erro ao salvar. Se o problema persistir, contate o suporte.');
      }

      navigate('/onboarding/cpf', { replace: true });
    } catch (err) {
      logger.error('Phone verification failed:', err);
      const code = (err as { code?: string }).code;
      // Se telefone já estava linkado a este user, OK — segue pra CPF
      if (code === 'auth/provider-already-linked') {
        // Tentar persistir phone mesmo no caso already-linked (idempotente)
        if (firebaseUser?.phoneNumber) {
          updateDoc(doc(db, 'users', firebaseUser.uid), {
            phone: firebaseUser.phoneNumber,
            phone_verified: true,
            updated_at: serverTimestamp(),
          }).catch((e) => logger.error('Failed to persist phone (already-linked path):', e));
        }
        navigate('/onboarding/cpf', { replace: true });
        return;
      }
      let msg = 'Código inválido. Tente novamente.';
      if (code === 'auth/invalid-verification-code') msg = 'Código incorreto. Verifique o SMS.';
      else if (code === 'auth/code-expired') {
        msg = 'Código expirou. Solicite um novo SMS.';
      } else if (code === 'auth/credential-already-in-use') {
        msg = 'Este telefone já está vinculado a outra conta.';
      }
      showError(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const ProgressHeader = () => (
    <Box sx={{ mb: 3 }}>
      <Stepper activeStep={0} alternativeLabel sx={{ mb: 1 }}>
        <Step completed={step === 'success'}>
          <StepLabel>Telefone</StepLabel>
        </Step>
        <Step>
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
          Telefone verificado!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Levando você pra próxima etapa...
        </Typography>
        <LinearProgress sx={{ mt: 3, borderRadius: 1 }} />
      </Box>
    </Fade>
  );

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
        py: 3,
      }}
    >
      <Container maxWidth="sm">
        <Card elevation={3}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <ProgressHeader />

            {step === 'success' ? (
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
                    <PhoneIcon />
                  </Box>
                  <Box>
                    <Typography component="h1" variant="h6" fontWeight={700}>
                      {step === 'phone' ? 'Verificar telefone' : 'Confirmar código'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Etapa 1 de 2
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {step === 'phone'
                    ? 'Confirmamos seu número via SMS para evitar contas falsas e robôs.'
                    : `Digite o código de 6 dígitos enviado para ${phone}`}
                </Typography>

                <Fade in={!!error} timeout={250} unmountOnExit>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                </Fade>

                {step === 'phone' ? (
                  <Fade in timeout={300}>
                    <Box>
                      <TextField
                        fullWidth
                        label="Telefone (com DDD)"
                        placeholder="+55 (11) 99999-8888"
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
                        disabled={loading}
                        autoFocus
                        sx={{ mb: 2 }}
                        helperText="Use seu celular verdadeiro — você só usa 1 vez"
                        inputProps={{
                          'aria-label': 'Número de telefone',
                          autoComplete: 'tel',
                          inputMode: 'tel',
                        }}
                      />
                      <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleSendOtp}
                        disabled={loading}
                        sx={{ py: 1.5, borderRadius: 2 }}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                      >
                        {loading ? 'Enviando...' : 'Enviar código por SMS'}
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
                        <Typography variant="caption" color="text.secondary">
                          Seu telefone fica privado. Não compartilhamos com ninguém e não enviamos
                          mensagens promocionais.
                        </Typography>
                      </Box>
                    </Box>
                  </Fade>
                ) : (
                  <Fade in timeout={300}>
                    <Box>
                      <TextField
                        fullWidth
                        label="Código SMS"
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        disabled={loading}
                        autoFocus
                        sx={{
                          mb: 2,
                          '& input': {
                            fontSize: '1.5rem',
                            letterSpacing: '0.5em',
                            textAlign: 'center',
                            fontWeight: 600,
                          },
                        }}
                        inputProps={{
                          inputMode: 'numeric',
                          maxLength: 6,
                          'aria-label': 'Código SMS',
                          autoComplete: 'one-time-code',
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                          startIcon={<BackIcon />}
                          onClick={() => {
                            setStep('phone');
                            setOtp('');
                            setError(null);
                          }}
                          disabled={loading}
                          sx={{ borderRadius: 2 }}
                        >
                          Voltar
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
                          onClick={handleVerifyOtp}
                          disabled={loading || otp.length !== 6}
                          sx={{ py: 1.5, borderRadius: 2 }}
                          startIcon={
                            loading ? <CircularProgress size={20} color="inherit" /> : null
                          }
                        >
                          {loading ? 'Verificando...' : 'Verificar'}
                        </Button>
                      </Box>

                      <Box sx={{ textAlign: 'center' }}>
                        <Button
                          size="small"
                          disabled={loading || resendCooldown > 0}
                          onClick={handleSendOtp}
                          sx={{ textTransform: 'none' }}
                        >
                          {resendCooldown > 0
                            ? `Reenviar em ${resendCooldown}s`
                            : 'Não recebi o SMS, reenviar'}
                        </Button>
                      </Box>
                    </Box>
                  </Fade>
                )}
              </>
            )}

            <div ref={recaptchaContainerRef} />
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
