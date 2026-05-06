import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, ThemeProvider, useAuth } from './contexts';
import { Box } from '@mui/material';
import { ErrorBoundary, withErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { ConnectionStatus, useOnlineStatus } from './components/common/ConnectionStatus';
import { SkipNav } from './components/common/SkipNav';
import { LoadingScreen } from './components/common/LoadingScreen';
import { useScrollRestoration } from './hooks/useScrollRestoration';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

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

// Notifications & Search
const NotificationsScreen = lazy(() => import('./pages/ranking/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })));
const GlobalSearchScreen = lazy(() => import('./pages/search/GlobalSearchScreen').then(m => ({ default: m.GlobalSearchScreen })));

// About & Admin
const AboutScreen = lazy(() => import('./pages/about/AboutScreen').then(m => ({ default: m.AboutScreen })));
const UserManagementScreen = lazy(() => import('./pages/admin/UserManagementScreen').then(m => ({ default: m.UserManagementScreen })));
const DevToolsScreen = lazy(() => import('./pages/devtools/DevToolsScreen').then(m => ({ default: m.DevToolsScreen })));

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();
  const location = useLocation();
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

  if (loading) {
    return <AppLoadingFallback />;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
  }

  // Aguarda verificação do token (custom claim verified)
  if (verified === null) {
    return <AppLoadingFallback />;
  }

  // Onboarding: rotas /onboarding/* permitem !verified
  const isOnboardingRoute = location.pathname.startsWith('/onboarding/');
  if (verified === false && !isOnboardingRoute) {
    return <Navigate to="/onboarding/phone" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return <AppLoadingFallback />;
  }

  if (firebaseUser) {
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
  }, [location.pathname]);
}

function AppRoutes() {
  useFocusOnNavigate();
  useScrollRestoration();

  return (
    <Routes>
      {/* Splash & Onboarding */}
      <Route path="/splash" element={<Suspense fallback={<RouteFallback />}><SplashScreen /></Suspense>} />
      <Route path="/welcome" element={<PublicRoute><Suspense fallback={<RouteFallback />}><WelcomeScreen /></Suspense></PublicRoute>} />

      {/* Onboarding obrigatório: phone + CPF (Anti-Bot) */}
      <Route path="/onboarding/phone" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PhoneVerificationScreen /></Suspense></ProtectedRoute>} />
      <Route path="/onboarding/cpf" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><CpfVerificationScreen /></Suspense></ProtectedRoute>} />
      <Route path="/profile/setup" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><ProfileSetupScreen /></Suspense></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><AppGuideScreen /></Suspense></ProtectedRoute>} />

      {/* Auth */}
      <Route path="/login" element={<PublicRoute><Suspense fallback={<RouteFallback />}><LoginScreen /></Suspense></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Suspense fallback={<RouteFallback />}><RegisterScreen /></Suspense></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><Suspense fallback={<RouteFallback />}><ForgotPasswordScreen /></Suspense></PublicRoute>} />

      {/* Home */}
      <Route path="/" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><HomeScreen /></Suspense></ProtectedRoute>} />

      {/* Games */}
      <Route path="/games" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GamesScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GameDetailScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/create" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><CreateGameScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/live" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveGameScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/vote" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><MVPVoteScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/results" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><VoteResultScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/teams" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><TeamFormationScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/report" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PostGameReportScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/blocked" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><BlockedPlayersScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/stats" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveStatsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/game/:gameId/events" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LiveEventsScreen /></Suspense></ProtectedRoute>} />

      {/* Schedules */}
      <Route path="/group/:groupId/schedules" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><SchedulesScreen /></Suspense></ProtectedRoute>} />

      {/* Groups */}
      <Route path="/groups" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GroupsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/:groupId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GroupDetailScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/create" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><CreateGroupScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/:groupId/edit" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GroupEditScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/:groupId/settings" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GroupSettingsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/:groupId/cashbox" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><CashboxScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/:groupId/invite" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><InvitePlayersScreen /></Suspense></ProtectedRoute>} />
      <Route path="/group/:groupId/players" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PlayersScreen /></Suspense></ProtectedRoute>} />

      {/* Profile */}
      <Route path="/profile" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><ProfileScreen /></Suspense></ProtectedRoute>} />
      <Route path="/profile/:userId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><ProfileScreen /></Suspense></ProtectedRoute>} />
      <Route path="/profile/edit" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><EditProfileScreen /></Suspense></ProtectedRoute>} />
      <Route path="/level-journey" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LevelJourneyScreen /></Suspense></ProtectedRoute>} />
      <Route path="/level-journey/:userId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LevelJourneyScreen /></Suspense></ProtectedRoute>} />

      {/* Statistics */}
      <Route path="/statistics" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><StatisticsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/weekly-recap" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><WeeklyRecapScreen /></Suspense></ProtectedRoute>} />
      <Route path="/weekly-recap/:userId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><WeeklyRecapScreen /></Suspense></ProtectedRoute>} />
      <Route path="/evolution" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><EvolutionScreen /></Suspense></ProtectedRoute>} />
      <Route path="/evolution/:userId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><EvolutionScreen /></Suspense></ProtectedRoute>} />

      {/* Rankings & League */}
      <Route path="/ranking" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><RankingScreen /></Suspense></ProtectedRoute>} />
      <Route path="/league" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LeagueScreen /></Suspense></ProtectedRoute>} />
      <Route path="/badges" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><BadgesScreen /></Suspense></ProtectedRoute>} />

      {/* Locations */}
      <Route path="/locations" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><ManageLocationsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/location/:locationId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LocationDetailScreen /></Suspense></ProtectedRoute>} />
      <Route path="/location/create" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><ManageLocationsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/owner/dashboard" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><FieldOwnerDashboardScreen /></Suspense></ProtectedRoute>} />

      {/* Map */}
      <Route path="/map/games" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><PublicGamesMapScreen /></Suspense></ProtectedRoute>} />
      <Route path="/map/locations" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><LocationsMapScreen /></Suspense></ProtectedRoute>} />

      {/* Tactical */}
      <Route path="/tactical/:gameId" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><TacticalBoardScreen /></Suspense></ProtectedRoute>} />

      {/* Settings */}
      <Route path="/settings" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><SettingsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/settings/theme" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><ThemeSettingsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/settings/gamification" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GamificationSettingsScreen /></Suspense></ProtectedRoute>} />

      {/* Notifications & Search */}
      <Route path="/notifications" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><NotificationsScreen /></Suspense></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><GlobalSearchScreen /></Suspense></ProtectedRoute>} />

      {/* About & Admin */}
      <Route path="/about" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><AboutScreen /></Suspense></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><UserManagementScreen /></Suspense></ProtectedRoute>} />
      <Route path="/dev" element={<ProtectedRoute><Suspense fallback={<RouteFallback />}><DevToolsScreen /></Suspense></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const SafeScreen = withErrorBoundary(AppRoutes);

function MobileShell({ children }: { children: React.ReactNode }) {
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
          // Largura máxima responsiva: mobile → tablet → desktop
          maxWidth: { xs: '100%', sm: 480, md: 720, lg: 960 },
          minHeight: '100vh',
          bgcolor: 'background.default',
          boxShadow: { xs: 'none', sm: '0 0 40px rgba(0,0,0,0.12)' },
          position: 'relative',
          transform: { xs: 'none', sm: 'translateZ(0)' },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <SkipNav />
              <MobileShell>
                <VerificationBanner />
                <Box component="main" id="main-content">
                  <SafeScreen />
                </Box>
                <ConnectionStatusWrapper />
              </MobileShell>
            </ToastProvider>
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
