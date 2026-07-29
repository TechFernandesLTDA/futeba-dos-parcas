import { useMemo } from 'react';
import { Alert, AlertTitle } from '@mui/material';
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
  const { daysRemaining, expired } = useMemo(() => {
    const graceEnd = new Date(graceConfig.graceEndIso);
    const diffMs = graceEnd.getTime() - Date.now();
    const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    return {
      daysRemaining: days,
      expired: days <= 0,
    };
  }, []);

  if (expired) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        <AlertTitle>Verificação obrigatória</AlertTitle>
        O prazo para concluir a verificação terminou. Você precisa validar seu
        telefone e CPF para continuar usando o app.
      </Alert>
    );
  }

  const urgency = daysRemaining <= 7 ? 'warning' : 'info';

  return (
    <Alert severity={urgency} sx={{ mb: 2 }}>
      <AlertTitle>
        {daysRemaining <= 7
          ? `Últimos ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}!`
          : `${daysRemaining} dias restantes`}
      </AlertTitle>
      Complete sua verificação (telefone + CPF) até{' '}
      {new Date(graceConfig.graceEndIso).toLocaleDateString('pt-BR')} para
      continuar usando o app sem interrupção.
    </Alert>
  );
}
