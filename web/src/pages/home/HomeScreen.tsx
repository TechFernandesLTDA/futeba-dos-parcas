import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Snackbar,
  Button,
  Skeleton,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePrefetchHome } from '../../hooks/usePrefetchHome';
import { usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const HomeTab = lazy(() => import('./tabs/HomeTab').then(m => ({ default: m.HomeTab })));
const GamesTab = lazy(() => import('./tabs/GamesTab').then(m => ({ default: m.GamesTab })));
const GroupsTab = lazy(() => import('./tabs/GroupsTab').then(m => ({ default: m.GroupsTab })));
const RankingsTab = lazy(() => import('./tabs/RankingsTab').then(m => ({ default: m.RankingsTab })));
const ProfileTab = lazy(() => import('./tabs/ProfileTab').then(m => ({ default: m.ProfileTab })));

import { useNotificationPermission } from '../../hooks/useNotificationPermission';
import { WhatsNewPopupHost } from '../../components/whatsnew/WhatsNewPopupHost';
import { TeamOfTheWeek } from '../../components/game/TeamOfTheWeek';
import { QuickActions } from '../../components/home/QuickActions';
import { pageSpacing } from '../../theme/pageTokens';

function TabSkeleton() {
  return (
    <Box sx={{ p: pageSpacing.pagePadding }}>
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} variant="rounded" height={80} sx={{ mb: 1.5 }} />
      ))}
    </Box>
  );
}

export function HomeScreen() {
  const [searchParams] = useSearchParams();
  const tabValue = parseInt(searchParams.get('tab') || '0');
  const { permission, requestPermission } = useNotificationPermission();
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [mountedTabs, setMountedTabs] = useState<Set<number>>(() => new Set([tabValue]));
  const [towExpanded, setTowExpanded] = useState(true);
  const { t } = useTranslation();
  useDocumentTitle(t('common.appName'));

  usePrefetchHome();

  const { metrics } = usePerformanceMonitoring({ screenName: 'HomeScreen' });

  useEffect(() => {
    if (permission === 'default') {
      const timer = setTimeout(() => setShowNotifBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [permission]);

  useEffect(() => {
    setMountedTabs(prev => {
      if (prev.has(tabValue)) return prev;
      return new Set([...prev, tabValue]);
    });
  }, [tabValue]);

  return (
    <Box>
      {tabValue === 0 && (
        <Box sx={{ px: pageSpacing.pagePadding, pb: 0, pt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              onClick={() => setTowExpanded(!towExpanded)}
              aria-label={towExpanded ? 'Recolher destaques' : 'Expandir destaques'}
              sx={{ mb: 0.5 }}
            >
              {towExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={towExpanded}>
            <Suspense fallback={null}>
              <TeamOfTheWeek />
            </Suspense>
            <QuickActions />
          </Collapse>
        </Box>
      )}

      <Box
        role="tabpanel"
        id="main-tabpanel"
        aria-labelledby={`tab-${tabValue}`}
        sx={{ flex: 1 }}
      >
        <Suspense fallback={<TabSkeleton />}>
          {mountedTabs.has(0) && <Box sx={{ display: tabValue === 0 ? 'block' : 'none' }}><HomeTab /></Box>}
          {mountedTabs.has(1) && <Box sx={{ display: tabValue === 1 ? 'block' : 'none' }}><GamesTab /></Box>}
          {mountedTabs.has(2) && <Box sx={{ display: tabValue === 2 ? 'block' : 'none' }}><GroupsTab /></Box>}
          {mountedTabs.has(3) && <Box sx={{ display: tabValue === 3 ? 'block' : 'none' }}><RankingsTab /></Box>}
          {mountedTabs.has(4) && <Box sx={{ display: tabValue === 4 ? 'block' : 'none' }}><ProfileTab /></Box>}
        </Suspense>
      </Box>

      <Snackbar
        open={showNotifBanner}
        message={t('notifications.bannerMessage', 'Ative as notificações para receber alertas de jogos!')}
        action={
          <>
            <Button color="secondary" size="small" onClick={() => setShowNotifBanner(false)}>
              {t('common.later', 'Depois')}
            </Button>
            <Button color="primary" size="small" onClick={() => { requestPermission(); setShowNotifBanner(false); }}>
              {t('common.activate', 'Ativar')}
            </Button>
          </>
        }
        onClose={() => setShowNotifBanner(false)}
        sx={{ bottom: { xs: pageSpacing.bottomBarHeight + 16, md: 16 } }}
      />

      <WhatsNewPopupHost />
      <PerformanceOverlay metrics={metrics} />
    </Box>
  );
}
