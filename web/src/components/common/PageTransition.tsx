import React, { useLayoutEffect, useRef } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getPageTransitionAnimation, type PageTransitionVariant } from './PageTransition.utils';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Identifica a navegação para reiniciar apenas a animação, sem remontar filhos. */
  transitionKey: string;
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
  transitionKey,
  variant = 'fade',
  sx,
}: PageTransitionProps) {
  const reducedMotion = useReducedMotion();
  const keyframes = variant === 'slideUp' ? slideUpKeyframes : fadeInKeyframes;
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.animation = 'none';
    if (reducedMotion) return;

    // Reinicia a animação CSS sem usar uma key React que remonte toda a rota.
    void container.offsetWidth;
    container.style.animation = getPageTransitionAnimation(variant, false);

    return () => {
      container.style.animation = 'none';
    };
  }, [reducedMotion, transitionKey, variant]);

  return (
    <Box
      ref={containerRef}
      data-transition-key={transitionKey}
      sx={[
        keyframes,
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
});

export default PageTransition;
