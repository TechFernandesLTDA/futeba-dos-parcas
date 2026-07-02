import { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { createLogger } from '../utils/logger';

const logger = createLogger('useVerifiedClaim');

/**
 * Hook compartilhado para checar o custom claim `verified` do ID token.
 *
 * #2185: lógica unificada — antes estava duplicada em App.tsx (useVerifiedClaim
 * interno) e no antigo VerificationBanner.tsx (removido em #3187), podendo divergir.
 *
 * Retorna:
 * - `null` enquanto aguarda a resolução do token (ou sem usuário);
 * - `true`/`false` quando resolvido.
 */
export function useVerifiedClaim(firebaseUser: FirebaseUser | null | undefined): boolean | null {
  const [claimState, setClaimState] = useState<{ uid: string | null; verified: boolean | null }>({
    uid: null,
    verified: null,
  });

  useEffect(() => {
    if (!firebaseUser) {
      setClaimState({ uid: null, verified: null });
      return;
    }

    const uid = firebaseUser.uid;
    setClaimState((current) => (current.uid === uid ? current : { uid, verified: null }));

    let cancelled = false;
    firebaseUser
      .getIdTokenResult()
      .then((result) => {
        if (!cancelled) setClaimState({ uid, verified: result.claims.verified === true });
      })
      .catch((err) => {
        // #2290: não engolir o erro silenciosamente — registra para debug.
        // Trata como não-verificado (fail-closed) para manter o gate seguro.
        logger.error('Falha ao resolver custom claim verified:', err);
        if (!cancelled) setClaimState({ uid, verified: false });
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  if (!firebaseUser) return null;
  return claimState.uid === firebaseUser.uid ? claimState.verified : null;
}
