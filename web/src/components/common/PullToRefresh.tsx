import React, { useState, useCallback, useRef } from 'react';
import { Box, CircularProgress, Typography, useTheme, alpha } from '@mui/material';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

const THRESHOLD = 80;

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
}) => {
  const theme = useTheme();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing || window.scrollY > 0) return;
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 120));
    }
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, onRefresh]);

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
          transition: 'height 0.2s ease',
          height: refreshing ? 56 : pullDistance,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        {refreshing ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Atualizando...
            </Typography>
          </Box>
        ) : pullDistance > 20 ? (
          <Typography
            variant="body2"
            color={pullDistance >= THRESHOLD ? 'primary' : 'text.disabled'}
          >
            {pullDistance >= THRESHOLD ? 'Solte para atualizar' : 'Puxe para atualizar'}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Box>
  );
};
