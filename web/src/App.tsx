import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { addBreadcrumb } from './utils/errorContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { AuthProvider, ThemeProvider, LanguageProvider, useAuth, TeamsProvider } from './contexts';
import { Box } from '@mui/material';
import { ErrorBoundary, withErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { ConnectionStatus, useOnlineStatus } from './components/common/ConnectionStatus';
import { SkipNav } from './components/common/SkipNav';
import { LoadingScreen } from './components/common/LoadingScreen';
import { NotificationBell } from './components/common/NotificationBell';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { useNotifications } from './hooks/useNotifications';
import { AppLayout } from './components/layout';
import { CommandPalette } from './components/search/CommandPalette';
import { useIsGroupMember } from './hooks/useGroups';
import { useToast } from './contexts/ToastContext';


// Splash & Onboarding
const SplashScreen = lazy(() => import('./pages/splash/SplashScreen').then(m => ({ default: m.SplashScreen })));
const WelcomeScreen = lazy(() => import('./pages/onboarding/WelcomeScreen').then(m => ({ default: m.WelcomeScreen })));
import { VerificationBanner } from './components/auth/VerificationBanner';
const PhoneVerificationScreen = lazy(() => import('./pages/onboarding/PhoneVerificationScreen').then(m => ({ default: m.PhoneVerificationScreen })));
const CpfVerificationScreen = lazy(() => import('./pages/onboarding/CpfVerificationScreen').then(m => ({ default: m.CpfVerificationScreen })));
const ProfileSetupScreen = lazy(() => import('./pages/onboarding/ProfileSetupScreen').then(m => ({ default: m.ProfileSetupScreen })));
const AppGuideScreen = lazy(() => import('./pages/onboarding/AppGuideScreen').then(m => ({ default: m.AppGuideScreen })));

// Auth
const LoginScreen = lazy(() => import('./pages/auth/LoginScreen').then(m => ({ default: m.LoginScreen })));
const RegisterScreen = lazy(() => import('./pages/auth/RegisterScreen').then(m => ({ default: m.RegisterScreen })));
const ForgotPasswordScreen = lazy(() => import('./pages/auth/ForgotPasswordScreen').then(m => ({ default: m.ForgotPasswordScreen })));

// Home
const HomeScreen = lazy(() => import('./pages/home/HomeScreen').then(m => ({ default: m.HomeScreen })));

// Games
const GamesScreen = lazy(() => import('./pages/games/GamesScreen').then(m => ({ default: m.GamesScreen })));
const GameDetailScreen = lazy(() => import('./pages/game/GameDetailScreen').then(m => ({ default: m.GameDetailScreen })));
const CreateGameScreen = lazy(() => import('./pages/game/CreateGameScreen').then(m => ({ default: m.CreateGameScreen })));
const LiveGameScreen = lazy(() => import('./pages/game/LiveGameScreen').then(m => ({ default: m.LiveGameScreen })));
const MVPVoteScreen = lazy(() => import('./pages/game/MVPVoteScreen').then(m => ({ default: m.MVPVoteScreen })));
const VoteResultScreen = lazy(() => import('./pages/game/VoteResultScreen').then(m => ({ default: m.VoteResultScreen })));
const TeamFormationScreen = lazy(() => import('./pages/games/TeamFormationScreen').then(m => ({ default: m.TeamFormationScreen })));
const PostGameReportScreen = lazy(() => import('./pages/games/PostGameReportScreen').then(m => ({ default: m.PostGameReportScreen })));
const BlockedPlayersScreen = lazy(() => import('./pages/games/owner/BlockedPlayersScreen').then(m => ({ default: m.BlockedPlayersScreen })));
const SchedulesScreen = lazy(() => import('./pages/schedules/SchedulesScreen').then(m => ({ default: m.SchedulesScreen })));

// Live Game
const LiveStatsScreen = lazy(() => import('./pages/livegame/LiveStatsScreen').then(m => ({ default: m.LiveStatsScreen })));
const LiveEventsScreen = lazy(() => import('./pages/livegame/LiveEventsScreen').then(m => ({ default: m.LiveEventsScreen })));

// Groups
const GroupsScreen = lazy(() => import('./pages/groups/GroupsScreen').then(m => ({ default: m.GroupsScreen })));
const GroupDetailScreen = lazy(() => import('./pages/group/GroupDetailScreen').then(m => ({ default: m.GroupDetailScreen })));
const CreateGroupScreen = lazy(() => import('./pages/group/CreateGroupScreen').then(m => ({ default: m.CreateGroupScreen })));
const GroupEditScreen = lazy(() => import('./pages/group/GroupEditScreen').then(m => ({ default: m.GroupEditScreen })));
const GroupSettingsScreen = lazy(() => import('./pages/group/GroupSettingsScreen').then(m => ({ default: m.GroupSettingsScreen })));
const CashboxScreen = lazy(() => import('./pages/groups/CashboxScreen').then(m => ({ default: m.CashboxScreen })));
const InvitePlayersScreen = lazy(() => import('./pages/groups/InvitePlayersScreen').then(m => ({ default: m.InvitePlayersScreen })));
const JoinByInviteScreen = lazy(() => import('./pages/group/JoinByInviteScreen').then(m => ({ default: m.JoinByInviteScreen })));
const DiscoverGroupsScreen = lazy(() => import('./pages/group/DiscoverGroupsScreen').then(m => ({ default: m.DiscoverGroupsScreen })));
const PlayersScreen = lazy(() => import('./pages/players/PlayersScreen').then(m => ({ default: m.PlayersScreen })));

// Profile
const ProfileScreen = lazy(() => import('./pages/profile/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const EditProfileScreen = lazy(() => import('./pages/profile/EditProfileScreen').then(m => ({ default: m.EditProfileScreen })));
const LevelJourneyScreen = lazy(() => import('./pages/profile/LevelJourneyScreen').then(m => ({ default: m.LevelJourneyScreen })));

// Statistics
const StatisticsScreen = lazy(() => import('./pages/statistics/StatisticsScreen').then(m => ({ default: m.StatisticsScreen })));
const WeeklyRecapScreen = lazy(() => import('./pages/statistics/WeeklyRecapScreen').then(m => ({ default: m.WeeklyRecapScreen })));
const EvolutionScreen = lazy(() => import('./pages/statistics/EvolutionScreen').then(m => ({ default: m.EvolutionScreen })));

// Rankings & League
const RankingScreen = lazy(() => import('./pages/ranking/RankingScreen').then(m => ({ default: m.RankingScreen })));
const LeagueScreen = lazy(() => import('./pages/league/LeagueScreen').then(m => ({ default: m.LeagueScreen })));
const BadgesScreen = lazy(() => import('./pages/badges/BadgesScreen').then(m => ({ default: m.BadgesScreen })));

// Locations
const LocationDetailScreen = lazy(() => import('./pages/locations/LocationDetailScreen').then(m => ({ default: m.LocationDetailScreen })));
const ManageLocationsScreen = lazy(() => import('./pages/locations/ManageLocationsScreen').then(m => ({ default: m.ManageLocationsScreen })));
const LocationFormScreen = lazy(() => import('./pages/locations/LocationFormScreen').then(m => ({ default: m.LocationFormScreen })));
const FieldOwnerDashboardScreen = lazy(() => import('./pages/locations/FieldOwnerDashboardScreen').then(m => ({ default: m.FieldOwnerDashboardScreen })));

// Map
const PublicGamesMapScreen = lazy(() => import('./pages/map/PublicGamesMapScreen').then(m => ({ default: m.PublicGamesMapScreen })));
const LocationsMapScreen = lazy(() => import('./pages/map/LocationsMapScreen').then(m => ({ default: m.LocationsMapScreen })));

// Tactical
const TacticalBoardScreen = lazy(() => import('./pages/tactical/TacticalBoardScreen').then(m => ({ default: m.TacticalBoardScreen })));

// Settings
const SettingsScreen = lazy(() => import('./pages/settings/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const ThemeSettingsScreen = lazy(() => import('./pages/settings/ThemeSettingsScreen').then(m => ({ default: m.ThemeSettingsScreen })));
const GamificationSettingsScreen = lazy(() => import('./pages/settings/GamificationSettingsScreen').then(m => ({ default: m.GamificationSettingsScreen })));
const MyFeedbacksScreen = lazy(() => import('./pages/settings/MyFeedbacksScreen').then(m => ({ default: m.MyFeedbacksScreen })));
const NotificationSettingsScreen = lazy(() => import('./pages/settings/NotificationSettingsScreen').then(m => ({ default: m.NotificationSettingsScreen })));

// Notifications & Search
const NotificationsScreen = lazy(() => import('./pages/ranking/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })));
const GlobalSearchScreen = lazy(() => import('./pages/search/GlobalSearchScreen').then(m => ({ default: m.GlobalSearchScreen })));

// About & Admin
const AboutScreen = lazy(() => import('./pages/about/AboutScreen').then(m => ({ default: m.AboutScreen })));
const UserManagementScreen = lazy(() => import('./pages/admin/UserManagementScreen').then(m => ({ default: m.UserManagementScreen })));
const DevToolsScreen = lazy(() => import('./pages/devtools/DevToolsScreen').then(m => ({ default: m.DevToolsScreen })));

// Error pages
const NotFoundScreen = lazy(() => import('./pages/error/NotFoundScreen').then(m => ({ default: m.NotFoundScreen })));

function RouteFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <Box
        sx={{
          width: 24,
          height: 24,
          border: '2px solid',
          borderColor: 'primary.main',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
          '@keyframes spin': {
            '0%': { transform: 'rotate(0deg)' },
            '100%': { transform: 'rotate(360deg)' },
          },
        }}
        role="status"
        aria-label="Carregando página"
      />
    </Box>
  );
}

function AppLoadingFallback() {
  return <LoadingScreen variant="cards" message="Carregando..." />;
}

/**
 * Hook compartilhado para checar o custom claim `verified` do ID token.
 * Retorna `null` enquanto aguarda a resolução, `true`/`false` quando resolvido.
 */
function useVerifiedClaim(firebaseUser: ReturnType<typeof useAuth>['firebaseUser']): boolean | null {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setVerified(null);
      return;
    }
    let cancelled = false;
    firebaseUser
      .getIdTokenResult()
      .then((result) => {
        if (!cancelled) setVerified(result.claims.verified === true);
      })
      .catch(() => {
        if (!cancelled) setVerified(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  return verified;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();
  const verified = useVerifiedClaim(firebaseUser);

  if (loading) {
    return <AppLoadingFallback />;
  }

  // FIX #574 (C3): preserva location pra que LoginScreen redirecione user
  // de volta pro deep link após login. Antes: hardcoded `/`, perdendo destino.
  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Aguarda verificação do token (custom claim verified)
  if (verified === null) {
    return <AppLoadingFallback />;
  }

  // Onboarding: rotas /onboarding/* permitem !verified
  const isOnboardingRoute = location.pathname.startsWith('/onboarding/');
  if (verified === false && !isOnboardingRoute) {
    // FIX #1024: se já tem telefone verificado, vai direto pro CPF; caso contrário,
    // começa pelo telefone. Evita regredir o usuário que já completou essa etapa.
    const nextStep = firebaseUser.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
    return <Navigate to={nextStep} replace />;
  }

  return <>{children}</>;
}

/**
 * Restringe a rota a usuários com `verified === true` (custom claim).
 * Redireciona para onboarding se não verificado.
 */
function VerifiedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();
  const verified = useVerifiedClaim(firebaseUser);

  if (loading) return <AppLoadingFallback />;

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (verified === null) return <AppLoadingFallback />;

  if (verified === false) {
    const nextStep = firebaseUser.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
    return <Navigate to={nextStep} replace />;
  }

  return <>{children}</>;
}

/**
 * Restringe a rota a usuários ADMIN.
 * Redireciona pra `/` se o usuário autenticado não for ADMIN.
 */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoadingFallback />;
  // FIX #584/H5: distinguir unauth (→/login) de auth-mas-nao-admin (→/).
  // Antes: user==null caía em `user?.role !== 'ADMIN'` (true) e ia pra /,
  // criando silent gap (unauth user via home em vez de login).
  // FIX #574 (C3): preserva from-location pra restaurar deep link pós-login.
  if (!firebaseUser) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Restringe a rota a ADMIN ou FIELD_OWNER.
 * Usado pra telas de gerenciamento de quadras (donos podem editar suas quadras,
 * admin pode editar todas).
 */
function FieldOwnerOrAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, firebaseUser, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoadingFallback />;
  // FIX #584/H5: unauth user → /login (vide AdminRoute).
  // FIX #574 (C3): preserva from-location pra restaurar deep link pós-login.
  if (!firebaseUser) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user?.role !== 'ADMIN' && user?.role !== 'FIELD_OWNER') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * GAP-3: Guard de membership de grupo. Redireciona não-membros pra /group/:id
 * (detail page tem CTA amigável de entrar). Usado em rotas que exigem ser
 * membro: /edit, /settings, /cashbox, /invite.
 *
 * Por que existe: <ProtectedRoute> só checa auth, não membership. Antes desse
 * guard, não-membros viam UI carregar e só falhavam no write — leak de telas
 * privadas + UX confusa.
 */
function GroupMemberRoute({ children }: { children: React.ReactNode }) {
  const { groupId } = useParams<{ groupId: string }>();
  const { user, firebaseUser, loading } = useAuth();
  const isMember = useIsGroupMember(groupId);
  const { showError } = useToast();
  const [notified, setNotified] = useState(false);

  if (loading) return <AppLoadingFallback />;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  // Admin tem acesso global (consistente com rules)
  if (user?.role === 'ADMIN') return <>{children}</>;

  // Checagem em curso — mostra fallback (não bloqueia children desnecessariamente)
  if (isMember === undefined) return <AppLoadingFallback />;

  if (!isMember) {
    if (!notified) {
      // Feedback explícito para usuário entender o redirect
      showError('Você precisa ser membro do grupo para acessar essa página.');
      setNotified(true);
    }
    return <Navigate to={`/group/${groupId}`} replace />;
  }

  return <>{children}</>;
}

// GAP #8 (#1081): FieldOwnerRoute removido — era idêntico a FieldOwnerOrAdminRoute
// (ambos permitiam FIELD_OWNER ou ADMIN). Use FieldOwnerOrAdminRoute em todas as rotas.

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const verified = useVerifiedClaim(firebaseUser);

  if (loading) {
    return <AppLoadingFallback />;
  }

  if (firebaseUser) {
    // Aguarda resolução do claim antes de decidir destino — evita piscar
    if (verified === null) return <AppLoadingFallback />;

    // FIX #1024: usuário logado mas não-verificado NÃO vai pra `/` (causaria loop
    // ProtectedRoute → /onboarding/phone → PublicRoute → / → ProtectedRoute...).
    // Redireciona diretamente pro próximo passo do onboarding.
    if (verified === false) {
      const nextStep = firebaseUser.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
      return <Navigate to={nextStep} replace />;
    }

    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function useFocusOnNavigate() {
  const location = useLocation();

  useEffect(() => {
    const el = document.querySelector('#main-content') as HTMLElement;
    if (el) {
      el.setAttribute('tabIndex', '-1');
      el.focus();
    }
    // Registra breadcrumb de navegação para contexto em erros futuros
    addBreadcrumb('navigation', `Navegou para ${location.pathname}`, {
      pathname: location.pathname,
      search: location.search,
    });
  }, [location.pathname]);
}

function AppRoutes() {
  useFocusOnNavigate();
  useScrollRestoration();

  return (
    <Routes>
      {/* Splash & Onboarding */}
      {/* FIX #1024: /splash restrito a não-logados; usuário logado é redirecionado pelo PublicRoute */}
      <Route path="/splash" element={<PublicRoute><Suspense fallback={<RouteFallback />}><SplashScreen /></Suspense></PublicRoute>} />
      <Route path="/welcome" element={<PublicRoute><Suspense fallback={<RouteFallback />}><WelcomeScreen /></Suspense></PublicRoute>} />

      {/* Onboarding obrigatório: phone + CPF (Anti-Bot) */}
      <Route path="/onboarding/phone" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PhoneVerificationScreen /></Suspense></ProtectedRoute>} />
      <Route path="/onboarding/cpf" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><CpfVerificationScreen /></Suspense></ProtectedRoute>} />
      {/* FIX #1024: /profile/setup e /guide exigem verified=true (usuário completou onboarding) */}
      <Route path="/profile/setup" element={<VerifiedRoute><Suspense fallback={<RouteFallback />}><ProfileSetupScreen /></Suspense></VerifiedRoute>} />
      <Route path="/guide" element={<VerifiedRoute><Suspense fallback={<RouteFallback />}><AppGuideScreen /></Suspense></VerifiedRoute>} />

      {/* Auth */}
      <Route path="/login" element={<PublicRoute><Suspense fallback={<RouteFallback />}><LoginScreen /></Suspense></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Suspense fallback={<RouteFallback />}><RegisterScreen /></Suspense></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><Suspense fallback={<RouteFallback />}><ForgotPasswordScreen /></Suspense></PublicRoute>} />

      {/* Home */}
      <Route path="/" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><HomeScreen /></Suspense></ProtectedRoute>} />

      {/* Games */}
      <Route path="/games" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GamesScreen /></Suspense></ProtectedRoute>} />
      {/* Rotas detail/form com AppLayout (sidebar global desktop) */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Games */}
        <Route path="/game/:gameId" element={<Suspense fallback={<RouteFallback />}><GameDetailScreen /></Suspense>} />
        {/* GAP #7 (#1080): VerifiedRoute redireciona unverified pra onboarding em vez de deixar submit falhar silencioso no rules */}
        <Route path="/game/create" element={<VerifiedRoute><Suspense fallback={<RouteFallback />}><CreateGameScreen /></Suspense></VerifiedRoute>} />
        {/* Groups */}
        <Route path="/group/:groupId" element={<Suspense fallback={<RouteFallback />}><GroupDetailScreen /></Suspense>} />
        {/* FIX #1033: apenas FIELD_OWNER ou ADMIN podem criar grupos via URL direta */}
        <Route path="/group/create" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><CreateGroupScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        {/* GAP-3: rotas privadas do grupo exigem membership (ou ADMIN). */}
        <Route path="/group/:groupId/edit" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><GroupEditScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/settings" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><GroupSettingsScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/cashbox" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><CashboxScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/players" element={<Suspense fallback={<RouteFallback />}><PlayersScreen /></Suspense>} />
        <Route path="/group/:groupId/schedules" element={<Suspense fallback={<RouteFallback />}><SchedulesScreen /></Suspense>} />
        <Route path="/group/:groupId/invite" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><InvitePlayersScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/groups" element={<Suspense fallback={<RouteFallback />}><GroupsScreen /></Suspense>} />
        <Route path="/groups/discover" element={<Suspense fallback={<RouteFallback />}><DiscoverGroupsScreen /></Suspense>} />
        {/* Profile + perfis públicos */}
        <Route path="/profile" element={<Suspense fallback={<RouteFallback />}><ProfileScreen /></Suspense>} />
        <Route path="/profile/:userId" element={<Suspense fallback={<RouteFallback />}><ProfileScreen /></Suspense>} />
        <Route path="/profile/edit" element={<Suspense fallback={<RouteFallback />}><EditProfileScreen /></Suspense>} />
        <Route path="/level-journey" element={<Suspense fallback={<RouteFallback />}><LevelJourneyScreen /></Suspense>} />
        <Route path="/level-journey/:userId" element={<Suspense fallback={<RouteFallback />}><LevelJourneyScreen /></Suspense>} />
        {/* Statistics */}
        <Route path="/statistics" element={<Suspense fallback={<RouteFallback />}><StatisticsScreen /></Suspense>} />
        <Route path="/weekly-recap" element={<Suspense fallback={<RouteFallback />}><WeeklyRecapScreen /></Suspense>} />
        <Route path="/weekly-recap/:userId" element={<Suspense fallback={<RouteFallback />}><WeeklyRecapScreen /></Suspense>} />
        <Route path="/evolution" element={<Suspense fallback={<RouteFallback />}><EvolutionScreen /></Suspense>} />
        <Route path="/evolution/:userId" element={<Suspense fallback={<RouteFallback />}><EvolutionScreen /></Suspense>} />
        {/* Rankings */}
        <Route path="/ranking" element={<Suspense fallback={<RouteFallback />}><RankingScreen /></Suspense>} />
        <Route path="/league" element={<Suspense fallback={<RouteFallback />}><LeagueScreen /></Suspense>} />
        <Route path="/badges" element={<Suspense fallback={<RouteFallback />}><BadgesScreen /></Suspense>} />
        {/* Locations */}
        <Route path="/locations" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><ManageLocationsScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/location/:locationId" element={<Suspense fallback={<RouteFallback />}><LocationDetailScreen /></Suspense>} />
        <Route path="/location/create" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><LocationFormScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/location/:locationId/edit" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><LocationFormScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/owner/dashboard" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><FieldOwnerDashboardScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        {/* Map */}
        <Route path="/map/games" element={<Suspense fallback={<RouteFallback />}><PublicGamesMapScreen /></Suspense>} />
        <Route path="/map/locations" element={<Suspense fallback={<RouteFallback />}><LocationsMapScreen /></Suspense>} />
        {/* Settings */}
        <Route path="/settings" element={<Suspense fallback={<RouteFallback />}><SettingsScreen /></Suspense>} />
        <Route path="/settings/theme" element={<Suspense fallback={<RouteFallback />}><ThemeSettingsScreen /></Suspense>} />
        <Route path="/settings/notifications" element={<Suspense fallback={<RouteFallback />}><NotificationSettingsScreen /></Suspense>} />
        <Route path="/settings/gamification" element={<AdminRoute><Suspense fallback={<RouteFallback />}><GamificationSettingsScreen /></Suspense></AdminRoute>} />
        <Route path="/settings/feedbacks" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><MyFeedbacksScreen /></Suspense></ProtectedRoute>} />
        {/* Search & Notifications & About */}
        <Route path="/notifications" element={<Suspense fallback={<RouteFallback />}><NotificationsScreen /></Suspense>} />
        <Route path="/search" element={<Suspense fallback={<RouteFallback />}><GlobalSearchScreen /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<RouteFallback />}><AboutScreen /></Suspense>} />
        {/* Admin */}
        <Route path="/admin/users" element={<AdminRoute><Suspense fallback={<RouteFallback />}><UserManagementScreen /></Suspense></AdminRoute>} />
        <Route path="/dev" element={<AdminRoute><Suspense fallback={<RouteFallback />}><DevToolsScreen /></Suspense></AdminRoute>} />
      </Route>
      <Route path="/game/:gameId/live" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveGameScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/vote" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><MVPVoteScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/results" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><VoteResultScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/teams" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><TeamFormationScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/report" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PostGameReportScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/blocked" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><BlockedPlayersScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/stats" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveStatsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/events" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveEventsScreen /></Suspense></ProtectedRoute>} />

      {/* Issue #514: aceitar convite via link compartilhado /join/:code */}
      <Route path="/join/:code" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><JoinByInviteScreen /></Suspense></ProtectedRoute>} />

      {/* Tactical (full-screen, sem sidebar) */}
      <Route path="/tactical/:gameId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><TacticalBoardScreen /></Suspense></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFoundScreen /></Suspense>} />
    </Routes>
  );
}

const SafeScreen = withErrorBoundary(AppRoutes);

function MobileShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        // Fundo externo apenas quando o shell é centralizado (sm+)
        bgcolor: { xs: 'background.default', sm: 'divider' },
      }}
    >
      <Box
        id="mobile-shell"
        sx={{
          width: '100%',
          // Largura máxima responsiva:
          // - xs: full width (mobile)
          // - sm: 480 (mobile centralizado)
          // - md: 800 (80px rail + 720 content)
          // - lg: 1200 (240px drawer + 960 content)
          maxWidth: { xs: '100%', sm: 480, md: 800, lg: 1200 },
          minHeight: '100vh',
          bgcolor: 'background.default',
          boxShadow: (theme) => ({ xs: 'none', sm: `0 0 40px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}` }),
          position: 'relative',
          transform: { xs: 'none', sm: 'translateZ(0)' },
        }}
      >
        {/* NotificationBell visível em mobile (xs) onde sidebar fica oculta */}
        {user && (
          <Box
            sx={{
              position: 'fixed',
              top: 8,
              right: 8,
              zIndex: 1200,
              display: { xs: 'block', lg: 'none' },
            }}
          >
            <NotificationBell unreadCount={unreadCount} />
          </Box>
        )}
        {children}
      </Box>
    </Box>
  );
}

function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <TeamsProvider>
            <LanguageProvider>
            <ToastProvider>
              <SkipNav />
              {/* CommandPalette montado fora do MobileShell para não sofrer restrição
                  de largura, mas wrapped em ErrorBoundary próprio — se SearchPanel
                  der throw síncrono (ex: Firestore query inválida), não derruba
                  a árvore inteira (já que está fora de SafeScreen).
                  FIX #601 LOW backlog. */}
              <ErrorBoundary fallback={<></>}>
                <CommandPalette
                  open={paletteOpen}
                  onOpen={openPalette}
                  onClose={closePalette}
                />
              </ErrorBoundary>
              <MobileShell>
                <VerificationBanner />
                <Box component="main" id="main-content">
                  <SafeScreen />
                </Box>
                <ConnectionStatusWrapper />
              </MobileShell>
            </ToastProvider>
            </LanguageProvider>
            </TeamsProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ConnectionStatusWrapper() {
  const isOnline = useOnlineStatus();
  return <ConnectionStatus isOnline={isOnline} />;
}

export default App;
