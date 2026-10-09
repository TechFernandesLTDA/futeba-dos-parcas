import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, ReactNode } from 'react';
import {

  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  getAdditionalUserInfo,
  linkWithPopup,
  unlink,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, getDoc, getDocs, updateDoc, runTransaction, serverTimestamp, query, collection, where, limit, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { queryClient } from '../services/queryClient';
import { User } from '../types';
import type { UserRole } from '../types/user';
import { snakeToCamel } from '../utils/firestoreHelpers';
import { createLogger } from '../utils/logger';
import { revealApp, setAuthHint } from '../utils/prerenderHandoff';
import { getAuthErrorMessage, AppAuthError, APP_AUTH_ERROR_CODES } from '../utils/firebaseErrors';
import { addBreadcrumb, clearBreadcrumbs } from '../utils/errorContext';
import { markClaimRefresh, resetClaimRefreshState } from '../utils/authRetry';
import { useTranslation } from 'react-i18next';
import type { validateInviteCode as validateInviteCodeType, syncFieldOwnerClaim as syncFieldOwnerClaimType } from '../services/cloudFunctions';
import { normalizePlayerStats } from '../utils/playerStats';
import { getEffectiveLevel, getExperiencePoints } from '../utils/xpAccounting';
import { unregisterBrowserFcmToken } from '../services/firebaseMessaging';
import { trackEvent } from '../utils/analytics';
import { clearGroupWallMediaOutboxOwner } from '../utils/groupWallMediaOutbox';

const logger = createLogger('AuthContext');
const USER_ROLES: UserRole[] = ['PLAYER', 'FIELD_OWNER', 'ADMIN'];
const INVITE_REQUIRED_MESSAGE = 'Para criar sua conta, abra um convite de outro membro do Futeba dos Parças.';
const INVITE_INVALID_MESSAGE = 'Convite inválido ou expirado. Peça um novo convite para quem te chamou.';
const AUTH_STARTUP_WATCHDOG_MS = 8_000;
// #3192: persiste o convite pendente entre o redirect do Google e o retorno.
// O signInWithRedirect recarrega a página inteira — refs/state do React não
// sobrevivem. sessionStorage (escopo da aba) carrega o convite até que
// getRedirectResult processe o resultado.
const PENDING_GOOGLE_INVITE_KEY = 'futeba:pending-google-invite';
// ID tokens do Firebase duram uma hora. Aos 55 minutos, getIdToken(false)
// renova apenas quando o token está vencido ou a até cinco minutos de vencer.
const AUTH_TOKEN_REFRESH_INTERVAL_MS = 55 * 60 * 1_000;

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
  const xp = getExperiencePoints({ ...raw, ...converted });
  return {
    ...converted,
    id,
    name: (converted.name as string) || 'Usuário',
    experiencePoints: xp,
    level: getEffectiveLevel({ ...raw, ...converted }, xp),
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
   *
   * @param options.expectedClaim Quando informado, verifica se o claim propagou
   *   no novo token e tenta novamente até 3x com backoff (eventual consistency).
   * @param options.expectedValue Valor esperado para o claim informado.
   */
  refreshClaims: (options?: { expectedClaim?: string; expectedValue?: unknown }) => Promise<void>;

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
  const tRef = useRef(t);
  tRef.current = t;
  const sessionUid = firebaseUser?.uid ?? null;
  const lastTokenRefreshAtRef = useRef(Date.now());
  const lastClaimSyncUidRef = useRef<string | null>(null);
  const pendingInviteRef = useRef<{ code: string; source: string } | null>(null);
  const processingRedirectNewUserRef = useRef(false);

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
    // Trocas rápidas de conta disparavam 2 fetchUserData
    // concorrentes, last-resolve-wins → user object stale.
    // Agora: rastreia uid em closure local; descarta resultados se uid
    // mudou enquanto o fetch estava pendente.
    let lastFetchUid: string | null = null;
    let initialAuthResolved = false;

    const handleAuthStateChange = async (firebaseUser: FirebaseUser | null) => {
      const currentUid = firebaseUser?.uid ?? null;
      const previousUid = prevUserRef.current?.uid ?? null;
      lastFetchUid = currentUid;

      if (previousUid && previousUid !== currentUid) {
        // Escopar por UID impede exposição à nova conta; a limpeza assíncrona
        // remove também o Blob privado deixado pela identidade anterior.
        void clearGroupWallMediaOutboxOwner(previousUid).catch((outboxError) => {
          logger.warn('Falha ao limpar anexos pendentes na troca de conta', outboxError);
        });
        // #4001: cobre perda de sessão SEM logout explícito — ex.: revogação
        // de refresh tokens pelo setUserRole (mudança de role por admin) ou
        // expiração de sessão. Sem isto, o cache do TanStack Query serve dados
        // da identidade anterior para a próxima sessão no mesmo browser.
        queryClient.clear();
      }

      try {
        if (firebaseUser?.uid !== prevUserRef.current?.uid) {
          setLoading(true);
        }
        prevUserRef.current = firebaseUser;
        setFirebaseUser(firebaseUser);

        if (firebaseUser) {
          let userData = await fetchUserDataRef.current(firebaseUser.uid, { includeStats: true });
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
            if (processingRedirectNewUserRef.current) {
              return;
            }
            const pendingInvite = pendingInviteRef.current;
            userData = await createUserDocumentRef.current(
              firebaseUser,
              pendingInvite
                ? {
                    invited_by_code: pendingInvite.code,
                    invite_source: pendingInvite.source,
                  }
                : undefined,
            );
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
    };

    const startupWatchdog = window.setTimeout(() => {
      if (initialAuthResolved) return;
      initialAuthResolved = true;
      logger.warn('Auth observer did not resolve during startup; continuing with current auth state.');
      void handleAuthStateChange(auth.currentUser);
    }, AUTH_STARTUP_WATCHDOG_MS);

    const resolveInitialAuth = () => {
      if (initialAuthResolved) return;
      initialAuthResolved = true;
      window.clearTimeout(startupWatchdog);
    };

    // #3192: processa o resultado de um signInWithRedirect do Google.
    // Deve rodar UMA VEZ no startup da aplicação, antes/de forma concorrente
    // com onAuthStateChanged. O callback onAuthStateChanged dispara DEPOIS de
    // getRedirectResult resolver — portanto o pendingInviteRef restaurado
    // abaixo já estará disponível quando handleAuthStateChange criar o doc.
    //
    // Sincronamente (antes de qualquer await): restaura o convite persistido
    // em sessionStorage para pendingInviteRef, garantindo que o onAuthStateChanged
    // tenha o convite ao criar o perfil do novo usuário Google via redirect.
    try {
      const storedInvite = sessionStorage.getItem(PENDING_GOOGLE_INVITE_KEY);
      if (storedInvite) {
        const parsed = JSON.parse(storedInvite) as { code: string; source: string };
        if (parsed?.code) {
          pendingInviteRef.current = parsed;
        }
      }
    } catch (sessionErr) {
      logger.debug('Não foi possível ler convite pendente do sessionStorage:', sessionErr);
    }

    getRedirectResult(auth)
      .then(async (result) => {
        try {
          sessionStorage.removeItem(PENDING_GOOGLE_INVITE_KEY);
        } catch {
          /* ignore */
        }
        if (!result) return;

        const isNewAuthUser = getAdditionalUserInfo(result)?.isNewUser === true;
        if (!isNewAuthUser) return;

        const pendingInvite = pendingInviteRef.current;
        pendingInviteRef.current = null;
        processingRedirectNewUserRef.current = true;

        const cleanupRejectedNewUser = async () => {
          try {
            await result.user.delete();
          } catch (deleteErr) {
            logger.warn('Falha ao remover conta Auth recém-criada no redirect Google:', deleteErr);
          }
          await signOut(auth).catch((signOutErr) => {
            logger.warn('Falha ao encerrar sessão Google redirect:', signOutErr);
          });
          queryClient.clear();
        };

        try {
          const userSnap = await getDoc(doc(db, 'users', result.user.uid));
          if (userSnap.exists()) {
            trackEvent('registration_completed', { method: 'google' });
            return;
          }

          if (!pendingInvite?.code) {
            await cleanupRejectedNewUser();
            setError(getAuthErrorMessage(
              new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE),
              t('feedback.auth.verifyAuthError'),
            ));
            return;
          }

          const validateInviteCode = await loadValidateInviteCode();
          let inviteValidation: Awaited<ReturnType<typeof validateInviteCode>>;
          try {
            inviteValidation = await validateInviteCode({ inviteCode: pendingInvite.code });
          } catch (validationErr) {
            logger.error('validateInviteCode falhou no redirect Google:', validationErr);
            await cleanupRejectedNewUser();
            setError(getAuthErrorMessage(
              new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE),
              t('feedback.auth.verifyAuthError'),
            ));
            return;
          }
          if (!inviteValidation.data.valid || !inviteValidation.data.inviteCode) {
            await cleanupRejectedNewUser();
            setError(getAuthErrorMessage(
              new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE),
              t('feedback.auth.verifyAuthError'),
            ));
            return;
          }

          const created = await createUserDocumentRef.current(result.user, {
            invited_by_code: inviteValidation.data.inviteCode,
            invite_source: 'google',
          });
          if (!created) {
            await cleanupRejectedNewUser();
            setError(getAuthErrorMessage(
              new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE),
              t('feedback.auth.verifyAuthError'),
            ));
            return;
          }
          trackEvent('registration_completed', { method: 'google' });

          const refreshed = await fetchUserDataRef.current(result.user.uid, { includeStats: true });
          if (refreshed) {
            const claimRole = await getClaimRole(result.user);
            setUser(applyClaimRole(refreshed, claimRole));
          }
        } catch (err) {
          logger.error('Erro ao processar novo usuário do redirect Google:', err);
          await cleanupRejectedNewUser();
          setError(getAuthErrorMessage(
            new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE),
            t('feedback.auth.verifyAuthError'),
          ));
        } finally {
          processingRedirectNewUserRef.current = false;
          setLoading(false);
        }
      })
      .catch((redirectErr) => {
        logger.error('getRedirectResult falhou:', redirectErr);
        try {
          sessionStorage.removeItem(PENDING_GOOGLE_INVITE_KEY);
        } catch {
          /* ignore */
        }
        pendingInviteRef.current = null;
        processingRedirectNewUserRef.current = false;
        if (
          redirectErr instanceof FirebaseError &&
          (redirectErr.code === 'auth/cancelled-redirect-request' ||
            redirectErr.code === 'auth/popup-closed-by-user')
        ) {
          return;
        }
        setError(getAuthErrorMessage(redirectErr, t('auth.googleLoginFailed')));
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      resolveInitialAuth();
      // #4196: dica para o guard do shell não mostrar o hero estático da home a quem já está logado.
      setAuthHint(Boolean(firebaseUser));
      if (firebaseUser && window.location.pathname === '/') revealApp();
      await handleAuthStateChange(firebaseUser);
    },
    (err) => {
      resolveInitialAuth();
      logger.error('onAuthStateChanged observer error:', err);
      setError(t('feedback.auth.monitorAuthError'));
      setLoading(false);
    });

    return () => {
      window.clearTimeout(startupWatchdog);
      unsubscribe();
    };
  }, [t]);

  // Mantém a sessão Firebase ativa sem reautenticar, recarregar o perfil ou
  // tocar no registro do Firebase Cloud Messaging. O token FCM identifica a
  // instalação do navegador e tem ciclo de vida independente do ID token Auth.
  useEffect(() => {
    lastTokenRefreshAtRef.current = Date.now();

    const refreshSessionToken = async () => {
      const currentUser = auth.currentUser ?? firebaseUserRef.current;
      if (!currentUser || !navigator.onLine) return;

      try {
        await currentUser.getIdToken(false);
        lastTokenRefreshAtRef.current = Date.now();
        logger.debug('ID token da sessão verificado e renovado quando necessário.');
      } catch (refreshError) {
        // Falha transitória não encerra a sessão: o SDK tenta novamente na
        // próxima chamada autenticada ou no próximo intervalo.
        logger.warn('Não foi possível renovar o ID token da sessão.', refreshError);
      }
    };

    const intervalId = window.setInterval(
      () => void refreshSessionToken(),
      AUTH_TOKEN_REFRESH_INTERVAL_MS,
    );
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastTokenRefreshAtRef.current >= AUTH_TOKEN_REFRESH_INTERVAL_MS
      ) {
        void refreshSessionToken();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [sessionUid]);

  useEffect(() => {
    if (!sessionUid) return;

    let cancelled = false;
    let latestStatsRaw: Record<string, unknown> = {};
    let latestStreakRaw: Record<string, unknown> = {};

    const applyLiveStats = () => {
      if (cancelled) return;

      setUser((previousUser) => {
        if (!previousUser || previousUser.id !== sessionUid) return previousUser;
        return mergeUserStats(
          previousUser,
          { ...latestStatsRaw, ...latestStreakRaw },
          previousUser as unknown as Record<string, unknown>,
        );
      });
    };

    const handleListenerError = (source: 'statistics' | 'user_streaks', listenerError: unknown) => {
      if (cancelled) return;
      logger.error(`Erro ao assinar ${source} do usuário autenticado:`, listenerError);
      setError(tRef.current('feedback.generic.loadDataError'));
    };

    const unsubscribeStats = onSnapshot(
      doc(db, 'statistics', sessionUid),
      (snapshot) => {
        latestStatsRaw = snapshot.exists() ? snapshot.data() : {};
        applyLiveStats();
      },
      (listenerError) => handleListenerError('statistics', listenerError),
    );

    const unsubscribeStreak = onSnapshot(
      query(collection(db, 'user_streaks'), where('user_id', '==', sessionUid), limit(1)),
      (snapshot) => {
        latestStreakRaw = snapshot.docs[0]?.data() ?? {};
        applyLiveStats();
      },
      (listenerError) => handleListenerError('user_streaks', listenerError),
    );

    return () => {
      cancelled = true;
      unsubscribeStats();
      unsubscribeStreak();
    };
  }, [sessionUid]);

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
      // FIX #3983: medir tempo até rejeição do popup. Em mobile, o fechamento
      // automático do navegador ocorre em dezenas de ms; um cancelamento
      // humano leva >1s. Só cair no redirect quando for curto — no desktop,
      // fechar o pop-up volta a ser no-op silencioso (padrão do projeto,
      // alinhado com linkGoogleAccount e firebaseErrors.ts).
      const popupStartedAt = Date.now();
    try {
      const normalizedInviteCode = normalizeInviteCode(inviteCode);
      pendingInviteRef.current = normalizedInviteCode
        ? { code: normalizedInviteCode, source: 'google_auth_observer' }
        : null;
      const result = await signInWithPopup(auth, googleProvider);
      const isNewAuthUser = getAdditionalUserInfo(result)?.isNewUser === true;

      // Uma única leitura distingue usuário novo (sem doc) de existente.
      // Existente NÃO passa por checagem de convite; onAuthStateChanged carrega o perfil.
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (!userSnap.exists()) {
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

        try {
          if (!normalizedInviteCode) {
            throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
          }

          const validateInviteCode = await loadValidateInviteCode();
          let inviteValidation: Awaited<ReturnType<typeof validateInviteCode>>;
          try {
            inviteValidation = await validateInviteCode({ inviteCode: normalizedInviteCode });
          } catch (validationErr) {
            logger.error('validateInviteCode falhou no fluxo Google:', validationErr);
            throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE);
          }
          if (!inviteValidation.data.valid || !inviteValidation.data.inviteCode) {
            throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteInvalid, INVITE_INVALID_MESSAGE);
          }

          const created = await createUserDocumentRef.current(result.user, {
            invited_by_code: inviteValidation.data.inviteCode,
            invite_source: 'google',
          });
          if (!created) {
            throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
          }
        } catch (newUserErr) {
          await cleanupRejectedNewUser();
          throw newUserErr;
        }
      }
      if (isNewAuthUser) {
        trackEvent('registration_completed', { method: 'google' });
      }
      pendingInviteRef.current = null;
    } catch (err: unknown) {
      // #3192: fallback para signInWithRedirect quando o popup falha — ocorre
      // em navegadores mobile (iOS Safari, Chrome Android) e com bloqueadores
      // de pop-up. auth/popup-closed-by-user também entra no fallback QUANDO
      // o fechamento é automático do mobile (tempo < POPUP_AUTO_CLOSE_MS).
      // No desktop, o usuário fechando o pop-up manualmente é cancelamento
      // silencioso (return), alinhado com linkGoogleAccount e o padrão do
      // projeto documentado em firebaseErrors.ts (#3983).
      const POPUP_AUTO_CLOSE_MS = 1500;
      const elapsedMs = Date.now() - popupStartedAt;
      const isAutoClosed = err instanceof FirebaseError &&
        err.code === 'auth/popup-closed-by-user' && elapsedMs < POPUP_AUTO_CLOSE_MS;
      if (
        err instanceof FirebaseError &&
        (err.code === 'auth/popup-blocked' || isAutoClosed)
      ) {
        // Persiste o convite em sessionStorage — o redirect recarrega a página
        // inteira e refs/state do React não sobrevivem. O AuthProvider restaura
        // pendingInviteRef a partir do sessionStorage no startup, antes de
        // onAuthStateChanged criar o perfil do novo usuário Google.
        const pendingInvite = pendingInviteRef.current;
        if (pendingInvite) {
          try {
            sessionStorage.setItem(
              PENDING_GOOGLE_INVITE_KEY,
              JSON.stringify(pendingInvite),
            );
          } catch (sessionErr) {
            logger.debug('Não foi possível persistir convite no sessionStorage:', sessionErr);
          }
        }
        try {
          await signInWithRedirect(auth, googleProvider);
          // signInWithRedirect inicia a navegação para o Google. A página será
          // recarregada no retorno; getRedirectResult + onAuthStateChanged
          // processam o resultado. Retorna SEM limpar pendingInviteRef — ele
          // será restaurado do sessionStorage no próximo carregamento.
          return;
        } catch (redirectErr) {
          logger.error('signInWithRedirect falhou:', redirectErr);
          pendingInviteRef.current = null;
          try {
            sessionStorage.removeItem(PENDING_GOOGLE_INVITE_KEY);
          } catch {
            /* ignore */
          }
          setError(getAuthErrorMessage(redirectErr, t('auth.googleLoginFailed')));
          throw redirectErr;
        }
      }

      pendingInviteRef.current = null;
      // FIX #942 + #3187: sempre mapear pelo código (inclui account-exists-with-
      // different-credential e os códigos app/invite-*) — nunca mensagem crua.
      setError(getAuthErrorMessage(err, t('auth.googleLoginFailed')));
      throw err;
    }
  }, [t]);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string, name: string, inviteCode?: string) => {
    setError(null);
    let createdAuthUser: FirebaseUser | null = null;
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
      pendingInviteRef.current = {
        code: inviteValidation.data.inviteCode,
        source: 'email_password_auth_observer',
      };

      const result = await createUserWithEmailAndPassword(auth, email, password);
      createdAuthUser = result.user;
      await updateProfile(result.user, { displayName: name });

      // NOTA (#1023): forçar refresh do token ANTES de qualquer escrita no Firestore
      try {
        await result.user.getIdToken(true);
        markClaimRefresh();
      } catch (tokenErr) {
        logger.warn('Falha ao forçar refresh de token após cadastro:', tokenErr);
      }

      const created = await createUserDocumentRef.current(result.user, {
        name,
        invited_by_code: inviteValidation.data.inviteCode,
        invite_source: 'email_password',
      });
      if (!created) {
        throw new AppAuthError(APP_AUTH_ERROR_CODES.inviteRequired, INVITE_REQUIRED_MESSAGE);
      }
      trackEvent('registration_completed', { method: 'email' });
      pendingInviteRef.current = null;
    } catch (err) {
      if (createdAuthUser) {
        try {
          await createdAuthUser.delete();
        } catch (deleteErr) {
          logger.warn('Falha ao remover conta Auth recém-criada após erro no cadastro:', deleteErr);
        }
        await signOut(auth).catch((signOutErr) => {
          logger.warn('Falha ao encerrar sessão após erro no cadastro:', signOutErr);
        });
        queryClient.clear();
      }
      pendingInviteRef.current = null;
      // #3187: mapeia por código (inclui app/invite-*) — nunca mensagem crua
      setError(getAuthErrorMessage(err, t('auth.registerFailed')));
      throw err;
    }
  }, [t]);

  // Logout
  const logout = useCallback(async () => {
    setError(null);
    try {
      const currentUid = auth.currentUser?.uid ?? firebaseUserRef.current?.uid ?? null;
      addBreadcrumb('auth', 'Logout iniciado', { uid: currentUid });
      if (currentUid) {
        try {
          await clearGroupWallMediaOutboxOwner(currentUid);
        } catch (outboxError) {
          // Falha de IndexedDB não pode impedir o encerramento da sessão.
          logger.warn('Falha ao limpar anexos pendentes durante logout', outboxError);
        }
        await unregisterBrowserFcmToken(currentUid);
      }
      await signOut(auth);
      // Limpar cache do TanStack Query para evitar vazamento de dados entre contas
      queryClient.clear();
      // Limpa breadcrumbs após logout — próxima sessão começa limpa
      clearBreadcrumbs();
      // #4001: reseta o estado de retry de claims para a próxima sessão
      resetClaimRefreshState();
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
  const refreshClaims = useCallback(async (options?: {
    expectedClaim?: string;
    expectedValue?: unknown;
  }) => {
    const currentUser = firebaseUserRef.current;
    if (!currentUser) return;
    try {
      const maxAttempts = options?.expectedClaim ? 3 : 1;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await currentUser.getIdToken(true);
        markClaimRefresh();
        if (!options?.expectedClaim) break;
        try {
          const tokenResult = await currentUser.getIdTokenResult(false);
          if (tokenResult.claims[options.expectedClaim] === options.expectedValue) break;
        } catch (verifyErr) {
          logger.warn(`Verify claim attempt ${attempt}/${maxAttempts} falhou:`, verifyErr);
        }
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 500));
        }
      }
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
