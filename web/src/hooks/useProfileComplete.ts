import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useProfileComplete() {
  const { firebaseUser } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const mountedRef = useRef(true);

  const check = useCallback(async (user: typeof firebaseUser, forceRefresh = false) => {
    if (!user) {
      setProfileComplete(true);
      return;
    }
    try {
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      if (mountedRef.current) {
        setProfileComplete(!!tokenResult.claims.profileComplete);
      }
    } catch {
      if (mountedRef.current) {
        setProfileComplete(true);
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

  return { profileComplete, loading: profileComplete === null, refresh };
}
