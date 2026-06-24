import { useState, useEffect, useCallback, useRef } from 'react';
import { onIdTokenChanged, type User as FirebaseUser } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../services/firebase';

export function useProfileComplete() {
  const { firebaseUser } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const lastCheckedUidRef = useRef<string | null>(null);

  const check = useCallback(async (user: FirebaseUser | null, forceRefresh = false) => {
    if (!user) {
      setProfileComplete(null);
      return;
    }
    const uid = user.uid;
    lastCheckedUidRef.current = uid;
    try {
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      if (lastCheckedUidRef.current !== uid) return;
      if (mountedRef.current) {
        setProfileComplete(!!tokenResult.claims.profileComplete);
        setError(null);
      }
    } catch (err) {
      if (lastCheckedUidRef.current !== uid) return;
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
    return onIdTokenChanged(auth, (changedUser) => {
      check(changedUser);
    });
  }, [check]);

  useEffect(() => {
    check(auth.currentUser ?? firebaseUser);
  }, [firebaseUser, check]);

  const refresh = useCallback(() => check(auth.currentUser ?? firebaseUser, true), [firebaseUser, check]);

  return { profileComplete, loading: profileComplete === null, error, refresh };
}
