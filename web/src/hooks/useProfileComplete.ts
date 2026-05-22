import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useProfileComplete() {
  const { firebaseUser } = useAuth();
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setProfileComplete(null);
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const tokenResult = await firebaseUser!.getIdTokenResult();
        if (!cancelled) {
          setProfileComplete(!!tokenResult.claims.profileComplete);
        }
      } catch {
        if (!cancelled) {
          setProfileComplete(null);
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [firebaseUser]);

  return { profileComplete, loading: profileComplete === null };
}
