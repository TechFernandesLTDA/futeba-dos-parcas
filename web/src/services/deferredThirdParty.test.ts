import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IDLE_FALLBACK_MS,
  __resetDeferredThirdPartyForTests,
  runWhenEngaged,
  shouldDeferThirdParty,
  whenEngaged,
} from './deferredThirdParty';

function mountPrerender(): void {
  const el = document.createElement('div');
  el.id = 'prerender';
  document.body.appendChild(el);
}

describe('deferredThirdParty', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetDeferredThirdPartyForTests();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-no-prerender');
  });

  afterEach(() => {
    __resetDeferredThirdPartyForTests();
    vi.useRealTimers();
  });

  it('shouldDeferThirdParty_semPrerender_retornaFalse', () => {
    expect(shouldDeferThirdParty()).toBe(false);
  });

  it('shouldDeferThirdParty_prerenderComSessaoConhecida_retornaFalse', () => {
    mountPrerender();
    document.documentElement.setAttribute('data-no-prerender', '');
    expect(shouldDeferThirdParty()).toBe(false);
  });

  it('runWhenEngaged_rotaDoApp_executaNaHora', () => {
    const cb = vi.fn();
    runWhenEngaged(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('runWhenEngaged_paginaPublica_esperaInteracao', () => {
    mountPrerender();
    const first = vi.fn();
    const second = vi.fn();
    runWhenEngaged(first);
    runWhenEngaged(second);
    expect(first).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('pointerdown'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    // Depois de liberado, novas chamadas executam na hora e uma nova interação não repete.
    const late = vi.fn();
    runWhenEngaged(late);
    expect(late).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('keydown'));
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('runWhenEngaged_paginaPublicaSemInteracao_liberaAposTempoOcioso', () => {
    mountPrerender();
    const cb = vi.fn();
    runWhenEngaged(cb);
    vi.advanceTimersByTime(IDLE_FALLBACK_MS - 1);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_001);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('runWhenEngaged_callbackComErro_naoImpedeOsOutros', () => {
    mountPrerender();
    const ok = vi.fn();
    runWhenEngaged(() => {
      throw new Error('falhou');
    });
    runWhenEngaged(ok);
    window.dispatchEvent(new Event('touchstart'));
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it('whenEngaged_paginaPublica_resolveNaInteracao', async () => {
    mountPrerender();
    let resolved = false;
    void whenEngaged().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
    window.dispatchEvent(new Event('scroll'));
    await Promise.resolve();
    expect(resolved).toBe(true);
  });
});
