import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { User } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  
  // User methods
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user data from Firestore
  const fetchUserData = async (uid: string): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return null;
    } catch (err) {
      console.error('Error fetching user data:', err);
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
        photoUrl: photoURL || '',
        role: 'PLAYER',
        level: 1,
        experiencePoints: 0,
        strikerRating: 0,
        midRating: 0,
        defenderRating: 0,
        gkRating: 0,
        preferredPosition: null,
        preferredFieldTypes: [],
        totalGames: 0,
        totalGoals: 0,
        totalAssists: 0,
        totalWins: 0,
        totalDraws: 0,
        totalLosses: 0,
        totalSaves: 0,
        mvpCount: 0,
        yellowCards: 0,
        redCards: 0,
        currentStreak: 0,
        bestStreak: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...additionalData,
      };

      try {
        await setDoc(userRef, userData);
        return { id: firebaseUser.uid, ...userData } as User;
      } catch (err) {
        console.error('Error creating user document:', err);
        return null;
      }
    }

    return { id: userSnap.id, ...userSnap.data() } as User;
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
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
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
      throw err;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserDocument(result.user);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login com Google');
      throw err;
    }
  };

  // Sign up with email/password
  const signUp = async (email: string, password: string, name: string) => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await createUserDocument(result.user, { name });
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      setError(err.message || 'Erro ao sair');
      throw err;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar email de recuperação');
      throw err;
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser.uid);
      setUser(userData);
    }
  };

  const value: AuthContextType = {
    firebaseUser,
    user,
    loading,
    error,
    signIn,
    signInWithGoogle,
    signUp,
    logout,
    resetPassword,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
