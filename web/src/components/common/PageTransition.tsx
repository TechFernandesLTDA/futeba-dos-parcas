import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

interface PageTransitionProps {
  children: React.ReactNode;
  variant?: 'fade' | 'slideUp';
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
  const animationName = variant === 'slideUp' ? 'pageSlideUp' : 'pageFadeIn';
  const keyframes = variant === 'slideUp' ? slideUpKeyframes : fadeInKeyframes;

  return (
    <Box
      sx={[
        {
          animation: `${animationName} 0.2s ease-out`,
          ...keyframes,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
});

export default PageTransition;
