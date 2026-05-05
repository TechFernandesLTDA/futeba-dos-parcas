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
} from '@mui/material';
import { Phone as PhoneIcon } from '@mui/icons-material';
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  linkWithCredential,
  ConfirmationResult,
} from 'firebase/auth';
import { signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/**
 * Tela 1/2 do onboarding obrigatório: verificação de telefone.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R2)
 *
 * Fluxo:
 * 1. User digita phone E.164 (+5511999998888)
 * 2. RecaptchaVerifier invisível valida humano
 * 3. signInWithPhoneNumber → SMS OTP enviado
 * 4. User digita código 6 dígitos
 * 5. linkWithCredential vincula phone à conta atual
 * 6. Cloud Function setUserVerified (após CPF também ok)
 * 7. Navega para /onboarding/cpf
 */
export const PhoneVerificationScreen: React.FC = () => {
  useDocumentTitle('Verificar telefone');
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showSuccess } = useToast();

  const [phone, setPhone] = useState('+55');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Cleanup do verifier ao desmontar
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  useEffect(() => {
    return () => {
      verifierRef.current?.clear();
    };
  }, []);

  const handleSendOtp = async () => {
    setError(null);
    if (!/^\+\d{10,15}$/.test(phone.replace(/\s/g, ''))) {
      setError('Formato inválido. Use +5511999998888');
      return;
    }
    if (!firebaseUser) {
      setError('Login expirou. Faça login novamente.');
      return;
    }
    setLoading(true);
    try {
      // Cria verifier invisível atrelado ao container
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(
          auth,
          recaptchaContainerRef.current!,
          { size: 'invisible' },
        );
      }
      const confirmation = await signInWithPhoneNumber(
        auth,
        phone.replace(/\s/g, ''),
        verifierRef.current,
      );
      confirmationRef.current = confirmation;
      setStep('otp');
      showSuccess('Código enviado por SMS');
    } catch (err) {
      const msg = (err as { code?: string; message?: string }).code === 'auth/invalid-phone-number'
        ? 'Número de telefone inválido'
        : (err as { message?: string }).message || 'Erro ao enviar SMS. Tente novamente.';
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
      setError('O código deve ter 6 dígitos');
      return;
    }
    if (!confirmationRef.current || !firebaseUser) {
      setError('Sessão expirou. Reinicie o processo.');
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      // Pega credencial do telefone via verificationId + código
      const credential = PhoneAuthProvider.credential(
        confirmationRef.current.verificationId,
        otp,
      );
      // Vincula à conta atual (Google/email já logado)
      await linkWithCredential(firebaseUser, credential);
      showSuccess('Telefone verificado');
      navigate('/onboarding/cpf');
    } catch (err) {
      const code = (err as { code?: string }).code;
      let msg = 'Código inválido. Tente novamente.';
      if (code === 'auth/invalid-verification-code') msg = 'Código incorreto';
      else if (code === 'auth/code-expired') msg = 'Código expirou. Solicite novo SMS.';
      else if (code === 'auth/credential-already-in-use') {
        msg = 'Este telefone já está vinculado a outra conta';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <PhoneIcon color="primary" fontSize="large" />
              <Typography component="h1" variant="h5" fontWeight={700}>
                Verificar telefone
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Confirmamos seu número via SMS para evitar contas falsas.
              Etapa 1 de 2.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {step === 'phone' ? (
              <>
                <TextField
                  fullWidth
                  label="Telefone (com DDD)"
                  placeholder="+5511999998888"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  sx={{ mb: 2 }}
                  helperText="Formato internacional: +55 + DDD + número"
                  inputProps={{
                    'aria-label': 'Número de telefone',
                    autoComplete: 'tel',
                  }}
                />
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleSendOtp}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Enviando...' : 'Enviar código por SMS'}
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  Digite o código de 6 dígitos enviado para {phone}
                </Typography>
                <TextField
                  fullWidth
                  label="Código"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  sx={{ mb: 2 }}
                  inputProps={{
                    inputMode: 'numeric',
                    maxLength: 6,
                    'aria-label': 'Código SMS',
                    autoComplete: 'one-time-code',
                  }}
                />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setStep('phone');
                      setOtp('');
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Voltar
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 6}
                    startIcon={loading ? <CircularProgress size={20} /> : null}
                  >
                    {loading ? 'Verificando...' : 'Verificar'}
                  </Button>
                </Box>
              </>
            )}

            {/* Container para reCAPTCHA invisible */}
            <div ref={recaptchaContainerRef} />
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};
