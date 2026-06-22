import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getPageTransitionAnimation, type PageTransitionVariant } from './PageTransition.utils';

interface PageTransitionProps {
  children: React.ReactNode;
  variant?: PageTransitionVariant;
  sx?: SxProps<Theme>;
}

const fadeInKeyframes = {
  '@keyframes pageFadeIn': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

const slideUpKeyframes = {
  '@keyframes pageSlideUp': {
    from: { opacity: 0, transform: 'translateY(16px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

export const PageTransition = React.memo(function PageTransition({
  children,
  variant = 'fade',
  sx,
}: PageTransitionProps) {
  const reducedMotion = useReducedMotion();
  const keyframes = variant === 'slideUp' ? slideUpKeyframes : fadeInKeyframes;

  return (
    <Box
      sx={[
        {
          animation: getPageTransitionAnimation(variant, reducedMotion),
          ...(reducedMotion ? {} : keyframes),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
});

export default PageTransition;
