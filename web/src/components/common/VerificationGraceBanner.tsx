import { useMemo } from 'react';
import { Alert, AlertTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import graceConfig from '../../../../shared/verification-grace.json';

/**
 * #3922 — Banner não-bloqueante que avisa usuários não-verificados sobre o
 * prazo da grace period. Renderizado nas telas de onboarding (onde usuários
 * !verified já estão) como mitigação para "Usuários abandonam onboarding".
 *
 * A spec FASE 5 definia este banner como a mitigação principal, mas ele foi
 * removido em #3187 porque ProtectedRoute redireciona !verified para
 * onboarding incondicionalmente. Este banner reposiciona o aviso para onde
 * o usuário realmente está — a tela de verificação — em vez de tentar exibi-lo
 * atrás do redirect.
 *
 * Quando a grace expira (dias restantes <= 0), o banner muda para tom de
 * erro indicando que o acesso está bloqueado.
 */
export function VerificationGraceBanner() {
  const { t, i18n } = useTranslation();
  const { daysRemaining, expired, graceEndDate } = useMemo(() => {
    const graceEnd = new Date(graceConfig.graceEndIso);
    const diffMs = graceEnd.getTime() - Date.now();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return {
      daysRemaining: days,
      expired: days <= 0,
      graceEndDate: graceEnd,
    };
  }, []);

  if (expired) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>{t('onboarding.grace.expiredTitle')}</AlertTitle>
        {t('onboarding.grace.expiredBody')}
      </Alert>
    );
  }

  const urgency = daysRemaining <= 7 ? 'warning' : 'info';
  const deadline = graceEndDate.toLocaleDateString(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Alert severity={urgency} sx={{ mb: 2 }}>
      <AlertTitle>
        {daysRemaining <= 7
          ? t('onboarding.grace.lastDays', { count: daysRemaining })
          : t('onboarding.grace.daysRemaining', { count: daysRemaining })}
      </AlertTitle>
      {t('onboarding.grace.completeByBody', { date: deadline })}
    </Alert>
  );
}
