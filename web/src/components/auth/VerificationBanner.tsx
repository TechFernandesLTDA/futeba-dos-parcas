import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Box, Slide } from '@mui/material';
import { ShieldOutlined as ShieldIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useVerifiedClaim } from '../../hooks/useVerifiedClaim';
import { getNextVerificationPath } from '../../utils/onboardingSecurity';

const GRACE_END = new Date('2026-08-03T00:00:00Z');

/**
 * Banner pra users existentes ainda nao-verificados.
 * Spec: SPEC_PHONE_CPF_FASE5_ENFORCEMENT.md (#448, polish 2026-05-05)
 *
 * - Slide-in animation
 * - Severity adapta ao prazo (warning > 7d, error <= 7d)
 * - Mensagem amigavel, nao intrusiva
 */
export const VerificationBanner: React.FC = () => {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const verified = useVerifiedClaim(firebaseUser);

  if (!firebaseUser || verified !== false) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((GRACE_END.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const urgent = daysLeft <= 7;

  const message = daysLeft === 0
    ? t('feedback.verificationBanner.required')
    : daysLeft === 1
    ? t('feedback.verificationBanner.lastChance')
    : urgent
    ? t('feedback.verificationBanner.daysLeft', { count: daysLeft })
    : t('feedback.verificationBanner.safeWindow', { count: daysLeft });

  return (
    <Slide direction="down" in mountOnEnter unmountOnExit>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 1100 }}>
        <Alert
          severity={urgent ? 'error' : 'warning'}
          icon={<ShieldIcon fontSize="small" aria-hidden="true" />}
          action={
            <Button
              color="inherit"
              size="small"
              variant="outlined"
              onClick={() => navigate(getNextVerificationPath(firebaseUser))}
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {t('feedback.verificationBanner.action')}
            </Button>
          }
          sx={{
            borderRadius: 0,
            '& .MuiAlert-message': {
              fontSize: '0.875rem',
              fontWeight: 500,
            },
          }}
        >
          {message}
        </Alert>
      </Box>
    </Slide>
  );
};
