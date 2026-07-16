import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getPageTransitionAnimation } from './PageTransition.utils';
import { motionDuration, motionEasing } from '../../theme/motion';
import { PageTransition } from './PageTransition';

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

  it('reinicia a animação de rota sem desmontar filhos estáveis', () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();

    function StatefulChild() {
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <span>Estado preservado</span>;
    }

    const { container, rerender, unmount } = render(
      <PageTransition transitionKey="/game/1" variant="slideUp">
        <StatefulChild />
      </PageTransition>,
    );

    const transition = container.firstElementChild as HTMLElement;
    expect(transition).toHaveAttribute('data-transition-key', '/game/1');
    expect(transition.style.animation).toContain('pageSlideUp');

    rerender(
      <PageTransition transitionKey="/game/2" variant="slideUp">
        <StatefulChild />
      </PageTransition>,
    );

    expect(transition).toHaveAttribute('data-transition-key', '/game/2');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();

    unmount();
    expect(unmounted).toHaveBeenCalledTimes(1);
  });
});
