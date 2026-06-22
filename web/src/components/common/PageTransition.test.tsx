import { describe, expect, it } from 'vitest';
import { getPageTransitionAnimation } from './PageTransition.utils';
import { motionDuration, motionEasing } from '../../theme/motion';

describe('PageTransition', () => {
  it('usa fade curto como transição padrão', () => {
    expect(getPageTransitionAnimation()).toBe(
      `pageFadeIn ${motionDuration.short}ms ${motionEasing.decelerate}`
    );
  });

  it('usa slide-up médio para rotas secundárias', () => {
    expect(getPageTransitionAnimation('slideUp')).toBe(
      `pageSlideUp ${motionDuration.medium}ms ${motionEasing.decelerate}`
    );
  });

  it('desativa animação quando prefers-reduced-motion está ativo', () => {
    expect(getPageTransitionAnimation('slideUp', true)).toBe('none');
  });
});
