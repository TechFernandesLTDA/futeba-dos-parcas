import React from 'react';
import { Box, Skeleton, useTheme, alpha } from '@mui/material';

function SkeletonCard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: `0 2px 8px ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      {children}
    </Box>
  );
}

export const HomeScreenSkeleton: React.FC = React.memo(function HomeScreenSkeleton() {
  return (
    <Box sx={{ p: 2 }} role="status" aria-label="Carregando tela inicial">
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
  const theme = useTheme();
  return (
    <Box role="status" aria-label="Carregando detalhes do jogo">
      <Box sx={{ height: 200, bgcolor: alpha(theme.palette.primary.main, 0.08), display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', p: 3 }}>
        <Skeleton variant="rounded" width={80} height={24} sx={{ borderRadius: 1, mb: 1 }} />
        <Skeleton variant="text" width="70%" height={28} sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
        <Skeleton variant="text" width="50%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
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
  const theme = useTheme();
  return (
    <Box role="status" aria-label="Carregando detalhes do grupo">
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
  return (
    <Box sx={{ p: 2 }} role="status" aria-label="Carregando perfil">
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
  return (
    <Box sx={{ p: 2 }} role="status" aria-label="Carregando ranking">
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

const SCREEN_SKELETONS: Record<string, React.FC> = {
  home: HomeScreenSkeleton,
  'game-detail': GameDetailSkeleton,
  'group-detail': GroupDetailSkeleton,
  profile: ProfileScreenSkeleton,
  ranking: RankingScreenSkeleton,
};

// eslint-disable-next-line react-refresh/only-export-components
export function getScreenSkeleton(screen: string): React.FC | undefined {
  return SCREEN_SKELETONS[screen];
}
