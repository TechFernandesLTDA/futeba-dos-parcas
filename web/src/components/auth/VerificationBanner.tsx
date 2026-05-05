import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Box } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const GRACE_END = new Date('2026-06-04T00:00:00Z');

/**
 * Banner avisando usuários não-verificados sobre prazo do grace period.
 * Spec: SPEC_PHONE_CPF_FASE5_ENFORCEMENT.md (#448)
 */
export const VerificationBanner: React.FC = () => {
  const { firebaseUser } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setVerified(null);
      return;
    }
    let cancelled = false;
    firebaseUser
      .getIdTokenResult()
      .then((r) => !cancelled && setVerified(r.claims.verified === true))
      .catch(() => !cancelled && setVerified(false));
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  if (!firebaseUser || verified !== false) return null;

  const daysLeft = Math.max(
    0,
    Math.ceil((GRACE_END.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: 1100 }}>
      <Alert
        severity="warning"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => navigate('/onboarding/phone')}
          >
            Verificar agora
          </Button>
        }
        sx={{ borderRadius: 0 }}
      >
        Verifique seu telefone e CPF para evitar bloqueio.{' '}
        {daysLeft > 0
          ? `${daysLeft} dia${daysLeft === 1 ? '' : 's'} restantes.`
          : 'Prazo expirado.'}
      </Alert>
    </Box>
  );
};
