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
import { doc, getDoc, getDocs, updateDoc, runTransaction, serverTimestamp, query, collection, where } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { queryClient } from '../services/queryClient';
import { User } from '../types';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { getAuthErrorMessage } from '../utils/firebaseErrors';
import { addBreadcrumb, clearBreadcrumbs } from '../utils/errorContext';
import { markClaimRefresh } from '../utils/authRetry';
import { useTranslation } from 'react-i18next';

const logger = createLogger('AuthContext');

// FIX #1568: helper que aplica defaults defensivos antes dos casts "as User"
// para evitar crashes downstream em campos undefined vindos do Firestore
type FirestoreTimestamp = { toDate?: () => Date };
function toDate(val: unknown): Date | undefined {
  if (val && typeof val === 'object' && typeof (val as FirestoreTimestamp).toDate === 'function') {
    return (val as FirestoreTimestamp).toDate!();
  }
  return undefined;
}
function normalizeUserData(converted: Record<string, unknown>, id: string, raw: Record<string, unknown>): User {
  return {
    ...converted,
    id,
    name: (converted.name as string) || 'Usuário',
    level: typeof converted.level === 'number' ? converted.level : 1,
    strikerRating: typeof converted.strikerRating === 'number' ? converted.strikerRating : 0,
    midRating: typeof converted.midRating === 'number' ? converted.midRating : 0,
    defenderRating: typeof converted.defenderRating === 'number' ? converted.defenderRating : 0,
    gkRating: typeof converted.gkRating === 'number' ? converted.gkRating : 0,
    strikerRatingSet: converted.strikerRatingSet === true,
    midRatingSet: converted.midRatingSet === true,
    defenderRatingSet: converted.defenderRatingSet === true,
    gkRatingSet: converted.gkRatingSet === true,
    autoStrikerRating: typeof converted.autoStrikerRating === 'number' ? converted.autoStrikerRating : 0,
    autoMidRating: typeof converted.autoMidRating === 'number' ? converted.autoMidRating : 0,
    autoDefenderRating: typeof converted.autoDefenderRating === 'number' ? converted.autoDefenderRating : 0,
    autoGkRating: typeof converted.autoGkRating === 'number' ? converted.autoGkRating : 0,
    autoRatingSamples: typeof converted.autoRatingSamples === 'number' ? converted.autoRatingSamples : 0,
    createdAt: toDate(raw.created_at) ?? toDate(raw.createdAt),
    updatedAt: toDate(raw.updated_at) ?? toDate(raw.updatedAt),
  } as User;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  currentUser: FirebaseUser | null; // Alias for firebaseUser
  loading: boolean;
  error: string | null;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUp: (email: string, password: string, name: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (profile: { displayName?: string; photoURL?: string }) => Promise<void>;
  updatingProfile: boolean;

  // User methods
  refreshUser: () => Promise<void>;

  /**
   * Força refresh do ID token, atualizando custom claims (ex: `verified`, `role`)
   * que podem ter sido setados por Cloud Functions após o cadastro.
   * Útil para chamar após etapas de onboarding (verificação de telefone/CPF).
   */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const prevUserRef = useRef<FirebaseUser | null>(null);
  const firebaseUserRef = useRef(firebaseUser);
  firebaseUserRef.current = firebaseUser;

  // Fetch user data from Firestore
  // FIX #578: PII (email, fcm_token, birth_date, height_cm, weight_kg, gender)
  // está em `users_private/{uid}` (only owner reads). Merge users + users_private
  // pra construir User completo (apenas pro próprio user — owner-only access).
  const fetchUserData = async (uid: string, includePrivate = false): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) return null;

      const raw = userDoc.data();
      const converted = snakeToCamel(raw);

      let piiData: Record<string, unknown> = {};
      if (includePrivate) {
        try {
          const privateDoc = await getDoc(doc(db, 'users_private', uid));
          if (privateDoc.exists()) {
            piiData = snakeToCamel(privateDoc.data());
          }
        } catch (privateErr) {
          logger.debug('users_private read denied:', privateErr);
        }
      }

      return normalizeUserData(
        { ...converted, ...piiData },
        userDoc.id,
        raw,
      );
    } catch (err) {
      logger.error('Error fetching user data:', err);
      setError(t('feedback.generic.loadDataError'));
      return null;
    }
  };

  // Create user document if doesn't exist
  // FIX #1555: usa runTransaction para evitar race condition em logins simultâneos
  // (duas abas podiam fazer getDoc+setDoc independentes para o mesmo uid)
  const createUserDocument = async (firebaseUser: FirebaseUser, additionalData?: Partial<User>) => {
    const userRef = doc(db, 'users', firebaseUser.uid);

    try {
      return await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          const { displayName, photoURL } = firebaseUser;
          const userData = {
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

          transaction.set(userRef, userData);

          const convertedNew = snakeToCamel<Omit<User, 'id'>>(userData) as Record<string, unknown>;
          return normalizeUserData(convertedNew, firebaseUser.uid, userData as Record<string, unknown>);
        }

        const raw = userSnap.data();
        const converted = snakeToCamel(raw) as Record<string, unknown>;
        return normalizeUserData(converted, userSnap.id, raw);
      });
    } catch (err) {
      logger.error('Error creating user document:', err);
      setError(t('feedback.auth.createAccountError'));
      return null;
    }
  };

  // #2289: refs mantêm a referência mais recente de fetchUserData/createUserDocument.
  // Os useCallback abaixo têm deps vazias por design (identidade estável), mas antes
  // capturavam versões obsoletas dessas funções (que por sua vez capturam setError).
  const fetchUserDataRef = useRef(fetchUserData);
  fetchUserDataRef.current = fetchUserData;
  const createUserDocumentRef = useRef(createUserDocument);
  createUserDocumentRef.current = createUserDocument;

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
          let userData = await fetchUserDataRef.current(firebaseUser.uid, true);

          // FIX #584/H4: descarta resultado se uid mudou durante fetch
          if (lastFetchUid !== firebaseUser.uid) {
            logger.debug(
              `Discarding stale fetchUserData for ${firebaseUser.uid} ` +
              `(current uid: ${lastFetchUid})`
            );
            return;
          }

          if (!userData) {
            userData = await createUserDocumentRef.current(firebaseUser);
            // Re-check após segunda await
            if (lastFetchUid !== firebaseUser.uid) return;
          }

          // Só seta userData se for não-nulo: createUserDocument pode retornar null
          // mesmo com firebaseUser autenticado (ex.: Firestore offline).
          if (userData) {
            setUser(userData);
          } else {
            setError(t('feedback.auth.loadAccountError'));
          }
        } else {
          setUser(null);
        }

        setLoading(false);
      } catch (err) {
        logger.error('Auth state change error:', err);
        if (lastFetchUid === currentUid) {
          setUser(null);
          setLoading(false);
          setError(t('feedback.auth.verifyAuthError'));
        }
      }
    },
    (err) => {
      logger.error('onAuthStateChanged observer error:', err);
      setError(t('feedback.auth.monitorAuthError'));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [t]);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      addBreadcrumb('auth', 'Login com email/senha', { uid: result.user.uid });
    } catch (err) {
      addBreadcrumb('auth', 'Falha no login com email/senha', {
        code: (err as { code?: string })?.code,
      });
      setError((err as Error).message || 'Erro ao fazer login');
      throw err;
    }
  }, []);

  // Sign in with Google
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await createUserDocumentRef.current(result.user);
    } catch (err: unknown) {
      if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') return;
      // FIX #942: tratar account-exists-with-different-credential explicitamente
      // (ex: usuário tentou login via Google mas já tem conta com email/senha)
      if (err instanceof FirebaseError) {
        setError(getAuthErrorMessage(err, 'Erro ao fazer login com Google'));
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao fazer login com Google');
      }
      throw err;
    }
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name: string, inviteCode?: string) => {
    setError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      let invitedBy: string | undefined;
      if (inviteCode) {
        try {
          const q = query(collection(db, 'users'), where('invite_code', '==', inviteCode.toUpperCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            invitedBy = snap.docs[0].id;
          }
        } catch { /* non-fatal */ }
      }

      // NOTA (#1023): forçar refresh do token ANTES de qualquer escrita no Firestore
      try {
        await result.user.getIdToken(true);
        markClaimRefresh();
      } catch (tokenErr) {
        logger.warn('Falha ao forçar refresh de token após cadastro:', tokenErr);
      }

      await createUserDocumentRef.current(result.user, { name, ...(invitedBy ? { invited_by: invitedBy } : {}) });
    } catch (err) {
      setError((err as Error).message || 'Erro ao criar conta');
      throw err;
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    setError(null);
    try {
      addBreadcrumb('auth', 'Logout iniciado', { uid: auth.currentUser?.uid });
      await signOut(auth);
      // Limpar cache do TanStack Query para evitar vazamento de dados entre contas
      queryClient.clear();
      // Limpa breadcrumbs após logout — próxima sessão começa limpa
      clearBreadcrumbs();
    } catch (err) {
      setError((err as Error).message || 'Erro ao sair');
      throw err;
    }
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      // FIX #932: se o usuário está logado ao solicitar reset de senha (ex: mudança
      // de senha dentro do app), encerrar a sessão atual para forçar reautenticação
      // após o reset. Isso evita que tokens antigos continuem válidos.
      const currentlyLoggedIn = auth.currentUser;
      await sendPasswordResetEmail(auth, email);
      if (currentlyLoggedIn) {
        // Encerrar sessão web local; tokens do servidor expiram naturalmente.
        // Revogação completa de tokens refresh requer Auth Blocking Functions (v2).
        await signOut(auth);
        queryClient.clear();
      }
    } catch (err) {
      setError((err as Error).message || 'Erro ao enviar email de recuperação');
      throw err;
    }
  }, []);

  // Refresh user data
  // FIX #1567: não wipa user=null em falha — mantém estado anterior e seta erro
  const refreshUser = useCallback(async () => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    try {
      const userData = await fetchUserDataRef.current(currentUser.uid, true);
      if (userData) {
        setUser(userData);
        setError(null);
      } else {
        // fetchUserData retornou null sem lançar — provavelmente doc não existe
        setError(t('feedback.auth.updateDataError'));
        // mantém usuário anterior para evitar wipe da UI
      }
    } catch (err) {
      logger.error('Error refreshing user:', err);
      setError(t('feedback.auth.updateDataError2'));
      // mantém usuário anterior — não chama setUser(null)
    }
  }, [t]);

  // Força refresh do ID token para capturar custom claims atualizados
  const refreshClaims = useCallback(async () => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    try {
      await currentUser.getIdToken(true);
      markClaimRefresh();
      logger.debug('Claims refreshed com sucesso para uid:', currentUser.uid);
    } catch (err) {
      logger.error('Falha ao refreshar claims:', err);
      throw err;
    }
  }, []);

  // Update profile
  // FIX #1561: rollback do Auth se Firestore falhar para evitar inconsistência
  const updateUserProfile = useCallback(async (profile: { displayName?: string; photoURL?: string }) => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser || !user) return;
    setError(null);
    setUpdatingProfile(true);

    // Salva estado original do Auth para rollback
    const originalDisplayName = currentUser.displayName;
    const originalPhotoURL = currentUser.photoURL;

    try {
      // 1. Atualiza Auth primeiro
      await updateProfile(currentUser, profile);

      // 2. Atualiza Firestore — se falhar, faz rollback do Auth
      try {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          name: profile.displayName || user.name,
          photo_url: profile.photoURL || user.photoUrl,
          updated_at: serverTimestamp(),
        });
      } catch (firestoreErr) {
        // Firestore falhou — tenta reverter Auth para consistência
        logger.error('Firestore update falhou, revertendo Auth:', firestoreErr);
        try {
          await updateProfile(currentUser, {
            displayName: originalDisplayName ?? undefined,
            photoURL: originalPhotoURL ?? undefined,
          });
        } catch (rollbackErr) {
          // Rollback também falhou — estado pode estar inconsistente
          logger.error('Rollback do Auth falhou:', rollbackErr);
          setError(t('feedback.auth.profileInconsistent'));
          throw firestoreErr;
        }
        setError((firestoreErr as Error).message || 'Erro ao atualizar perfil');
        throw firestoreErr;
      }

      await refreshUser();
    } catch (err) {
      logger.error('Error updating profile:', err);
      setError((err as Error).message || 'Erro ao atualizar perfil');
      throw err;
    } finally {
      setUpdatingProfile(false);
    }
  }, [user, refreshUser, t]);

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
    updatingProfile,
    refreshUser,
    refreshClaims,
  }), [firebaseUser, user, loading, error, updatingProfile, signIn, signInWithGoogle, signUp, logout, resetPassword, updateUserProfile, refreshUser, refreshClaims]);

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
