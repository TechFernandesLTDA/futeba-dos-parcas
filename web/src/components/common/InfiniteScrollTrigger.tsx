import React, { useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  endMessage?: string;
}

export const InfiniteScrollTrigger: React.FC<InfiniteScrollTriggerProps> = ({
  onLoadMore,
  hasMore,
  loading,
  endMessage = 'Você chegou ao fim!',
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loading]);

  return (
    <Box ref={sentinelRef} sx={{ py: 3, textAlign: 'center' }}>
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Carregando mais...
          </Typography>
        </Box>
      ) : !hasMore ? (
        <Typography variant="body2" color="text.disabled">
          {endMessage}
        </Typography>
      ) : null}
    </Box>
  );
};
