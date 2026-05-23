import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';

export function useProfileComplete() {
  const { firebaseUser } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const check = useCallback(async (user: typeof firebaseUser, forceRefresh = false) => {
    if (!user) {
      setProfileComplete(null);
      return;
    }
    try {
      const tokenResult = await user.getIdTokenResult(forceRefresh);
      setProfileComplete(!!tokenResult.claims.profileComplete);
    } catch {
      setProfileComplete(null);
    }
  }, []);

  useEffect(() => {
    check(firebaseUser);
  }, [firebaseUser, check]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        check(user, true);
      }
    });
    return () => unsubscribe();
  }, [check]);

  const refresh = useCallback(() => check(firebaseUser, true), [firebaseUser, check]);

  return { profileComplete, loading: profileComplete === null, refresh };
}
