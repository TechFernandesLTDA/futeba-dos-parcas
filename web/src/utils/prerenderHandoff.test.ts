import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HANDOFF_TIMEOUT_MS, initPrerenderHandoff, revealApp } from './prerenderHandoff';

function setupDom(withPrerender: boolean) {
  document.body.innerHTML = `${withPrerender ? '<div id="prerender"><h1>estático</h1></div>' : ''}<div id="root" style="display:none"></div>`;
}

describe('prerenderHandoff', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('revealApp remove o prerender e mostra o root', () => {
    setupDom(true);
    expect(revealApp()).toBe(true);
    expect(document.getElementById('prerender')).toBeNull();
    expect(document.getElementById('root')!.style.display).toBe('');
    expect(revealApp()).toBe(false);
  });

  it('não faz nada sem prerender (SPA shell)', () => {
    setupDom(false);
    initPrerenderHandoff(document);
    expect(document.getElementById('root')!.style.display).toBe('none');
  });

  it('mantém o prerender enquanto o app só tem skeleton e troca ao renderizar o h1', async () => {
    setupDom(true);
    initPrerenderHandoff(document);
    const root = document.getElementById('root')!;
    root.innerHTML = '<div class="skeleton"></div>';
    await Promise.resolve();
    expect(document.getElementById('prerender')).not.toBeNull();
    root.innerHTML = '<main><h1>Organizar pelada</h1></main>';
    await Promise.resolve();
    expect(document.getElementById('prerender')).toBeNull();
    expect(root.style.display).toBe('');
  });

  it('revela por timeout se o app nunca renderiza um h1', () => {
    setupDom(true);
    initPrerenderHandoff(document);
    vi.advanceTimersByTime(HANDOFF_TIMEOUT_MS + 1);
    expect(document.getElementById('prerender')).toBeNull();
    expect(document.getElementById('root')!.style.display).toBe('');
  });

  it('cancelar impede o handoff', () => {
    setupDom(true);
    const cancel = initPrerenderHandoff(document);
    cancel();
    vi.advanceTimersByTime(HANDOFF_TIMEOUT_MS + 1);
    expect(document.getElementById('prerender')).not.toBeNull();
  });
});
