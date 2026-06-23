import { PageContainer } from '../../components/common/PageContainer';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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
} from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createLogger } from '../../utils/logger';
import { canSendSmsOtp } from '../../services/cloudFunctions';

const logger = createLogger('PhoneVerification');

function phoneAuthSendErrorMessage(err: unknown, t: TFunction): string {
  const code = (err as { code?: string }).code;
  if (code === 'auth/invalid-phone-number') return t('feedback.phoneVerification.invalidPhoneNumber');
  if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
    return t('feedback.phoneVerification.tooManyRequests');
  }
  if (code === 'auth/captcha-check-failed' || code === 'auth/missing-app-credential') {
    return t('feedback.phoneVerification.captchaFailed');
  }
  if (code === 'auth/network-request-failed') {
    return t('feedback.phoneVerification.networkError');
  }
  if (code === 'auth/app-not-authorized') {
    return t('feedback.phoneVerification.appNotAuthorized');
  }
  return t('feedback.phoneVerification.sendError');
}

function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(Object.assign(new Error(code), { code })), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

/**
 * Etapa 1/2 do onboarding obrigatorio: verificacao de telefone via SMS OTP.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (R2, polish 2026-05-05)
 */
export const PhoneVerificationScreen: React.FC = () => {
  const { t } = useTranslation();
  useDocumentTitle(t('onboarding.verifyPhone'));
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [phone, setPhone] = useState('+55');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationIdRef = useRef<string | null>(null);
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
      setError(t('feedback.phoneVerification.incompleteNumber'));
      return;
    }
    if (!firebaseUser) {
      setError(t('feedback.phoneVerification.sessionExpired'));
      return;
    }
    setLoading(true);
    try {
      if (!recaptchaContainerRef.current) {
        setError(t('feedback.phoneVerification.captchaLoading'));
        return;
      }

      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(
          auth,
          recaptchaContainerRef.current,
          {
            size: 'invisible',
            'expired-callback': () => {
              verifierRef.current?.clear();
              verifierRef.current = null;
              setError(t('feedback.phoneVerification.captchaExpired'));
            },
          },
        );
        await withTimeout(
          verifierRef.current.render(),
          12000,
          'recaptcha-timeout',
        );
      }

      try {
        const rateCheck = await canSendSmsOtp({ phone: `+${normalized}` });
        if (!rateCheck.data.allowed) {
          const retryAfter = rateCheck.data.retryAfterSec || 60;
          setError(t('feedback.phoneVerification.rateLimitedMinutes', { minutes: Math.ceil(retryAfter / 60) }));
          setResendCooldown(retryAfter);
          return;
        }
      } catch (preflightErr) {
        logger.error('SMS preflight failed; continuing with Firebase Phone Auth:', preflightErr);
      }

      const provider = new PhoneAuthProvider(auth);
      verificationIdRef.current = await withTimeout(
        provider.verifyPhoneNumber(`+${normalized}`, verifierRef.current),
        30000,
        'sms-send-timeout',
      );
      setStep('otp');
      setResendCooldown(60);
      showSuccess(t('feedback.phoneVerification.codeSent'));
    } catch (err) {
      logger.error('SMS send failed:', err);
      const code = (err as { code?: string }).code;
      const msg = code === 'recaptcha-timeout'
        ? t('feedback.phoneVerification.captchaTimeout')
        : code === 'sms-send-timeout'
        ? t('feedback.phoneVerification.smsTimeout')
        : phoneAuthSendErrorMessage(err, t);
      if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
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
      setError(t('feedback.phoneVerification.code6Digits'));
      return;
    }
    if (!verificationIdRef.current || !firebaseUser) {
      setError(t('feedback.phoneVerification.sessionExpiredRestart'));
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(
        verificationIdRef.current,
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
        showError(t('feedback.phoneVerification.verifiedSaveError'));
      }

      navigate('/onboarding/cpf', { replace: true });
    } catch (err) {
      logger.error('Phone verification failed:', err);
      const code = (err as { code?: string }).code;
      // Se telefone já estava linkado a este user, OK — segue pra CPF
      if (code === 'auth/provider-already-linked') {
        // Tentar persistir phone mesmo no caso already-linked (idempotente)
        if (firebaseUser?.phoneNumber) {
          try {
            await updateDoc(doc(db, 'users', firebaseUser.uid), {
              phone: firebaseUser.phoneNumber,
              phone_verified: true,
              updated_at: serverTimestamp(),
            });
          } catch (e) {
            logger.error('Failed to persist phone (already-linked path):', e);
            showError(t('feedback.phoneVerification.verifiedSaveError'));
          }
        }
        navigate('/onboarding/cpf', { replace: true });
        return;
      }
      let msg = t('feedback.phoneVerification.invalidCode');
      if (code === 'auth/invalid-verification-code') msg = t('feedback.phoneVerification.incorrectCode');
      else if (code === 'auth/code-expired') {
        msg = t('feedback.phoneVerification.codeExpired');
      } else if (code === 'auth/credential-already-in-use') {
        msg = t('feedback.phoneVerification.phoneAlreadyInUse');
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const ProgressHeader = () => (
    <Box sx={{ mb: 3 }}>
      <Stepper activeStep={0} alternativeLabel sx={{ mb: 1 }}>
        <Step completed={step === 'success'}>
          <StepLabel>{t('onboarding.stepPhone')}</StepLabel>
        </Step>
        <Step>
          <StepLabel>{t('onboarding.stepCpf')}</StepLabel>
        </Step>
      </Stepper>
    </Box>
  );

  const SuccessState = () => (
    <Fade in timeout={400}>
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {t('onboarding.phoneVerified')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('onboarding.nextStepLoading')}
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
      <PageContainer maxWidth="focused">
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
                      {step === 'phone' ? t('onboarding.verifyPhone') : t('onboarding.confirmCode')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('onboarding.stepOneOfTwo')}
                    </Typography>
                  </Box>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {step === 'phone'
                    ? t('onboarding.phoneVerificationReason')
                    : t('onboarding.enterSmsCode', { phone })}
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
                        label={t('onboarding.phoneFieldLabel')}
                        placeholder="+55 (11) 99999-8888"
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneDisplay(e.target.value))}
                        disabled={loading}
                        autoFocus
                        sx={{ mb: 2 }}
                        helperText={t('onboarding.phoneHelper')}
                        inputProps={{
                          'aria-label': t('onboarding.phoneNumberAria'),
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
                        {loading ? t('onboarding.sendingSms') : t('onboarding.sendSmsCode')}
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
                          {t('onboarding.phonePrivacy')}
                        </Typography>
                      </Box>
                    </Box>
                  </Fade>
                ) : (
                  <Fade in timeout={300}>
                    <Box>
                      <TextField
                        fullWidth
                        label={t('onboarding.smsCodeLabel')}
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
                          'aria-label': t('onboarding.smsCodeAria'),
                          autoComplete: 'one-time-code',
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <Button
                          startIcon={<BackIcon />}
                          onClick={() => {
                            verificationIdRef.current = null;
                            setStep('phone');
                            setOtp('');
                            setError(null);
                          }}
                          disabled={loading}
                          sx={{ borderRadius: 2 }}
                        >
                          {t('common.back')}
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
                          {loading ? t('onboarding.verifying') : t('onboarding.verify')}
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
                            ? t('onboarding.resendSmsCountdown', { seconds: resendCooldown })
                            : t('onboarding.resendSms')}
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
      </PageContainer>
    </Box>
  );
};
