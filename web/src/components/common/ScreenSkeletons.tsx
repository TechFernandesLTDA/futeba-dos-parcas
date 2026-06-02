import React from 'react';
import { Box, Skeleton, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';

function SkeletonCard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: (theme) => theme.shadows[4],
      }}
    >
      {children}
    </Box>
  );
}

export const HomeScreenSkeleton: React.FC = React.memo(function HomeScreenSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingHome')}>
      <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rounded" width={100} height={70} sx={{ borderRadius: 2, flex: 1 }} />
        ))}
      </Box>
      {Array.from({ length: 3 }).map((_, i) => (
        <SkeletonCard key={i}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Skeleton variant="rounded" width={60} height={22} sx={{ borderRadius: 1 }} />
            <Skeleton variant="rounded" width={80} height={22} sx={{ borderRadius: 1 }} />
          </Box>
          <Skeleton variant="text" width="60%" height={22} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <Skeleton variant="circular" width={16} height={16} />
            <Skeleton variant="text" width="50%" height={16} />
          </Box>
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton variant="text" width={100} height={16} />
            <Skeleton variant="rectangular" height={6} width="40%" sx={{ borderRadius: 3 }} />
          </Box>
        </SkeletonCard>
      ))}
    </Box>
  );
});

export const GameDetailSkeleton: React.FC = React.memo(function GameDetailSkeleton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Box role="status" aria-label={t('a11y.loadingGameDetails')}>
      <Box sx={{ height: 200, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 3 }}>
        <Skeleton variant="rounded" width={80} height={24} sx={{ borderRadius: 1, mb: 1 }} />
        <Skeleton variant="text" width="70%" height={28} sx={{ bgcolor: alpha(theme.palette.common.white, 0.3) }} />
        <Skeleton variant="text" width="50%" height={20} sx={{ bgcolor: alpha(theme.palette.common.white, 0.2) }} />
      </Box>
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map(i => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Skeleton variant="circular" width={20} height={20} />
            <Skeleton variant="text" width="60%" height={18} />
          </Box>
        ))}
        <Skeleton variant="text" width="30%" height={22} sx={{ mt: 3, mb: 2 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="50%" height={18} />
              <Skeleton variant="text" width="30%" height={14} />
            </Box>
            <Skeleton variant="rounded" width={60} height={28} sx={{ borderRadius: 1 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
});

export const GroupDetailSkeleton: React.FC = React.memo(function GroupDetailSkeleton() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Box role="status" aria-label={t('a11y.loadingGroupDetails')}>
      <Box sx={{ height: 160, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton variant="circular" width={80} height={80} />
      </Box>
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Skeleton variant="text" width="60%" height={26} sx={{ mx: 'auto', mb: 0.5 }} />
        <Skeleton variant="text" width="40%" height={18} sx={{ mx: 'auto', mb: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 3 }}>
          {[1, 2, 3].map(i => (
            <Box key={i} sx={{ textAlign: 'center' }}>
              <Skeleton variant="text" width={40} height={22} sx={{ mx: 'auto' }} />
              <Skeleton variant="text" width={60} height={14} sx={{ mx: 'auto' }} />
            </Box>
          ))}
        </Box>
        <Skeleton variant="text" width="30%" height={22} sx={{ mb: 2 }} />
        {Array.from({ length: 6 }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="50%" height={18} />
              <Skeleton variant="text" width="30%" height={14} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
});

export const ProfileScreenSkeleton: React.FC = React.memo(function ProfileScreenSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingProfile')}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <Skeleton variant="circular" width={96} height={96} sx={{ mb: 1.5 }} />
        <Skeleton variant="text" width="50%" height={24} />
        <Skeleton variant="text" width="30%" height={18} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 3 }}>
        {[1, 2, 3, 4].map(i => (
          <Box key={i} sx={{ textAlign: 'center' }}>
            <Skeleton variant="text" width={40} height={24} sx={{ mx: 'auto' }} />
            <Skeleton variant="text" width={50} height={14} sx={{ mx: 'auto' }} />
          </Box>
        ))}
      </Box>
      <Skeleton variant="text" width="30%" height={22} sx={{ mb: 1.5 }} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={70} height={70} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
    </Box>
  );
});

export const RankingScreenSkeleton: React.FC = React.memo(function RankingScreenSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingRanking')}>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
      {Array.from({ length: 8 }).map((_, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 1,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Skeleton variant="circular" width={28} height={28} />
          <Skeleton variant="circular" width={44} height={44} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="50%" height={18} />
            <Skeleton variant="text" width="30%" height={14} />
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Skeleton variant="text" width={40} height={22} />
            <Skeleton variant="rounded" width={60} height={18} sx={{ borderRadius: 1 }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
});

export const BadgesSkeleton: React.FC = React.memo(function BadgesSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingBadges')}>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
      <SkeletonCard>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="30%" height={22} />
            <Skeleton variant="text" width="50%" height={14} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
      </SkeletonCard>
      <Box sx={{ display: 'flex', gap: 1, mb: 2, overflow: 'hidden' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={80} height={32} sx={{ borderRadius: 1, flexShrink: 0 }} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Box sx={{ width: { xs: '100%', sm: 140 }, textAlign: 'center' }}>
              <Skeleton variant="circular" width={60} height={60} sx={{ mx: 'auto', mb: 1 }} />
              <Skeleton variant="text" width="80%" height={16} sx={{ mx: 'auto' }} />
              <Skeleton variant="rounded" width={60} height={20} sx={{ mx: 'auto', mt: 0.5, borderRadius: 1 }} />
            </Box>
          </SkeletonCard>
        ))}
      </Box>
    </Box>
  );
});

export const EditProfileSkeleton: React.FC = React.memo(function EditProfileSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingEditProfile')}>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
      <SkeletonCard>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Skeleton variant="circular" width={96} height={96} sx={{ mb: 2 }} />
          <Skeleton variant="text" width="60%" height={20} />
        </Box>
      </SkeletonCard>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i}>
          <Skeleton variant="text" width={80} height={14} sx={{ mb: 0.5 }} />
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
        </SkeletonCard>
      ))}
      <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2, mt: 2 }} />
    </Box>
  );
});

export const GlobalSearchSkeleton: React.FC = React.memo(function GlobalSearchSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingSearch')}>
      <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2, mb: 2 }} />
      <Skeleton variant="text" width="30%" height={22} sx={{ mb: 1.5 }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Skeleton variant="circular" width={44} height={44} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="50%" height={18} />
            <Skeleton variant="text" width="30%" height={14} />
          </Box>
        </Box>
      ))}
    </Box>
  );
});

export const LevelJourneySkeleton: React.FC = React.memo(function LevelJourneySkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingLevelJourney')}>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
      <SkeletonCard>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={22} />
            <Skeleton variant="text" width="30%" height={16} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
        <Skeleton variant="rectangular" height={8} sx={{ borderRadius: 3, mt: 1.5 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Skeleton variant="text" width={60} height={14} />
          <Skeleton variant="text" width={60} height={14} />
        </Box>
      </SkeletonCard>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="50%" height={18} />
              <Skeleton variant="text" width="70%" height={14} />
            </Box>
            <Skeleton variant="rounded" width={80} height={28} sx={{ borderRadius: 1 }} />
          </Box>
        </SkeletonCard>
      ))}
    </Box>
  );
});

export const StatisticSkeleton: React.FC = React.memo(function StatisticSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingStatistics')}>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
      <SkeletonCard>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={22} />
            <Skeleton variant="text" width="30%" height={16} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
      </SkeletonCard>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} variant="rounded" sx={{ flex: 1, height: 80, borderRadius: 2 }} />
        ))}
      </Box>
      <SkeletonCard>
        <Skeleton variant="text" width={100} height={20} sx={{ mb: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Skeleton variant="circular" width={140} height={140} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Box key={i} sx={{ textAlign: 'center' }}>
              <Skeleton variant="text" width={40} height={22} sx={{ mx: 'auto' }} />
              <Skeleton variant="text" width={60} height={14} sx={{ mx: 'auto' }} />
            </Box>
          ))}
        </Box>
      </SkeletonCard>
    </Box>
  );
});

export const LiveGameSkeleton: React.FC = React.memo(function LiveGameSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingLiveGame')}>
      <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Skeleton variant="rounded" sx={{ flex: 1, height: 100, borderRadius: 2 }} />
        <Skeleton variant="rounded" sx={{ flex: 1, height: 100, borderRadius: 2 }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rounded" sx={{ flex: 1, height: 60, borderRadius: 2 }} />
        ))}
      </Box>
      <Skeleton variant="text" width="30%" height={22} sx={{ mb: 1.5 }} />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonCard key={i}>
            <Box sx={{ width: { xs: '100%', sm: 150 }, textAlign: 'center' }}>
              <Skeleton variant="circular" width={48} height={48} sx={{ mx: 'auto', mb: 1 }} />
              <Skeleton variant="text" width="70%" height={16} sx={{ mx: 'auto' }} />
              <Skeleton variant="text" width="50%" height={14} sx={{ mx: 'auto', mt: 0.5 }} />
            </Box>
          </SkeletonCard>
        ))}
      </Box>
    </Box>
  );
});

export const WeeklyRecapSkeleton: React.FC = React.memo(function WeeklyRecapSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingWeeklyRecap')}>
      <Skeleton variant="text" width="50%" height={28} sx={{ mb: 2 }} />
      <SkeletonCard>
        <Skeleton variant="text" width={80} height={16} sx={{ mb: 1 }} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
              <Skeleton variant="text" width={50} height={36} sx={{ mx: 'auto' }} />
              <Skeleton variant="text" width={60} height={14} sx={{ mx: 'auto', mt: 0.5 }} />
            </Box>
          ))}
        </Box>
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton variant="text" width={100} height={16} sx={{ mb: 1 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
      </SkeletonCard>
      <Skeleton variant="text" width="40%" height={22} sx={{ mb: 1.5 }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Skeleton variant="circular" width={36} height={36} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="40%" height={14} />
          </Box>
        </Box>
      ))}
    </Box>
  );
});

export const AboutSkeleton: React.FC = React.memo(function AboutSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 2 }} role="status" aria-label={t('a11y.loadingAbout')}>
      <Skeleton variant="text" width="30%" height={28} sx={{ mb: 2 }} />
      <SkeletonCard>
        <Skeleton variant="text" width="50%" height={22} sx={{ mb: 1 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Box key={i} sx={{ mb: 1 }}>
            <Skeleton variant="text" width="100%" height={16} />
            <Skeleton variant="text" width="90%" height={16} />
            <Skeleton variant="text" width="70%" height={16} />
          </Box>
        ))}
      </SkeletonCard>
      <SkeletonCard>
        <Skeleton variant="text" width="40%" height={22} sx={{ mb: 1 }} />
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="circular" width={48} height={48} />
          ))}
        </Box>
        <Skeleton variant="text" width="60%" height={16} sx={{ mt: 1.5 }} />
      </SkeletonCard>
    </Box>
  );
});

const SCREEN_SKELETONS: Record<string, React.FC> = {
  home: HomeScreenSkeleton,
  'game-detail': GameDetailSkeleton,
  'group-detail': GroupDetailSkeleton,
  profile: ProfileScreenSkeleton,
  ranking: RankingScreenSkeleton,
  badges: BadgesSkeleton,
  'edit-profile': EditProfileSkeleton,
  search: GlobalSearchSkeleton,
  'level-journey': LevelJourneySkeleton,
  statistics: StatisticSkeleton,
  'live-game': LiveGameSkeleton,
  'weekly-recap': WeeklyRecapSkeleton,
  about: AboutSkeleton,
};

// eslint-disable-next-line react-refresh/only-export-components
export function getScreenSkeleton(screen: string): React.FC | undefined {
  return SCREEN_SKELETONS[screen];
}
