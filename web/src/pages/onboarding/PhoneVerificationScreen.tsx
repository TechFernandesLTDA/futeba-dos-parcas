import { PageContainer } from '../../components/common/PageContainer';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  type ConfirmationResult,
  RecaptchaVerifier,
  PhoneAuthProvider,
  linkWithPhoneNumber,
  linkWithCredential,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { createLogger } from '../../utils/logger';
import { canSendSmsOtp, logVerificationFailure } from '../../services/cloudFunctions';
import type { VerificationFailureReason } from '../../utils/onboardingSecurity';

const logger = createLogger('PhoneVerification');
const PHONE_VERIFICATION_SESSION_KEY = 'futeba.phoneVerification';
const PHONE_VERIFICATION_TTL_MS = 9 * 60 * 1000;
const PHONE_VERIFICATION_RESEND_COOLDOWN_SEC = 60;
const MAX_PHONE_VERIFICATION_ATTEMPTS = 5;

type PhoneVerificationSession = {
  attempts: PhoneVerificationAttempt[];
};

type PhoneVerificationAttempt = {
  uid: string;
  phone: string;
  phoneE164: string;
  verificationId: string;
  sentAt: number;
  attemptId: string;
};

type ActivePhoneVerificationAttempt = PhoneVerificationAttempt & {
  confirmationResult?: ConfirmationResult;
};

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

function resendCooldownFromAttempt(attempt: Pick<PhoneVerificationAttempt, 'sentAt'>): number {
  const elapsedSec = Math.floor((Date.now() - attempt.sentAt) / 1000);
  return Math.max(0, PHONE_VERIFICATION_RESEND_COOLDOWN_SEC - elapsedSec);
}

function mapPhoneOtpFailureReason(code?: string): VerificationFailureReason {
  switch (code) {
    case 'auth/code-expired':
    case 'auth/invalid-credential':
    case 'auth/invalid-verification-id':
    case 'auth/missing-verification-id':
    case 'auth/session-expired':
      return 'code_expired';
    case 'auth/credential-already-in-use':
      return 'duplicate_phone';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'rate_limited';
    case 'auth/invalid-verification-code':
    default:
      return 'code_incorrect';
  }
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
  const { showSuccess } = useToast();

  const [phone, setPhone] = useState('+55');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'success'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const verificationIdRef = useRef<string | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const attemptsRef = useRef<ActivePhoneVerificationAttempt[]>([]);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  const getActiveUser = useCallback(
    (): FirebaseUser | null => auth.currentUser ?? firebaseUser,
    [firebaseUser],
  );

  const newAttemptId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const activeAttempts = (uid: string, phoneE164?: string): ActivePhoneVerificationAttempt[] => {
    const now = Date.now();
    return attemptsRef.current
      .filter((attempt) =>
        attempt.uid === uid &&
        (!phoneE164 || attempt.phoneE164 === phoneE164) &&
        now - attempt.sentAt <= PHONE_VERIFICATION_TTL_MS
      )
      .sort((a, b) => b.sentAt - a.sentAt);
  };

  const persistVerificationAttempts = () => {
    try {
      const attempts = attemptsRef.current
        .map(({ confirmationResult: _confirmationResult, ...attempt }) => attempt)
        .slice(0, MAX_PHONE_VERIFICATION_ATTEMPTS);
      sessionStorage.setItem(PHONE_VERIFICATION_SESSION_KEY, JSON.stringify({ attempts }));
    } catch (storageErr) {
      logger.debug('Failed to persist phone verification session:', storageErr);
    }
  };

  const clearVerificationSession = () => {
    try {
      sessionStorage.removeItem(PHONE_VERIFICATION_SESSION_KEY);
    } catch (storageErr) {
      logger.debug('Failed to clear phone verification session:', storageErr);
    }
  };

  useEffect(() => {
    return () => {
      verifierRef.current?.clear();
    };
  }, []);

  useEffect(() => {
    try {
      const currentUser = getActiveUser();
      if (!currentUser) return;
      const raw = sessionStorage.getItem(PHONE_VERIFICATION_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PhoneVerificationSession;
      const attempts = Array.isArray(saved.attempts) ? saved.attempts : [];
      const validAttempts = attempts
        .filter((attempt) =>
          attempt.uid === currentUser.uid &&
          attempt.verificationId &&
          attempt.phone &&
          attempt.phoneE164 &&
          attempt.sentAt &&
          Date.now() - attempt.sentAt <= PHONE_VERIFICATION_TTL_MS
        )
        .sort((a, b) => b.sentAt - a.sentAt)
        .slice(0, MAX_PHONE_VERIFICATION_ATTEMPTS);

      if (validAttempts.length === 0) {
        clearVerificationSession();
        return;
      }

      attemptsRef.current = validAttempts;
      verificationIdRef.current = validAttempts[0].verificationId;
      setPhone(validAttempts[0].phone);
      setResendCooldown(resendCooldownFromAttempt(validAttempts[0]));
      setStep('otp');
    } catch (storageErr) {
      logger.debug('Failed to restore phone verification session:', storageErr);
    }
  }, [firebaseUser?.uid, getActiveUser]);

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
    setOtp('');
    if (resendCooldown > 0) {
      setError(t('feedback.phoneVerification.rateLimitedMinutes', { minutes: Math.ceil(resendCooldown / 60) }));
      return;
    }
    const normalized = phone.replace(/\D/g, '');
    if (!/^\d{12,13}$/.test(normalized)) {
      setError(t('feedback.phoneVerification.incompleteNumber'));
      return;
    }
    const currentUser = getActiveUser();
    if (!currentUser) {
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
        logger.error('SMS preflight failed; blocking Firebase Phone Auth send:', preflightErr);
        setError(t('feedback.phoneVerification.networkError'));
        return;
      }

      const phoneE164 = `+${normalized}`;
      const phoneDisplay = formatPhoneDisplay(phoneE164);
      const confirmationResult = await withTimeout(
        linkWithPhoneNumber(currentUser, phoneE164, verifierRef.current),
        45000,
        'sms-send-timeout',
      );
      const attempt: ActivePhoneVerificationAttempt = {
        uid: currentUser.uid,
        phone: phoneDisplay,
        phoneE164,
        verificationId: confirmationResult.verificationId,
        sentAt: Date.now(),
        attemptId: newAttemptId(),
        confirmationResult,
      };
      attemptsRef.current = [
        attempt,
        ...activeAttempts(currentUser.uid, phoneE164),
      ].slice(0, MAX_PHONE_VERIFICATION_ATTEMPTS);
      confirmationResultRef.current = confirmationResult;
      verificationIdRef.current = confirmationResult.verificationId;
      persistVerificationAttempts();
      setPhone(phoneDisplay);
      setStep('otp');
      setResendCooldown(PHONE_VERIFICATION_RESEND_COOLDOWN_SEC);
      showSuccess(t('feedback.phoneVerification.codeSent'));
    } catch (err) {
      logger.error('SMS send failed:', err);
      const code = (err as { code?: string }).code;
      if (code === 'auth/provider-already-linked') {
        await currentUser.reload();
        await currentUser.getIdToken(true);
        clearVerificationSession();
        attemptsRef.current = [];
        navigate('/onboarding/cpf', { replace: true });
        return;
      }
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
    const currentUser = getActiveUser();
    const phoneE164 = `+${phone.replace(/\D/g, '')}`;
    const attempts = currentUser ? activeAttempts(currentUser.uid, phoneE164) : [];
    if (attempts.length === 0 || !currentUser) {
      setError(t('feedback.phoneVerification.sessionExpiredRestart'));
      setStep('phone');
      return;
    }
    setLoading(true);
    try {
      let linkedCredential: Awaited<ReturnType<ConfirmationResult['confirm']>> | null = null;
      let lastAttemptError: unknown = null;
      let preferredAttemptError: unknown = null;

      for (const [index, attempt] of attempts.entries()) {
        try {
          linkedCredential = attempt.confirmationResult
            ? await attempt.confirmationResult.confirm(otp)
            : await linkWithCredential(
              currentUser,
              PhoneAuthProvider.credential(attempt.verificationId, otp),
            );
          break;
        } catch (attemptErr) {
          const attemptCode = (attemptErr as { code?: string }).code;
          lastAttemptError = attemptErr;
          if (index === 0 && attemptCode === 'auth/invalid-verification-code') {
            preferredAttemptError = attemptErr;
          }
          if (
            attemptCode === 'auth/invalid-verification-code' ||
            attemptCode === 'auth/code-expired' ||
            attemptCode === 'auth/invalid-credential' ||
            attemptCode === 'auth/invalid-verification-id' ||
            attemptCode === 'auth/missing-verification-id' ||
            attemptCode === 'auth/session-expired'
          ) {
            continue;
          }
          throw attemptErr;
        }
      }

      if (!linkedCredential) throw preferredAttemptError ?? lastAttemptError ?? new Error('otp-confirmation-failed');
      const linkedUser = linkedCredential.user ?? auth.currentUser ?? currentUser;
      await linkedUser.reload();
      // Force token refresh pra Firebase popular phoneNumber no userRecord
      await linkedUser.getIdToken(true);

      clearVerificationSession();
      attemptsRef.current = [];
      navigate('/onboarding/cpf', { replace: true });
    } catch (err) {
      logger.error('Phone verification failed:', err);
      const code = (err as { code?: string }).code;
      // Se telefone já estava linkado a este user, OK — segue pra CPF
      if (code === 'auth/provider-already-linked') {
        const activeUser = getActiveUser();
        if (activeUser) {
          await activeUser.reload();
          await activeUser.getIdToken(true);
        }
        clearVerificationSession();
        attemptsRef.current = [];
        navigate('/onboarding/cpf', { replace: true });
        return;
      }
      logVerificationFailure({ reason: mapPhoneOtpFailureReason(code), stage: 'phone' }).catch((e) => {
        logger.error('Falha ao registrar tentativa de verificação de telefone:', e);
      });

      let msg = t('feedback.phoneVerification.invalidCode');
      if (code === 'auth/invalid-verification-code') msg = t('feedback.phoneVerification.incorrectCode');
      else if (
        code === 'auth/code-expired' ||
        code === 'auth/invalid-verification-id' ||
        code === 'auth/missing-verification-id' ||
        code === 'auth/session-expired'
      ) {
        msg = t('feedback.phoneVerification.codeExpired');
      } else if (code === 'auth/credential-already-in-use') {
        msg = t('feedback.phoneVerification.phoneAlreadyInUse');
      } else if (code === 'auth/invalid-credential') {
        msg = t('feedback.phoneVerification.codeExpired');
        verificationIdRef.current = null;
        confirmationResultRef.current = null;
        attemptsRef.current = [];
        clearVerificationSession();
        setOtp('');
        setStep('phone');
        setResendCooldown(0);
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
                        disabled={loading || resendCooldown > 0}
                        sx={{ py: 1.5, borderRadius: 2 }}
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                      >
                        {loading
                          ? t('onboarding.sendingSms')
                          : resendCooldown > 0
                          ? t('onboarding.resendSmsCountdown', { seconds: resendCooldown })
                          : t('onboarding.sendSmsCode')}
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
                            confirmationResultRef.current = null;
                            attemptsRef.current = [];
                            clearVerificationSession();
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
