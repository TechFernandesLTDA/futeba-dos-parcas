import { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger('useVerifiedClaim');

/**
 * Hook compartilhado para checar o custom claim `verified` do ID token.
 *
 * #2185: lógica unificada — antes estava duplicada em App.tsx (useVerifiedClaim
 * interno) e VerificationBanner.tsx, podendo divergir.
 *
 * Retorna:
 * - `null` enquanto aguarda a resolução do token (ou sem usuário);
 * - `true`/`false` quando resolvido.
 */
export function useVerifiedClaim(firebaseUser: FirebaseUser | null | undefined): boolean | null {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setVerified(null);
      return;
    }
    let cancelled = false;
    firebaseUser
      .getIdTokenResult()
      .then((result) => {
        if (!cancelled) setVerified(result.claims.verified === true);
      })
      .catch((err) => {
        // #2290: não engolir o erro silenciosamente — registra para debug.
        // Trata como não-verificado (fail-closed) para manter o gate seguro.
        logger.error('Falha ao resolver custom claim verified:', err);
        if (!cancelled) setVerified(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  return verified;
}
