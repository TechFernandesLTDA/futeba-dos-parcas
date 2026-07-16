import { useEffect } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getPageTransitionAnimation } from './PageTransition.utils';
import { motionDuration, motionEasing } from '../../theme/motion';
import { PageTransition } from './PageTransition';

const reducedMotionState = vi.hoisted(() => ({ active: false }));

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => reducedMotionState.active,
}));

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

  it('sinaliza conclusão somente quando a animação do contêiner termina', () => {
    const onTransitionComplete = vi.fn();
    const { container, getByText } = render(
      <PageTransition transitionKey="/game/1" onTransitionComplete={onTransitionComplete}>
        <span>Filho animado</span>
      </PageTransition>,
    );

    expect(onTransitionComplete).not.toHaveBeenCalled();
    fireEvent.animationEnd(getByText('Filho animado'), { bubbles: true });
    expect(onTransitionComplete).not.toHaveBeenCalled();
    fireEvent.animationEnd(container.querySelector('[data-transition-key]') as HTMLElement, { bubbles: true });
    expect(onTransitionComplete).toHaveBeenCalledTimes(1);
  });

  it('sinaliza conclusão imediatamente quando movimento reduzido está ativo', () => {
    reducedMotionState.active = true;
    const onTransitionComplete = vi.fn();

    render(
      <PageTransition transitionKey="/game/1" onTransitionComplete={onTransitionComplete}>
        Conteúdo
      </PageTransition>,
    );

    expect(onTransitionComplete).toHaveBeenCalledTimes(1);
    reducedMotionState.active = false;
  });
});
