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
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
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
  const fetchUserData = async (uid: string): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const raw = userDoc.data();
        const converted = snakeToCamel(raw);
        return {
          id: userDoc.id,
          ...converted,
          createdAt: (raw.created_at || raw.createdAt)?.toDate?.(),
          updatedAt: (raw.updated_at || raw.updatedAt)?.toDate?.(),
        } as User;
      }
      return null;
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser?.uid !== prevUserRef.current?.uid) {
          setLoading(true);
        }
        prevUserRef.current = firebaseUser;
        setFirebaseUser(firebaseUser);

        if (firebaseUser) {
          let userData = await fetchUserData(firebaseUser.uid);
          
          if (!userData) {
            userData = await createUserDocument(firebaseUser);
          }
          
          setUser(userData);
        } else {
          setUser(null);
        }

        setLoading(false);
      } catch (err) {
        logger.error('Auth state change error:', err);
        setUser(null);
        setLoading(false);
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
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') return;
      setError((err as Error).message || 'Erro ao fazer login com Google');
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
