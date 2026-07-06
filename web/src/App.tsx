import React, { Suspense, lazy, useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { addBreadcrumb } from './utils/errorContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import { auth } from './services/firebase';
import { AuthProvider, ThemeProvider, LanguageProvider, useAuth, TeamsProvider } from './contexts';
import { Box, Typography, Button, useTheme, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ErrorBoundary, withErrorBoundary } from './components/common/ErrorBoundary';
import { ErrorOutline } from '@mui/icons-material';
import { ToastProvider } from './contexts/ToastContext';
import { ConnectionStatus, useOnlineStatus } from './components/common/ConnectionStatus';
import { SkipNav } from './components/common/SkipNav';
import { LoadingScreen } from './components/common/LoadingScreen';
import { MobileTopBar } from './components/layout/MobileTopBar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { useScrollRestoration } from './hooks/useScrollRestoration';
import { useAutoBreadcrumbs } from './hooks/useAutoBreadcrumbs';
import { useNavigateBack } from './hooks/useNavigateBack';
import { useSwipeBack } from './hooks/useSwipeBack';
import { useNotifications } from './hooks/useNotifications';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useVerifiedClaim } from './hooks/useVerifiedClaim';
import { ShortcutsDialog } from './components/common/ShortcutsDialog';
import { useIsGroupMember } from './hooks/useGroups';
import { useToast } from './contexts/ToastContext';
import { ProfileGate } from './components/gate/ProfileGate';
import { useResourcePreloading } from './hooks/useResourcePreloading';
import { PageTransition } from './components/common/PageTransition';
import { motion } from './theme/motion';
import {

  HomeScreenSkeleton,
  GameDetailSkeleton,
  GroupDetailSkeleton,
  ProfileScreenSkeleton,
  BadgesSkeleton,
  EditProfileSkeleton,
  GlobalSearchSkeleton,
  LevelJourneySkeleton,
  StatisticSkeleton,
  LiveGameSkeleton,
  WeeklyRecapSkeleton,
  AboutSkeleton,
  CardGridSkeleton,
  ListSkeleton,
  FormSkeleton,
} from './components/common/ScreenSkeletons';


// Splash & Onboarding
const SplashScreen = lazy(() => import('./pages/splash/SplashScreen').then(m => ({ default: m.SplashScreen })));
const WelcomeScreen = lazy(() => import('./pages/onboarding/WelcomeScreen').then(m => ({ default: m.WelcomeScreen })));
import { useTranslation } from 'react-i18next';
import type { User as FirebaseUser } from 'firebase/auth';
const PhoneVerificationScreen = lazy(() => import('./pages/onboarding/PhoneVerificationScreen').then(m => ({ default: m.PhoneVerificationScreen })));

const CpfVerificationScreen = lazy(() => import('./pages/onboarding/CpfVerificationScreen').then(m => ({ default: m.CpfVerificationScreen })));
const ProfileSetupScreen = lazy(() => import('./pages/onboarding/ProfileSetupScreen').then(m => ({ default: m.ProfileSetupScreen })));
const AppGuideScreen = lazy(() => import('./pages/onboarding/AppGuideScreen').then(m => ({ default: m.AppGuideScreen })));
const CommandPalette = lazy(() => import('./components/search/CommandPalette').then(m => ({ default: m.CommandPalette })));
const AppLayout = lazy(() => import('./components/layout/AppLayout').then(m => ({ default: m.AppLayout })));

// Auth
const LoginScreen = lazy(() => import('./pages/auth/LoginScreen').then(m => ({ default: m.LoginScreen })));
const RegisterScreen = lazy(() => import('./pages/auth/RegisterScreen').then(m => ({ default: m.RegisterScreen })));
const ForgotPasswordScreen = lazy(() => import('./pages/auth/ForgotPasswordScreen').then(m => ({ default: m.ForgotPasswordScreen })));
const LaunchPage = lazy(() => import('./pages/launch/LaunchPage').then(m => ({ default: m.LaunchPage })));

// Home
const HomeScreen = lazy(() => import('./pages/home/HomeScreen').then(m => ({ default: m.HomeScreen })));
const SocialFeedScreen = lazy(() => import('./pages/feed/SocialFeedScreen').then(m => ({ default: m.SocialFeedScreen })));


const GameDetailScreen = lazy(() => import('./pages/game/GameDetailScreen').then(m => ({ default: m.GameDetailScreen })));
const CreateGameScreen = lazy(() => import('./pages/game/CreateGameScreen').then(m => ({ default: m.CreateGameScreen })));
const LiveGameScreen = lazy(() => import('./pages/game/LiveGameScreen').then(m => ({ default: m.LiveGameScreen })));
const MVPVoteScreen = lazy(() => import('./pages/game/MVPVoteScreen').then(m => ({ default: m.MVPVoteScreen })));
const VoteResultScreen = lazy(() => import('./pages/game/VoteResultScreen').then(m => ({ default: m.VoteResultScreen })));
const TeamFormationScreen = lazy(() => import('./pages/games/TeamFormationScreen').then(m => ({ default: m.TeamFormationScreen })));
const PostGameReportScreen = lazy(() => import('./pages/games/PostGameReportScreen').then(m => ({ default: m.PostGameReportScreen })));
const BlockedPlayersScreen = lazy(() => import('./pages/games/owner/BlockedPlayersScreen').then(m => ({ default: m.BlockedPlayersScreen })));
const QrCheckInScreen = lazy(() => import('./pages/game/QrCheckInScreen').then(m => ({ default: m.QrCheckInScreen })));
const SchedulesScreen = lazy(() => import('./pages/schedules/SchedulesScreen').then(m => ({ default: m.SchedulesScreen })));

// Live Game
const LiveStatsScreen = lazy(() => import('./pages/livegame/LiveStatsScreen').then(m => ({ default: m.LiveStatsScreen })));
const LiveEventsScreen = lazy(() => import('./pages/livegame/LiveEventsScreen').then(m => ({ default: m.LiveEventsScreen })));



// Groups — GroupsScreen removido (redireciona para /?tab=2)
const GroupDetailScreen = lazy(() => import('./pages/group/GroupDetailScreen').then(m => ({ default: m.GroupDetailScreen })));
const CreateGroupScreen = lazy(() => import('./pages/group/CreateGroupScreen').then(m => ({ default: m.CreateGroupScreen })));
const GroupEditScreen = lazy(() => import('./pages/group/GroupEditScreen').then(m => ({ default: m.GroupEditScreen })));
const GroupSettingsScreen = lazy(() => import('./pages/group/GroupSettingsScreen').then(m => ({ default: m.GroupSettingsScreen })));
const GroupLeagueScreen = lazy(() => import('./pages/group/GroupLeagueScreen').then(m => ({ default: m.GroupLeagueScreen })));
const CashboxScreen = lazy(() => import('./pages/groups/CashboxScreen').then(m => ({ default: m.CashboxScreen })));
const InvitePlayersScreen = lazy(() => import('./pages/groups/InvitePlayersScreen').then(m => ({ default: m.InvitePlayersScreen })));
const JoinByInviteScreen = lazy(() => import('./pages/group/JoinByInviteScreen').then(m => ({ default: m.JoinByInviteScreen })));
const DiscoverGroupsScreen = lazy(() => import('./pages/group/DiscoverGroupsScreen').then(m => ({ default: m.DiscoverGroupsScreen })));
const PlayersScreen = lazy(() => import('./pages/players/PlayersScreen').then(m => ({ default: m.PlayersScreen })));
const NearbyPlayersScreen = lazy(() => import('./pages/players/NearbyPlayersScreen').then(m => ({ default: m.NearbyPlayersScreen })));
const PublicGamesScreen = lazy(() => import('./pages/games/PublicGamesScreen').then(m => ({ default: m.PublicGamesScreen })));
const InviteFriendScreen = lazy(() => import('./pages/InviteFriendScreen').then(m => ({ default: m.InviteFriendScreen })));
const InviteRedirectScreen = lazy(() => import('./pages/InviteRedirectScreen').then(m => ({ default: m.InviteRedirectScreen })));
const DreamTeamScreen = lazy(() => import('./pages/DreamTeamScreen').then(m => ({ default: m.DreamTeamScreen })));
const GroupChallengesScreen = lazy(() => import('./pages/GroupChallengesScreen').then(m => ({ default: m.GroupChallengesScreen })));
const WeeklyRankingScreen = lazy(() => import('./pages/ranking/WeeklyRankingScreen').then(m => ({ default: m.WeeklyRankingScreen })));

// Profile
const ProfileScreen = lazy(() => import('./pages/profile/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const EditProfileScreen = lazy(() => import('./pages/profile/EditProfileScreen').then(m => ({ default: m.EditProfileScreen })));
const LevelJourneyScreen = lazy(() => import('./pages/profile/LevelJourneyScreen').then(m => ({ default: m.LevelJourneyScreen })));

// Statistics
const StatisticsScreen = lazy(() => import('./pages/statistics/StatisticsScreen').then(m => ({ default: m.StatisticsScreen })));
const WeeklyRecapScreen = lazy(() => import('./pages/statistics/WeeklyRecapScreen').then(m => ({ default: m.WeeklyRecapScreen })));
const EvolutionScreen = lazy(() => import('./pages/statistics/EvolutionScreen').then(m => ({ default: m.EvolutionScreen })));
const HeadToHeadScreen = lazy(() => import('./pages/statistics/HeadToHeadScreen').then(m => ({ default: m.HeadToHeadScreen })));

// Rankings & League

const LeagueScreen = lazy(() => import('./pages/league/LeagueScreen').then(m => ({ default: m.LeagueScreen })));
const BadgesScreen = lazy(() => import('./pages/badges/BadgesScreen').then(m => ({ default: m.BadgesScreen })));

// Locations
const LocationDetailScreen = lazy(() => import('./pages/locations/LocationDetailScreen').then(m => ({ default: m.LocationDetailScreen })));
const ManageLocationsScreen = lazy(() => import('./pages/locations/ManageLocationsScreen').then(m => ({ default: m.ManageLocationsScreen })));
const LocationFormScreen = lazy(() => import('./pages/locations/LocationFormScreen').then(m => ({ default: m.LocationFormScreen })));
const FieldOwnerDashboardScreen = lazy(() => import('./pages/locations/FieldOwnerDashboardScreen').then(m => ({ default: m.FieldOwnerDashboardScreen })));
const OwnerOnboardingScreen = lazy(() => import('./pages/locations/OwnerOnboardingScreen').then(m => ({ default: m.OwnerOnboardingScreen })));

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
const DirectMessagesScreen = lazy(() => import('./pages/messages/DirectMessagesScreen').then(m => ({ default: m.DirectMessagesScreen })));
const ConversationScreen = lazy(() => import('./pages/messages/ConversationScreen').then(m => ({ default: m.ConversationScreen })));

// About & Admin
const AboutScreen = lazy(() => import('./pages/about/AboutScreen').then(m => ({ default: m.AboutScreen })));
const WhatsNewPage = lazy(() => import('./pages/whatsnew/WhatsNewPage').then(m => ({ default: m.WhatsNewPage })));
const UserManagementScreen = lazy(() => import('./pages/admin/UserManagementScreen').then(m => ({ default: m.UserManagementScreen })));
const GameReviewQueueScreen = lazy(() => import('./pages/admin/GameReviewQueueScreen').then(m => ({ default: m.GameReviewQueueScreen })));
const FeedbackOperationsScreen = lazy(() => import('./pages/admin/FeedbackOperationsScreen').then(m => ({ default: m.FeedbackOperationsScreen })));
const DevToolsScreen = lazy(() => import('./pages/devtools/DevToolsScreen').then(m => ({ default: m.DevToolsScreen })));
const PerformanceDashboard = lazy(() => import('./pages/admin/PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard })));

// Error pages
const NotFoundScreen = lazy(() => import('./pages/error/NotFoundScreen').then(m => ({ default: m.NotFoundScreen })));

function RouteFallback() {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/' || path === '') return <HomeScreenSkeleton />;
  if (path.startsWith('/game/') && path.endsWith('/live')) return <LiveGameSkeleton />;
  if (path.startsWith('/game/')) return <GameDetailSkeleton />;
  if (path.startsWith('/group/') && (path.endsWith('/edit') || path.endsWith('/settings'))) return <FormSkeleton />;
  if (path.startsWith('/group/') && !path.includes('/cashbox')) return <GroupDetailSkeleton />;
  if (path.startsWith('/profile/edit')) return <EditProfileSkeleton />;
  if (path.startsWith('/profile')) return <ProfileScreenSkeleton />;
  if (path.startsWith('/league')) return <ListSkeleton />;
  if (path === '/badges') return <BadgesSkeleton />;
  if (path === '/search') return <GlobalSearchSkeleton />;
  if (path.startsWith('/level-journey')) return <LevelJourneySkeleton />;
  if (path === '/statistics') return <StatisticSkeleton />;
  if (path.startsWith('/weekly-recap')) return <WeeklyRecapSkeleton />;
  if (path === '/about') return <AboutSkeleton />;
  if (path.startsWith('/locations')) return <CardGridSkeleton />;
  if (path.startsWith('/admin')) return <ListSkeleton />;
  if (path.startsWith('/settings')) return <FormSkeleton />;
  if (path.startsWith('/messages')) return <ListSkeleton />;

  return <CardGridSkeleton />;
}

function AppLoadingFallback() {
  const { t } = useTranslation();
  return <LoadingScreen variant="cards" message={t('common.loading')} />;
}

// #2188: carregamento inicial (auth resolvendo) usa a splash com identidade
// visual do app, em vez dos skeleton cards cinzas.
function SplashLoadingFallback() {
  return <LoadingScreen variant="splash" />;
}

function useLoginRedirectReady(firebaseUser: FirebaseUser | null, loading: boolean) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || firebaseUser) {
      setReady(false);
      return;
    }

    const timer = window.setTimeout(() => setReady(true), 300);
    return () => window.clearTimeout(timer);
  }, [firebaseUser, loading]);

  return ready;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();
  const activeUser = firebaseUser ?? auth.currentUser;
  const loginRedirectReady = useLoginRedirectReady(activeUser, loading);
  const verified = useVerifiedClaim(activeUser);

  if (loading) {
    return <SplashLoadingFallback />;
  }

  // FIX #574 (C3): preserva location pra que LoginScreen redirecione user
  // de volta pro deep link após login. Antes: hardcoded `/`, perdendo destino.
  if (!activeUser) {
    if (!loginRedirectReady) return <SplashLoadingFallback />;
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
    const nextStep = activeUser.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
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
  const activeUser = firebaseUser ?? auth.currentUser;
  const loginRedirectReady = useLoginRedirectReady(activeUser, loading);
  const verified = useVerifiedClaim(activeUser);

  if (loading) return <SplashLoadingFallback />;

  if (!activeUser) {
    if (!loginRedirectReady) return <SplashLoadingFallback />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (verified === null) return <AppLoadingFallback />;

  if (verified === false) {
    const nextStep = activeUser.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
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
  if (loading) return <SplashLoadingFallback />;
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
  if (loading) return <SplashLoadingFallback />;
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
  const { isMember, loading: memberLoading } = useIsGroupMember(groupId);
  const { showError } = useToast();
  const { t } = useTranslation();
  const [notified, setNotified] = useState(false);

  if (loading) return <SplashLoadingFallback />;
  if (!firebaseUser) return <Navigate to="/login" replace />;

  // Admin tem acesso global (consistente com rules)
  if (user?.role === 'ADMIN') return <>{children}</>;

  // Checagem em curso — mostra fallback (não bloqueia children desnecessariamente)
  if (memberLoading) return <AppLoadingFallback />;

  if (!isMember) {
    if (!notified) {
      // Feedback explícito para usuário entender o redirect
      showError(t('feedback.app.mustBeGroupMember'));
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
  const activeUser = firebaseUser ?? auth.currentUser;
  const verified = useVerifiedClaim(activeUser);

  if (loading) {
    return <SplashLoadingFallback />;
  }

  if (activeUser) {
    // Aguarda resolução do claim antes de decidir destino — evita piscar
    if (verified === null) return <AppLoadingFallback />;

    // FIX #1024: usuário logado mas não-verificado NÃO vai pra `/` (causaria loop
    // ProtectedRoute → /onboarding/phone → PublicRoute → / → ProtectedRoute...).
    // Redireciona diretamente pro próximo passo do onboarding.
    if (verified === false) {
      const nextStep = activeUser.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
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
      el.focus({ preventScroll: true });
    }
    // Registra breadcrumb de navegação para contexto em erros futuros
    addBreadcrumb('navigation', `Navegou para ${location.pathname}`, {
      pathname: location.pathname,
      search: location.search,
    });
  }, [location.pathname, location.search]);
}

function AppRoutes() {
  const location = useLocation();
  useFocusOnNavigate();
  useScrollRestoration();
  useResourcePreloading();
  const routeTransitionKey = `${location.pathname}${location.search}`;
  const routeTransitionVariant = location.pathname === '/' ? 'fade' : 'slideUp';

  return (
    <ProfileGate>
    <PageTransition key={routeTransitionKey} variant={routeTransitionVariant}>
    <Routes location={location}>
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
      <Route path="/launch" element={<Suspense fallback={<RouteFallback />}><LaunchPage /></Suspense>} />

      {/* Games — redireciona para tab=1 (HomeScreen) para manter o menu de navegação */}
      <Route path="/games" element={<Navigate to="/?tab=1" replace />} />
      {/* Rotas detail/form com AppLayout (sidebar global desktop) */}
      <Route element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><AppLayout /></Suspense></ProtectedRoute>}>
        {/* Home */}
        <Route path="/" element={<Suspense fallback={<RouteFallback />}><HomeScreen /></Suspense>} />
        <Route path="/feed" element={<Suspense fallback={<RouteFallback />}><SocialFeedScreen /></Suspense>} />
        {/* Games */}
        <Route path="/game/:gameId" element={<Suspense fallback={<RouteFallback />}><GameDetailScreen /></Suspense>} />
        {/* GAP #7 (#1080): VerifiedRoute redireciona unverified pra onboarding em vez de deixar submit falhar silencioso no rules */}
        <Route path="/game/create" element={<VerifiedRoute><Suspense fallback={<RouteFallback />}><CreateGameScreen /></Suspense></VerifiedRoute>} />
        {/* Groups */}
        <Route path="/group/:groupId" element={<Suspense fallback={<RouteFallback />}><GroupDetailScreen /></Suspense>} />
        <Route path="/group/:groupId/post/:postId" element={<Suspense fallback={<RouteFallback />}><GroupDetailScreen /></Suspense>} />
        {/* FIX #1033: apenas FIELD_OWNER ou ADMIN podem criar grupos via URL direta */}
        <Route path="/group/create" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><CreateGroupScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        {/* GAP-3: rotas privadas do grupo exigem membership (ou ADMIN). */}
        <Route path="/group/:groupId/edit" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><GroupEditScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/settings" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><GroupSettingsScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/cashbox" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><CashboxScreen /></Suspense></GroupMemberRoute>} />
        {/* #1332: rotas de grupo exigem GroupMemberRoute (consistente com
            /edit, /settings, /invite). Sem o guard, não-membros caíam em
            permission-denied cru das rules em vez de redirect gracioso. */}
        <Route path="/group/:groupId/players" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><PlayersScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/schedules" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><SchedulesScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/invite" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><InvitePlayersScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/group/:groupId/league" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><GroupLeagueScreen /></Suspense></GroupMemberRoute>} />
        <Route path="/groups" element={<Navigate to="/?tab=2" replace />} />
        <Route path="/groups/discover" element={<Suspense fallback={<RouteFallback />}><DiscoverGroupsScreen /></Suspense>} />
        <Route path="/players/nearby" element={<Suspense fallback={<RouteFallback />}><NearbyPlayersScreen /></Suspense>} />
        {/* Profile + perfis públicos */}
        <Route path="/profile" element={<Navigate to="/?tab=4" replace />} />
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
        <Route path="/head-to-head" element={<Suspense fallback={<RouteFallback />}><HeadToHeadScreen /></Suspense>} />
        {/* Rankings */}
        <Route path="/ranking" element={<Navigate to="/?tab=3" replace />} />
        <Route path="/league" element={<Suspense fallback={<RouteFallback />}><LeagueScreen /></Suspense>} />
        <Route path="/badges" element={<Suspense fallback={<RouteFallback />}><BadgesScreen /></Suspense>} />
        {/* Locations */}
        <Route path="/locations" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><ManageLocationsScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/location/:locationId" element={<Suspense fallback={<RouteFallback />}><LocationDetailScreen /></Suspense>} />
        <Route path="/location/create" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><LocationFormScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/location/:locationId/edit" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><LocationFormScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/owner/dashboard" element={<FieldOwnerOrAdminRoute><Suspense fallback={<RouteFallback />}><FieldOwnerDashboardScreen /></Suspense></FieldOwnerOrAdminRoute>} />
        <Route path="/owner/onboarding" element={<VerifiedRoute><Suspense fallback={<RouteFallback />}><OwnerOnboardingScreen /></Suspense></VerifiedRoute>} />
        {/* Map */}
        <Route path="/map/games" element={<Suspense fallback={<RouteFallback />}><PublicGamesMapScreen /></Suspense>} />
        <Route path="/map/locations" element={<Suspense fallback={<RouteFallback />}><LocationsMapScreen /></Suspense>} />
        {/* Public Games Feed */}
        <Route path="/public-games" element={<Suspense fallback={<RouteFallback />}><PublicGamesScreen /></Suspense>} />
        {/* Invite Friend */}
        <Route path="/invite-friend" element={<Suspense fallback={<RouteFallback />}><InviteFriendScreen /></Suspense>} />
        {/* Dream Team */}
        <Route path="/dream-team" element={<Suspense fallback={<RouteFallback />}><DreamTeamScreen /></Suspense>} />
        {/* Group Challenges */}
        <Route path="/group/:groupId/challenges" element={<GroupMemberRoute><Suspense fallback={<RouteFallback />}><GroupChallengesScreen /></Suspense></GroupMemberRoute>} />
        {/* Weekly Ranking */}
        <Route path="/weekly-ranking" element={<Suspense fallback={<RouteFallback />}><WeeklyRankingScreen /></Suspense>} />
        {/* Settings */}
        <Route path="/settings" element={<Suspense fallback={<RouteFallback />}><SettingsScreen /></Suspense>} />
        <Route path="/settings/theme" element={<Suspense fallback={<RouteFallback />}><ThemeSettingsScreen /></Suspense>} />
        <Route path="/settings/notifications" element={<Suspense fallback={<RouteFallback />}><NotificationSettingsScreen /></Suspense>} />
        <Route path="/settings/gamification" element={<AdminRoute><Suspense fallback={<RouteFallback />}><GamificationSettingsScreen /></Suspense></AdminRoute>} />
        <Route path="/settings/feedbacks" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><MyFeedbacksScreen /></Suspense></ProtectedRoute>} />
        {/* Search & Notifications & About */}
        <Route path="/notifications" element={<Suspense fallback={<RouteFallback />}><NotificationsScreen /></Suspense>} />
        <Route path="/messages" element={<Suspense fallback={<RouteFallback />}><DirectMessagesScreen /></Suspense>} />
        <Route path="/messages/:chatId" element={<Suspense fallback={<RouteFallback />}><ConversationScreen /></Suspense>} />
        <Route path="/search" element={<Suspense fallback={<RouteFallback />}><GlobalSearchScreen /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<RouteFallback />}><AboutScreen /></Suspense>} />
        <Route path="/whats-new" element={<Suspense fallback={<RouteFallback />}><WhatsNewPage /></Suspense>} />
        {/* Admin */}
        <Route path="/admin/users" element={<AdminRoute><Suspense fallback={<RouteFallback />}><UserManagementScreen /></Suspense></AdminRoute>} />
        <Route path="/admin/feedback" element={<AdminRoute><Suspense fallback={<RouteFallback />}><FeedbackOperationsScreen /></Suspense></AdminRoute>} />
        <Route path="/admin/game-reviews" element={<AdminRoute><Suspense fallback={<RouteFallback />}><GameReviewQueueScreen /></Suspense></AdminRoute>} />
        <Route path="/dev" element={<AdminRoute><Suspense fallback={<RouteFallback />}><DevToolsScreen /></Suspense></AdminRoute>} />
        <Route path="/admin/performance" element={<AdminRoute><Suspense fallback={<RouteFallback />}><PerformanceDashboard /></Suspense></AdminRoute>} />
      </Route>
      <Route path="/game/:gameId/live" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveGameScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/vote" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><MVPVoteScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/results" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><VoteResultScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/teams" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><TeamFormationScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/report" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PostGameReportScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/blocked" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><BlockedPlayersScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/stats" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveStatsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/events" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveEventsScreen /></Suspense></ProtectedRoute>} />

      {/* QR Code Check-in */}
      <Route path="/checkin/:gameId/:token" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><QrCheckInScreen /></Suspense></ProtectedRoute>} />

      {/* Issue #514: aceitar convite via link compartilhado /join/:code */}
      <Route path="/join/:code" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><JoinByInviteScreen /></Suspense></ProtectedRoute>} />

      {/* Invite friend deep link /invite/:code */}
      <Route path="/invite/:code" element={<Suspense fallback={<RouteFallback />}><InviteRedirectScreen /></Suspense>} />

      {/* Tactical (full-screen, sem sidebar) */}
      <Route path="/tactical/:gameId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><TacticalBoardScreen /></Suspense></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFoundScreen /></Suspense>} />
    </Routes>
    </PageTransition>
    </ProfileGate>
  );
}

const SafeScreen = withErrorBoundary(AppRoutes);

function MobileShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications(user?.id);
  const location = useLocation();
  const breadcrumbs = useAutoBreadcrumbs();
  // #2193: rotas secundárias = qualquer path que não seja a raiz (tabs vivem
  // todas em "/"). Detail/form/settings ganham botão de voltar no mobile.
  const isSecondary = location.pathname !== '/' && location.pathname !== '';
  const goBack = useNavigateBack();
  // #2194: swipe-back só em rotas secundárias (na raiz não há para onde voltar).
  // #2722: expõe dragProgress para visual feedback durante o arraste.
  const { dragProgress } = useSwipeBack({ disabled: !isSecondary });
  const reducedMotion = useReducedMotion();
  const shellSettleTransition = reducedMotion
    ? 'none'
    : `${motion('transform', 'short', 'standard')}, ${motion('opacity', 'short', 'standard')}`;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100dvh',
        bgcolor: { xs: 'background.default', sm: 'divider' },
      }}
    >
      <Box
        id="mobile-shell"
        sx={{
          width: '100%',
          // #2173: maxWidth compensa a sidebar (88px md / 240px lg) para não
          // comprimir a área de conteúdo em monitores grandes. xl expandido
          // para 1920px para melhor aproveitamento em 2K/4K.
          maxWidth: { xs: '100%', sm: 600, md: 900, lg: 1440, xl: 1920 },
          minHeight: '100dvh',
          bgcolor: 'background.default',
          boxShadow: (theme) => ({ xs: 'none', sm: `0 0 40px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.4 : 0.12)}` }),
          position: 'relative',
          transform: dragProgress > 0
            ? `translateX(${dragProgress * 80}px)`
            : { xs: 'none', sm: 'translateZ(0)' },
          opacity: dragProgress > 0 ? 1 - dragProgress * 0.15 : 1,
          transition: dragProgress === 0 ? shellSettleTransition : 'none',
        }}
      >
        {user && !isSecondary && (
          <MobileTopBar
            unreadCount={unreadCount}
            showBack={isSecondary}
            onBack={goBack}
            breadcrumbs={breadcrumbs}
          />
        )}
        {user ? <MobileBottomNav>{children}</MobileBottomNav> : children}
      </Box>
    </Box>
  );
}

function AppCrashFallback() {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', p: 4, textAlign: 'center' }}>
      <ErrorOutline sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>{t('errorBoundary.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('errorBoundary.description')}
      </Typography>
      <Button variant="contained" onClick={() => window.location.reload()}>
        {t('errorBoundary.reload')}
      </Button>
    </Box>
  );
}

/**
 * #2221: boundary com fallback silencioso (sem UI) que ainda dá feedback
 * ao usuário via toast quando o conteúdo (ex.: CommandPalette) der throw.
 * Antes o usuário pressionava Cmd+K e nada acontecia, sem qualquer aviso.
 */
function SilentToastBoundary({ children, message }: { children: React.ReactNode; message: string }) {
  const { showError } = useToast();
  return (
    <ErrorBoundary fallback={<></>} onError={() => showError(message)}>
      {children}
    </ErrorBoundary>
  );
}

function CommandPaletteBoundary({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <SilentToastBoundary message={t('commandPalette.openError')}>
      {children}
    </SilentToastBoundary>
  );
}

function RouteAnnouncer() {
  const location = useLocation();
  const [title, setTitle] = useState(document.title);

  useEffect(() => {
    setTitle(document.title);
  }, [location.pathname]);

  return (
    <Box
      component="span"
      aria-live="polite"
      sx={{
        position: 'absolute',
        width: 1,
        height: 1,
        overflow: 'hidden',
        clip: 'rect(1px, 1px, 1px, 1px)',
        whiteSpace: 'nowrap',
      }}
    >
      {title}
    </Box>
  );
}

function SWUpdateListener() {
  const { showWithAction } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: Event) => {
      const registration = (e as CustomEvent).detail as ServiceWorkerRegistration;
      showWithAction(
        `${t('sw.updateAvailable')} — ${t('sw.updateAction')}`,
        {
          label: t('sw.updateAction'),
          onClick: () => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          },
        },
        'info'
      );
    };
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, [showWithAction, t]);

  return null;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.isContentEditable;
}

function GlobalShortcuts({
  paletteOpen,
  onOpenPalette,
  onClosePalette,
  shortcutsOpen,
  onOpenShortcuts,
  onCloseShortcuts,
}: {
  paletteOpen: boolean;
  onOpenPalette: () => void;
  onClosePalette: () => void;
  shortcutsOpen: boolean;
  onOpenShortcuts: () => void;
  onCloseShortcuts: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const commandKey = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (commandKey && key === 'k') {
        e.preventDefault();
        if (paletteOpen) onClosePalette();
        else onOpenPalette();
        return;
      }

      if (commandKey && e.shiftKey && key === 'n') {
        e.preventDefault();
        navigate('/group/create');
        return;
      }

      if (commandKey && key === 'n') {
        e.preventDefault();
        navigate('/game/create');
        return;
      }

      if (commandKey && key === ',') {
        e.preventDefault();
        navigate('/settings');
        return;
      }

      if (e.key === '?' && !e.altKey && !commandKey) {
        e.preventDefault();
        onOpenShortcuts();
        return;
      }

      if (e.key === 'Escape' && shortcutsOpen) {
        onCloseShortcuts();
      }
    };

    const handleOpenShortcuts = () => onOpenShortcuts();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-shortcuts', handleOpenShortcuts);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-shortcuts', handleOpenShortcuts);
    };
  }, [
    navigate,
    onClosePalette,
    onCloseShortcuts,
    onOpenPalette,
    onOpenShortcuts,
    paletteOpen,
    shortcutsOpen,
  ]);

  return null;
}

function App() {
  const _theme = useTheme();
  const isDesktop = useMediaQuery(_theme.breakpoints.up('md'));
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ErrorBoundary fallback={<AppCrashFallback />}>
            <ToastProvider>
            <TeamsProvider>
            <LanguageProvider>
              <GlobalShortcuts
                paletteOpen={paletteOpen}
                onOpenPalette={openPalette}
                onClosePalette={closePalette}
                shortcutsOpen={shortcutsOpen}
                onOpenShortcuts={openShortcuts}
                onCloseShortcuts={closeShortcuts}
              />
              <SkipNav />
              <SWUpdateListener />
              {/* CommandPalette montado fora do MobileShell para não sofrer restrição
                  de largura, mas wrapped em ErrorBoundary próprio — se SearchPanel
                  der throw síncrono (ex: Firestore query inválida), não derruba
                  a árvore inteira (já que está fora de SafeScreen).
                  FIX #601 LOW backlog. */}
              {paletteOpen && (
                <CommandPaletteBoundary>
                  <Suspense fallback={null}>
                    <CommandPalette
                      open={paletteOpen}
                      onOpen={openPalette}
                      onClose={closePalette}
                    />
                  </Suspense>
                </CommandPaletteBoundary>
              )}
              <ShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
              {/* #3187: VerificationBanner (grace period) removido — código morto:
                  ProtectedRoute redireciona users !verified pro onboarding
                  incondicionalmente, então o banner nunca era exibido. */}
              {isDesktop ? (
                <>
                  <RouteAnnouncer />
                  <SafeScreen />
                  <ConnectionStatusWrapper />
                </>
              ) : (
                <MobileShell>
                  <RouteAnnouncer />
                  <Box>
                    <SafeScreen />
                  </Box>
                  <ConnectionStatusWrapper />
                </MobileShell>
              )}
            </LanguageProvider>
            </TeamsProvider>
            </ToastProvider>
            </ErrorBoundary>
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
