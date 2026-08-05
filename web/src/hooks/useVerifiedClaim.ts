import { useEffect, useState, useRef, useCallback } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { onIdTokenChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
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
  const mountedRef = useRef(true);
  const lastCheckedUidRef = useRef<string | null>(null);

  const check = useCallback((user: FirebaseUser | null | undefined) => {
    if (!user) {
      setClaimState({ uid: null, verified: null });
      return;
    }
    const uid = user.uid;
    lastCheckedUidRef.current = uid;
    user
      .getIdTokenResult()
      .then((result) => {
        if (lastCheckedUidRef.current !== uid) return;
        if (mountedRef.current) {
          setClaimState({ uid, verified: result.claims.verified === true });
        }
      })
      .catch((err) => {
        if (lastCheckedUidRef.current !== uid) return;
        // #2290: não engolir o erro silenciosamente — registra para debug.
        // Trata como não-verificado (fail-closed) para manter o gate seguro.
        logger.error('Falha ao resolver custom claim verified:', err);
        if (mountedRef.current) {
          setClaimState({ uid, verified: false });
        }
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    check(firebaseUser);
  }, [firebaseUser, check]);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, (user) => {
      if (mountedRef.current) check(user);
    });
    return unsubscribe;
  }, [check]);

  if (!firebaseUser) return null;
  return claimState.uid === firebaseUser.uid ? claimState.verified : null;
}
