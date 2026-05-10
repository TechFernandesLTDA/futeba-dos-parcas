import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { queryClient } from '../services/queryClient';
import { User } from '../types';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';

const logger = createLogger('AuthContext');

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  currentUser: FirebaseUser | null; // Alias for firebaseUser
  loading: boolean;
  error: string | null;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (profile: { displayName?: string; photoURL?: string }) => Promise<void>;
  
  // User methods
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevUserRef = useRef<FirebaseUser | null>(null);
  const firebaseUserRef = useRef(firebaseUser);
  firebaseUserRef.current = firebaseUser;

  // Fetch user data from Firestore
  // FIX #578: PII (email, fcm_token, birth_date, height_cm, weight_kg, gender)
  // está em `users_private/{uid}` (only owner reads). Merge users + users_private
  // pra construir User completo (apenas pro próprio user — owner-only access).
  const fetchUserData = async (uid: string): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) return null;

      const raw = userDoc.data();
      const converted = snakeToCamel(raw);

      // Tentativa de ler PII de users_private (only owner). Não-fatal:
      // se permission denied (não é owner) ou doc não existe, retorna apenas
      // dados públicos de users.
      let piiData: Record<string, unknown> = {};
      try {
        const privateDoc = await getDoc(doc(db, 'users_private', uid));
        if (privateDoc.exists()) {
          piiData = snakeToCamel(privateDoc.data());
        }
      } catch (privateErr) {
        // Esperado pra não-owner — silently skip.
        logger.debug('users_private read denied (expected for non-owner):', privateErr);
      }

      return {
        id: userDoc.id,
        ...converted,
        ...piiData, // PII fields override (users_private é authoritative)
        createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
        updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
      } as User;
    } catch (err) {
      logger.error('Error fetching user data:', err);
      return null;
    }
  };

  // Create user document if doesn't exist
  const createUserDocument = async (firebaseUser: FirebaseUser, additionalData?: Partial<User>) => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const { email, displayName, photoURL } = firebaseUser;
      const userData = {
        email: email || '',
        name: displayName || 'Usuário',
        nickname: '',
        photo_url: photoURL || '',
        role: 'PLAYER',
        level: 1,
        experience_points: 0,
        striker_rating: 0,
        mid_rating: 0,
        defender_rating: 0,
        gk_rating: 0,
        preferred_position: null,
        preferred_field_types: [],
        total_games: 0,
        total_goals: 0,
        total_assists: 0,
        total_wins: 0,
        total_draws: 0,
        total_losses: 0,
        total_saves: 0,
        mvp_count: 0,
        yellow_cards: 0,
        red_cards: 0,
        current_streak: 0,
        best_streak: 0,
        is_searchable: true,
        is_verified: false,
        favorite_team: null,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        ...additionalData,
      };

      try {
        await setDoc(userRef, userData);
        return { id: firebaseUser.uid, ...snakeToCamel<Omit<User, 'id'>>(userData) } as User;
      } catch (err) {
        logger.error('Error creating user document:', err);
        return null;
      }
    }

    const raw = userSnap.data();
    const converted = snakeToCamel(raw) as Record<string, unknown>;
    return {
      ...converted,
      id: userSnap.id,
      createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
      updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
    } as User;
  };

  // Listen for auth state changes
  useEffect(() => {
    // FIX #584/H4: era onAuthStateChanged async sem cancellation guard.
    // Token refresh / sign-out+sign-in rápido disparava 2 fetchUserData
    // concorrentes, last-resolve-wins → user object stale.
    // Agora: rastreia uid em closure local; descarta resultados se uid
    // mudou enquanto o fetch estava pendente.
    let lastFetchUid: string | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentUid = firebaseUser?.uid ?? null;
      lastFetchUid = currentUid;

      try {
        if (firebaseUser?.uid !== prevUserRef.current?.uid) {
          setLoading(true);
        }
        prevUserRef.current = firebaseUser;
        setFirebaseUser(firebaseUser);

        if (firebaseUser) {
          let userData = await fetchUserData(firebaseUser.uid);

          // FIX #584/H4: descarta resultado se uid mudou durante fetch
          if (lastFetchUid !== firebaseUser.uid) {
            logger.debug(
              `Discarding stale fetchUserData for ${firebaseUser.uid} ` +
              `(current uid: ${lastFetchUid})`
            );
            return;
          }

          if (!userData) {
            userData = await createUserDocument(firebaseUser);
            // Re-check após segunda await
            if (lastFetchUid !== firebaseUser.uid) return;
          }

          setUser(userData);
        } else {
          setUser(null);
        }

        setLoading(false);
      } catch (err) {
        logger.error('Auth state change error:', err);
        // Só limpa state se ainda for o callback atual
        if (lastFetchUid === currentUid) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError((err as Error).message || 'Erro ao fazer login');
      throw err;
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserDocument(result.user);
    } catch (err: unknown) {
      if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') return;
      setError(err instanceof Error ? err.message : 'Erro ao fazer login com Google');
      throw err;
    }
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await createUserDocument(result.user, { name });
    } catch (err) {
      setError((err as Error).message || 'Erro ao criar conta');
      throw err;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setError(null);
    try {
      await signOut(auth);
      // Limpar cache do TanStack Query para evitar vazamento de dados entre contas
      queryClient.clear();
    } catch (err) {
      setError((err as Error).message || 'Erro ao sair');
      throw err;
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      setError((err as Error).message || 'Erro ao enviar email de recuperação');
      throw err;
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    const userData = await fetchUserData(currentUser.uid);
    setUser(userData);
  }, []);

  // Update profile
  const updateUserProfile = useCallback(async (profile: { displayName?: string; photoURL?: string }) => {
    if (firebaseUser && user) {
      await updateProfile(firebaseUser, profile);
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        name: profile.displayName || user.name,
        photo_url: profile.photoURL || user.photoUrl,
        updated_at: serverTimestamp(),
      });
      await refreshUser();
    }
  }, [firebaseUser, refreshUser]);

  const value = useMemo<AuthContextType>(() => ({
    firebaseUser,
    user,
    currentUser: firebaseUser,
    loading,
    error,
    signIn,
    signInWithGoogle,
    signUp,
    logout,
    resetPassword,
    updateUserProfile,
    refreshUser,
  }), [firebaseUser, user, loading, error, signIn, signInWithGoogle, signUp, logout, resetPassword, updateUserProfile, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
