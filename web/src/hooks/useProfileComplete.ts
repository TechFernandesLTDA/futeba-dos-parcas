import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useProfileComplete() {
  const { firebaseUser } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async (user: typeof firebaseUser, forceRefresh = false) => {
    if (!user) {
      setProfileComplete(null);
      return;
    }
    try {
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      if (mountedRef.current) {
        setProfileComplete(!!tokenResult.claims.profileComplete);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setProfileComplete(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    check(firebaseUser);
  }, [firebaseUser, check]);

  const refresh = useCallback(() => check(firebaseUser, true), [firebaseUser, check]);

  return { profileComplete, loading: profileComplete === null, error, refresh };
}
