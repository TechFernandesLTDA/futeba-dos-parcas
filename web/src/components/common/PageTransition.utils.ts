import { motionDuration, motionEasing } from '../../theme/motion';

export type PageTransitionVariant = 'fade' | 'slideUp';

export function getPageTransitionAnimation(
  variant: PageTransitionVariant = 'fade',
  reducedMotion = false
): string {
  if (reducedMotion) return 'none';

  const animationName = variant === 'slideUp' ? 'pageSlideUp' : 'pageFadeIn';
  const duration = variant === 'slideUp' ? motionDuration.medium : motionDuration.short;
  return `${animationName} ${duration}ms ${motionEasing.decelerate}`;
}
