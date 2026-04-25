import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, ThemeProvider, useAuth } from './contexts';
import { Box } from '@mui/material';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { ConnectionStatus, useOnlineStatus } from './components/common/ConnectionStatus';
import { SkipNav } from './components/common/SkipNav';
import { LoadingScreen } from './components/common/LoadingScreen';

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

function AppLoadingFallback() {
  return <LoadingScreen variant="cards" message="Carregando..." />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return <AppLoadingFallback />;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace />;
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

function AppRoutes() {
  return (
    <Suspense fallback={<AppLoadingFallback />}>
      <Routes>
        {/* Splash & Onboarding */}
        <Route path="/splash" element={<SplashScreen />} />
        <Route path="/welcome" element={<PublicRoute><WelcomeScreen /></PublicRoute>} />
        <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetupScreen /></ProtectedRoute>} />
        <Route path="/guide" element={<ProtectedRoute><AppGuideScreen /></ProtectedRoute>} />

        {/* Auth */}
        <Route path="/login" element={<PublicRoute><LoginScreen /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterScreen /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordScreen /></PublicRoute>} />

        {/* Home */}
        <Route path="/" element={<ProtectedRoute><HomeScreen /></ProtectedRoute>} />

        {/* Games */}
        <Route path="/games" element={<ProtectedRoute><GamesScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId" element={<ProtectedRoute><GameDetailScreen /></ProtectedRoute>} />
        <Route path="/game/create" element={<ProtectedRoute><CreateGameScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/live" element={<ProtectedRoute><LiveGameScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/vote" element={<ProtectedRoute><MVPVoteScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/results" element={<ProtectedRoute><VoteResultScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/teams" element={<ProtectedRoute><TeamFormationScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/report" element={<ProtectedRoute><PostGameReportScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/blocked" element={<ProtectedRoute><BlockedPlayersScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/stats" element={<ProtectedRoute><LiveStatsScreen /></ProtectedRoute>} />
        <Route path="/game/:gameId/events" element={<ProtectedRoute><LiveEventsScreen /></ProtectedRoute>} />

        {/* Schedules */}
        <Route path="/group/:groupId/schedules" element={<ProtectedRoute><SchedulesScreen /></ProtectedRoute>} />

        {/* Groups */}
        <Route path="/groups" element={<ProtectedRoute><GroupsScreen /></ProtectedRoute>} />
        <Route path="/group/:groupId" element={<ProtectedRoute><GroupDetailScreen /></ProtectedRoute>} />
        <Route path="/group/create" element={<ProtectedRoute><CreateGroupScreen /></ProtectedRoute>} />
        <Route path="/group/:groupId/edit" element={<ProtectedRoute><GroupEditScreen /></ProtectedRoute>} />
        <Route path="/group/:groupId/settings" element={<ProtectedRoute><GroupSettingsScreen /></ProtectedRoute>} />
        <Route path="/group/:groupId/cashbox" element={<ProtectedRoute><CashboxScreen /></ProtectedRoute>} />
        <Route path="/group/:groupId/invite" element={<ProtectedRoute><InvitePlayersScreen /></ProtectedRoute>} />
        <Route path="/group/:groupId/players" element={<ProtectedRoute><PlayersScreen /></ProtectedRoute>} />

        {/* Profile */}
        <Route path="/profile" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
        <Route path="/profile/:userId" element={<ProtectedRoute><ProfileScreen /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute><EditProfileScreen /></ProtectedRoute>} />
        <Route path="/level-journey" element={<ProtectedRoute><LevelJourneyScreen /></ProtectedRoute>} />
        <Route path="/level-journey/:userId" element={<ProtectedRoute><LevelJourneyScreen /></ProtectedRoute>} />

        {/* Statistics */}
        <Route path="/statistics" element={<ProtectedRoute><StatisticsScreen /></ProtectedRoute>} />
        <Route path="/weekly-recap" element={<ProtectedRoute><WeeklyRecapScreen /></ProtectedRoute>} />
        <Route path="/weekly-recap/:userId" element={<ProtectedRoute><WeeklyRecapScreen /></ProtectedRoute>} />
        <Route path="/evolution" element={<ProtectedRoute><EvolutionScreen /></ProtectedRoute>} />
        <Route path="/evolution/:userId" element={<ProtectedRoute><EvolutionScreen /></ProtectedRoute>} />

        {/* Rankings & League */}
        <Route path="/ranking" element={<ProtectedRoute><RankingScreen /></ProtectedRoute>} />
        <Route path="/league" element={<ProtectedRoute><LeagueScreen /></ProtectedRoute>} />
        <Route path="/badges" element={<ProtectedRoute><BadgesScreen /></ProtectedRoute>} />

        {/* Locations */}
        <Route path="/locations" element={<ProtectedRoute><ManageLocationsScreen /></ProtectedRoute>} />
        <Route path="/location/:locationId" element={<ProtectedRoute><LocationDetailScreen /></ProtectedRoute>} />
        <Route path="/location/create" element={<ProtectedRoute><ManageLocationsScreen /></ProtectedRoute>} />
        <Route path="/owner/dashboard" element={<ProtectedRoute><FieldOwnerDashboardScreen /></ProtectedRoute>} />

        {/* Map */}
        <Route path="/map/games" element={<ProtectedRoute><PublicGamesMapScreen /></ProtectedRoute>} />
        <Route path="/map/locations" element={<ProtectedRoute><LocationsMapScreen /></ProtectedRoute>} />

        {/* Tactical */}
        <Route path="/tactical/:gameId" element={<ProtectedRoute><TacticalBoardScreen /></ProtectedRoute>} />

        {/* Settings */}
        <Route path="/settings" element={<ProtectedRoute><SettingsScreen /></ProtectedRoute>} />
        <Route path="/settings/theme" element={<ProtectedRoute><ThemeSettingsScreen /></ProtectedRoute>} />
        <Route path="/settings/gamification" element={<ProtectedRoute><GamificationSettingsScreen /></ProtectedRoute>} />

        {/* Notifications & Search */}
        <Route path="/notifications" element={<ProtectedRoute><NotificationsScreen /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute><GlobalSearchScreen /></ProtectedRoute>} />

        {/* About & Admin */}
        <Route path="/about" element={<ProtectedRoute><AboutScreen /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><UserManagementScreen /></ProtectedRoute>} />
        <Route path="/dev" element={<ProtectedRoute><DevToolsScreen /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: { xs: 'background.default', sm: 'divider' },
      }}
    >
      <Box
        id="mobile-shell"
        sx={{
          width: '100%',
          maxWidth: { xs: '100%', sm: 480 },
          minHeight: '100vh',
          bgcolor: 'background.default',
          boxShadow: { xs: 'none', sm: '0 0 40px rgba(0,0,0,0.12)' },
          position: 'relative',
          // transform cria um novo containing block para position:fixed
          // fazendo com que fixed elements fiquem contidos neste container
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
              <ErrorBoundary>
                <SkipNav />
                <MobileShell>
                  <Box component="main" id="main-content">
                    <AppRoutes />
                  </Box>
                  <ConnectionStatusWrapper />
                </MobileShell>
              </ErrorBoundary>
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
