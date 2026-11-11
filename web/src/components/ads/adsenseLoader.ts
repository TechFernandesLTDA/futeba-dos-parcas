import type { AdsConfig } from '../../config/ads';

declare global {
  interface Window {
    adsbygoogle?: unknown[] & { requestNonPersonalizedAds?: number };
  }
}

const SCRIPT_ATTR = 'data-adsense-loader';
let loadPromise: Promise<boolean> | null = null;

/**
 * Carrega o script do AdSense uma única vez. Resolve true quando carregou e false se foi
 * bloqueado (bloqueador de anúncios, CSP, rede). Nunca rejeita.
 */
export function loadAdSense(config: AdsConfig): Promise<boolean> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise<boolean>((resolve) => {
    try {
      const queue = (window.adsbygoogle = window.adsbygoogle || []);
      queue.requestNonPersonalizedAds = config.nonPersonalized ? 1 : 0;
      if (document.querySelector(`script[${SCRIPT_ATTR}]`)) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.setAttribute(SCRIPT_ATTR, '1');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(config.publisherId)}`;
      script.onload = () => resolve(true);
      script.onerror = () => {
        script.remove();
        loadPromise = null;
        resolve(false);
      };
      document.head.appendChild(script);
    } catch {
      loadPromise = null;
      resolve(false);
    }
  });
  return loadPromise;
}

/** Só para testes. */
export function resetAdSenseLoaderForTests(): void {
  loadPromise = null;
}
