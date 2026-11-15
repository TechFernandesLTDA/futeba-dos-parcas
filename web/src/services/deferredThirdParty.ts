// Terceiros adiados nas páginas públicas prerenderizadas (#4196).
//
// O visitante anônimo de uma página pública (/, /organizar-pelada, /parcerias...) recebe o HTML
// estático e só lê. Carregar o reCAPTCHA Enterprise do App Check (~350 KB) e o gtag do Analytics
// (~160 KB) logo no boot ocupa a thread principal por mais de 1 s em celulares e CPUs lentas
// (TBT de ~1,3 s no runner do GitHub). Nessas páginas os dois só começam na primeira interação
// do visitante (toque, tecla, rolagem) ou depois de um tempo ocioso, o que vier primeiro.
// Rotas do app, sessão conhecida (`data-no-prerender`) e testes continuam iniciando na hora.

/** Eventos que indicam que o visitante começou a usar a página. */
export const ENGAGEMENT_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

/** Rede de segurança: sem interação, inicia mesmo assim depois deste tempo (ms). */
export const IDLE_FALLBACK_MS = 15_000;

/** true quando a página é um prerender público mostrado a um visitante sem sessão conhecida. */
export function shouldDeferThirdParty(doc: Document | undefined = globalThis.document): boolean {
  if (!doc) return false;
  return Boolean(doc.getElementById('prerender')) && !doc.documentElement.hasAttribute('data-no-prerender');
}

type Callback = () => void;

let pending: Callback[] | null = null;
let released = false;

function release(): void {
  if (released) return;
  released = true;
  const callbacks = pending ?? [];
  pending = null;
  for (const event of ENGAGEMENT_EVENTS) {
    window.removeEventListener(event, release, true);
  }
  for (const callback of callbacks) {
    try {
      callback();
    } catch {
      // Um terceiro com falha não pode impedir os outros de iniciar.
    }
  }
}

function arm(fallbackMs: number): Callback[] {
  for (const event of ENGAGEMENT_EVENTS) {
    window.addEventListener(event, release, { capture: true, passive: true, once: true });
  }
  setTimeout(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
      .requestIdleCallback;
    if (idle) idle(release, { timeout: 5_000 });
    else release();
  }, fallbackMs);
  return [];
}

/**
 * Executa `callback` já (fora do modo adiado) ou na primeira interação / após o tempo ocioso.
 * A decisão de adiar é tomada uma vez, na primeira chamada, e vale para todos os terceiros.
 */
export function runWhenEngaged(callback: Callback, fallbackMs = IDLE_FALLBACK_MS): void {
  if (released || typeof window === 'undefined') {
    callback();
    return;
  }
  if (pending === null) {
    if (!shouldDeferThirdParty()) {
      released = true;
      callback();
      return;
    }
    pending = arm(fallbackMs);
  }
  pending.push(callback);
}

/** Promise que resolve quando os terceiros podem iniciar. */
export function whenEngaged(fallbackMs = IDLE_FALLBACK_MS): Promise<void> {
  return new Promise((resolve) => runWhenEngaged(resolve, fallbackMs));
}

/** Só para testes: volta ao estado inicial. */
export function __resetDeferredThirdPartyForTests(): void {
  if (pending !== null && !released) {
    for (const event of ENGAGEMENT_EVENTS) {
      window.removeEventListener(event, release, true);
    }
  }
  pending = null;
  released = false;
}
