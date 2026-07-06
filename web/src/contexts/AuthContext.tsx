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
  getAdditionalUserInfo,
  linkWithPopup,
  unlink,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, getDoc, getDocs, updateDoc, runTransaction, serverTimestamp, query, collection, where, limit } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { queryClient } from '../services/queryClient';
import { User } from '../types';
import type { UserRole } from '../types/user';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { getAuthErrorMessage, AppAuthError, APP_AUTH_ERROR_CODES } from '../utils/firebaseErrors';
import { addBreadcrumb, clearBreadcrumbs } from '../utils/errorContext';
import { markClaimRefresh } from '../utils/authRetry';
import { useTranslation } from 'react-i18next';
import type { validateInviteCode as validateInviteCodeType, syncFieldOwnerClaim as syncFieldOwnerClaimType } from '../services/cloudFunctions';
import { normalizePlayerStats } from '../utils/playerStats';

const logger = createLogger('AuthContext');
const USER_ROLES: UserRole[] = ['PLAYER', 'FIELD_OWNER', 'ADMIN'];
const INVITE_REQUIRED_MESSAGE = 'Para criar sua conta, abra um convite de outro membro do Futeba dos Parças.';
const INVITE_INVALID_MESSAGE = 'Convite inválido ou expirado. Peça um novo convite para quem te chamou.';

const loadValidateInviteCode = async (): Promise<typeof validateInviteCodeType> => {
  const module = await import('../services/cloudFunctions');
  return module.validateInviteCode;
};

const loadSyncFieldOwnerClaim = async (): Promise<typeof syncFieldOwnerClaimType> => {
  const module = await import('../services/cloudFunctions');
  return module.syncFieldOwnerClaim;
};

// #3187: erros de convite agora carregam `.code` (AppAuthError) — telas mapeiam
// por código via getAuthErrorMessage. Comparação por código, não por message.
function isInviteRequiredError(err: unknown): boolean {
  return (err as { code?: string })?.code === APP_AUTH_ERROR_CODES.inviteRequired;
}

function normalizeInviteCode(input?: string | null): string {
  return (input || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

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
    lookingForGameToday: converted.lookingForGameToday === true,
    lookingForGameTodayUntil: toDate(raw.looking_for_game_today_until) ?? toDate(raw.lookingForGameTodayUntil),
    lookingForGameTodayUpdatedAt: toDate(raw.looking_for_game_today_updated_at) ?? toDate(raw.lookingForGameTodayUpdatedAt),
    inviteAcceptedAt: toDate(raw.invite_accepted_at) ?? toDate(raw.inviteAcceptedAt),
    createdAt: toDate(raw.created_at) ?? toDate(raw.createdAt),
    updatedAt: toDate(raw.updated_at) ?? toDate(raw.updatedAt),
  } as User;
}

function mergeUserStats(user: User, statsRaw: Record<string, unknown>, fallbackRaw: Record<string, unknown>): User {
  const stats = normalizePlayerStats(statsRaw, fallbackRaw, user.id);
  return {
    ...user,
    totalGames: stats.totalGames,
    totalGoals: stats.totalGoals,
    totalAssists: stats.totalAssists,
    totalWins: stats.totalWins,
    totalDraws: stats.totalDraws,
    totalLosses: stats.totalLosses,
    totalSaves: stats.totalSaves,
    mvpCount: stats.mvpCount,
    yellowCards: stats.yellowCards,
    redCards: stats.redCards,
    currentStreak: stats.currentStreak,
    bestStreak: stats.bestStreak,
  };
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole);
}

async function getClaimRole(firebaseUser: FirebaseUser): Promise<UserRole | null> {
  try {
    const token = await firebaseUser.getIdTokenResult(false);
    return isUserRole(token.claims.role) ? token.claims.role : null;
  } catch (err) {
    logger.debug('Não foi possível ler role das custom claims:', err);
    return null;
  }
}

function applyClaimRole(userData: User, claimRole: UserRole | null): User {
  if (!claimRole || userData.role === claimRole) return userData;
  return {...userData, role: claimRole};
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  currentUser: FirebaseUser | null; // Alias for firebaseUser
  loading: boolean;
  error: string | null;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (inviteCode?: string) => Promise<void>;
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

  /**
   * #3189: Vincula uma conta Google à conta email/senha atual via linkWithPopup.
   * Lança FirebaseError em falhas (auth/credential-already-in-use se o Google
   * já pertence a outra conta; auth/popup-* ; auth/requires-recent-login).
   */
  linkGoogleAccount: () => Promise<void>;

  /**
   * #3189: Desvincula a conta Google. Guard: só permite se restar um método
   * de login primário (password) — telefone NÃO conta como primário.
   */
  unlinkGoogleAccount: () => Promise<void>;
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
  const lastClaimSyncUidRef = useRef<string | null>(null);

  // Fetch user data from Firestore
  // FIX #578: PII (email, fcm_token, birth_date, height_cm, weight_kg, gender)
  // está em `users_private/{uid}` (only owner reads). Merge users + users_private
  // pra construir User completo (apenas pro próprio user — owner-only access).
  const fetchUserData = async (
    uid: string,
    options: { includePrivate?: boolean; includeStats?: boolean } = {},
  ): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) return null;

      const raw = userDoc.data();
      const converted = snakeToCamel(raw);

      const includeStats = options.includeStats === true;
      const [statsDoc, streakSnap, privateDoc] = await Promise.all([
        includeStats ? getDoc(doc(db, 'statistics', uid)) : Promise.resolve(null),
        includeStats
          ? getDocs(query(collection(db, 'user_streaks'), where('user_id', '==', uid), limit(1)))
          : Promise.resolve(null),
        options.includePrivate
          ? getDoc(doc(db, 'users_private', uid)).catch((privateErr) => {
            logger.debug('users_private read denied:', privateErr);
            return null;
          })
          : Promise.resolve(null),
      ]);

      const piiData = privateDoc?.exists() ? snakeToCamel(privateDoc.data()) : {};
      const statsRaw = statsDoc?.exists() ? statsDoc.data() : {};
      const streakRaw = streakSnap?.docs[0]?.data() ?? {};

      return mergeUserStats(normalizeUserData(
        { ...converted, ...piiData },
        userDoc.id,
        raw,
      ), { ...statsRaw, ...streakRaw }, raw);
    } catch (err) {
      logger.error('Error fetching user data:', err);
      setError(t('feedback.generic.loadDataError'));
      return null;
    }
  };

  // Create user document if doesn't exist
  // FIX #1555: usa runTransaction para evitar race condition em logins simultâneos
  // (duas abas podiam fazer getDoc+setDoc independentes para o mesmo uid)
  const createUserDocument = async (firebaseUser: FirebaseUser, additionalData?: Record<string, unknown>) => {
    const userRef = doc(db, 'users', firebaseUser.uid);

    try {
      return await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          const invitedByCode = normalizeInviteCode(additionalData?.invited_by_code as string | undefined);
          if (!invitedByCode) {
            throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
          }

          const { displayName, photoURL } = firebaseUser;
          const userData = {
            email: firebaseUser.email || '',
            name: displayName || 'Usuário',
            nickname: '',
            photo_url: photoURL || '',
            role: 'PLAYER',
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
            invited_by_code: invitedByCode,
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
      if (isInviteRequiredError(err)) {
        throw err;
      }
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
          let userData = await fetchUserDataRef.current(firebaseUser.uid);
          const claimRole = await getClaimRole(firebaseUser);

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
            const effectiveUserData = applyClaimRole(userData, claimRole);
            setUser(effectiveUserData);
            if (
              (effectiveUserData.role === 'FIELD_OWNER' || effectiveUserData.role === 'ADMIN') &&
              lastClaimSyncUidRef.current !== firebaseUser.uid
            ) {
              lastClaimSyncUidRef.current = firebaseUser.uid;
              loadSyncFieldOwnerClaim()
                .then((syncFieldOwnerClaim) => syncFieldOwnerClaim())
                .then((result) => {
                  if (result.data.synced) {
                    logger.info('Claim synced after auth load:', result.data.role);
                    firebaseUserRef.current?.getIdToken(true).then(() => markClaimRefresh());
                  }
                })
                .catch((err) => {
                  logger.debug('Claim sync skipped or failed:', err);
                });
            }
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
          if (isInviteRequiredError(err)) {
            await signOut(auth).catch((signOutErr) => {
              logger.warn('Falha ao encerrar sessão sem convite:', signOutErr);
            });
            setFirebaseUser(null);
          }
          setUser(null);
          setLoading(false);
          // #3187: erros de convite passam pelo mapper (mensagem acionável i18n)
          setError(isInviteRequiredError(err) ?
            getAuthErrorMessage(err, t('feedback.auth.verifyAuthError')) :
            t('feedback.auth.verifyAuthError'));
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
      // #3187: nunca expor mensagem crua do Firebase no estado global de erro
      setError(getAuthErrorMessage(err, t('auth.loginFailed')));
      throw err;
    }
  }, [t]);

  // Sign in with Google
  // #3186: para usuários NOVOS o convite é validado SERVER-SIDE (validateInviteCode)
  // ANTES de criar o doc — antes só o fluxo email/senha validava, e o gate de
  // convite podia ser contornado logando com Google.
  const signInWithGoogle = useCallback(async (inviteCode?: string) => {
    setError(null);
    try {
      const normalizedInviteCode = normalizeInviteCode(inviteCode);
      const result = await signInWithPopup(auth, googleProvider);

      // Uma única leitura distingue usuário novo (sem doc) de existente.
      // Existente NÃO passa por checagem de convite; onAuthStateChanged carrega o perfil.
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (!userSnap.exists()) {
        const isNewAuthUser = getAdditionalUserInfo(result)?.isNewUser === true;

        // Convite ausente/ inválido: remove a conta Auth recém-criada (não deixa
        // órfã) e encerra a sessão. Se o delete falhar (ex.: requires-recent-login),
        // ainda assim faz signOut.
        const cleanupRejectedNewUser = async () => {
          if (isNewAuthUser) {
            try {
              await result.user.delete();
            } catch (deleteErr) {
              logger.warn('Falha ao remover conta Auth recém-criada sem convite:', deleteErr);
            }
          }
          await signOut(auth).catch((signOutErr) => {
            logger.warn('Falha ao encerrar sessão Google sem convite:', signOutErr);
          });
        };

        if (!normalizedInviteCode) {
          await cleanupRejectedNewUser();
          throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
        }

        const validateInviteCode = await loadValidateInviteCode();
        let inviteValidation: Awaited<ReturnType<typeof validateInviteCode>>;
        try {
          inviteValidation = await validateInviteCode({ inviteCode: normalizedInviteCode });
        } catch (validationErr) {
          logger.error('validateInviteCode falhou no fluxo Google:', validationErr);
          await cleanupRejectedNewUser();
          throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE);
        }
        if (!inviteValidation.data.valid || !inviteValidation.data.inviteCode) {
          await cleanupRejectedNewUser();
          throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE);
        }

        const created = await createUserDocumentRef.current(result.user, {
          invited_by_code: inviteValidation.data.inviteCode,
          invite_source: 'google',
        });
        if (!created) {
          await cleanupRejectedNewUser();
          throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
        }
      }
    } catch (err: unknown) {
      if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') return;
      // FIX #942 + #3187: sempre mapear pelo código (inclui account-exists-with-
      // different-credential e os códigos app/invite-*) — nunca mensagem crua.
      setError(getAuthErrorMessage(err, t('auth.googleLoginFailed')));
      throw err;
    }
  }, [t]);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name: string, inviteCode?: string) => {
    setError(null);
    try {
      const normalizedInviteCode = normalizeInviteCode(inviteCode);
      if (!normalizedInviteCode) {
        throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
      }

      const validateInviteCode = await loadValidateInviteCode();
      const inviteValidation = await validateInviteCode({ inviteCode: normalizedInviteCode });
      if (!inviteValidation.data.valid || !inviteValidation.data.inviteCode) {
        throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE);
      }

      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      // NOTA (#1023): forçar refresh do token ANTES de qualquer escrita no Firestore
      try {
        await result.user.getIdToken(true);
        markClaimRefresh();
      } catch (tokenErr) {
        logger.warn('Falha ao forçar refresh de token após cadastro:', tokenErr);
      }

      await createUserDocumentRef.current(result.user, {
        name,
        invited_by_code: inviteValidation.data.inviteCode,
        invite_source: 'email_password',
      });
    } catch (err) {
      // #3187: mapeia por código (inclui app/invite-*) — nunca mensagem crua
      setError(getAuthErrorMessage(err, t('auth.registerFailed')));
      throw err;
    }
  }, [t]);

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
      setError(getAuthErrorMessage(err, t('feedback.auth.logoutError')));
      throw err;
    }
  }, [t]);

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
      setError(getAuthErrorMessage(err, t('feedback.auth.resetPasswordError')));
      throw err;
    }
  }, [t]);

  // Refresh user data
  // FIX #1567: não wipa user=null em falha — mantém estado anterior e seta erro
  const refreshUser = useCallback(async () => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    try {
      const userData = await fetchUserDataRef.current(currentUser.uid, { includePrivate: true, includeStats: true });
      if (userData) {
        const claimRole = await getClaimRole(currentUser);
        setUser(applyClaimRole(userData, claimRole));
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

  // #3189: Vincular conta Google a uma conta email/senha existente.
  const linkGoogleAccount = useCallback(async () => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    try {
      await linkWithPopup(currentUser, googleProvider);
      // Recarrega o FirebaseUser para refletir o novo provider em providerData.
      await currentUser.reload();
      setFirebaseUser({ ...currentUser } as FirebaseUser);
    } catch (err) {
      // Popup fechado pelo usuário não é erro — silencioso (padrão do projeto).
      if (err instanceof FirebaseError && err.code === 'auth/popup-closed-by-user') return;
      logger.error('Error linking Google account:', err);
      throw err;
    }
  }, []);

  // #3189: Desvincular conta Google. Guard: nunca deixar a conta sem método
  // de login primário (telefone não conta como primário).
  const unlinkGoogleAccount = useCallback(async () => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    const providers = currentUser.providerData.map((p) => p.providerId);
    const hasPassword = providers.includes('password');
    if (!hasPassword) {
      // Sem fallback de login por senha — bloqueia o desvinculamento.
      throw new Error('app/require-primary-method');
    }
    try {
      await unlink(currentUser, 'google.com');
      await currentUser.reload();
      setFirebaseUser({ ...currentUser } as FirebaseUser);
    } catch (err) {
      logger.error('Error unlinking Google account:', err);
      throw err;
    }
  }, []);

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
    linkGoogleAccount,
    unlinkGoogleAccount,
  }), [firebaseUser, user, loading, error, updatingProfile, signIn, signInWithGoogle, signUp, logout, resetPassword, updateUserProfile, refreshUser, refreshClaims, linkGoogleAccount, unlinkGoogleAccount]);

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
