import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type InstallPlatform = 'android' | 'ios' | 'safari-desktop' | 'chromium-desktop' | 'unknown';

const DISMISS_STORAGE_KEY = 'pwa_install_prompt_dismissed_until';
const LEGACY_DISMISS_STORAGE_KEY = 'pwa_install_prompt_dismissed';
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

function getInstallPlatform(): InstallPlatform {
  if (typeof window === 'undefined') return 'unknown';
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  const isSafari = /Safari/i.test(userAgent) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|Vivaldi|FxiOS/i.test(userAgent);
  if (isSafari) return 'safari-desktop';
  const isChromium = /Chrome|Chromium|Edg|OPR|Vivaldi/i.test(userAgent);
  if (isChromium) return 'chromium-desktop';
  return 'unknown';
}

function getStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches)) ||
    window.navigator.standalone === true;
}

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const dismissedUntil = Number(localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    if (dismissedUntil > Date.now()) return true;
    localStorage.removeItem(LEGACY_DISMISS_STORAGE_KEY);
    localStorage.removeItem(DISMISS_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
}

interface PwaInstallValue {
  canPrompt: boolean;
  dismiss: () => void;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismissed: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  platform: InstallPlatform;
  shouldShow: boolean;
}

const PwaInstallContext = createContext<PwaInstallValue | null>(null);

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(getStandaloneMode);
  const [isInstalled, setIsInstalled] = useState(false);
  const persistenceRequested = useRef(false);
  const platform = useMemo(getInstallPlatform, []);

  const requestPersistentStorage = useCallback(() => {
    if (persistenceRequested.current || !navigator.storage?.persist) return;
    persistenceRequested.current = true;
    void navigator.storage.persist().catch(() => undefined);
  }, []);

  const setDismissedState = useCallback((value: boolean) => {
    setDismissed(value);
    try {
      if (value) {
        localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_MS));
      } else {
        localStorage.removeItem(DISMISS_STORAGE_KEY);
      }
      localStorage.removeItem(LEGACY_DISMISS_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private browsing; session state still works.
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
      setDismissedState(false);
      requestPersistentStorage();
    };
    const standaloneMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;
    const handleStandaloneChange = () => {
      const standalone = getStandaloneMode();
      setIsStandalone(standalone);
      if (standalone) requestPersistentStorage();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    if (standaloneMedia && typeof standaloneMedia.addEventListener === 'function') {
      standaloneMedia.addEventListener('change', handleStandaloneChange);
    } else if (standaloneMedia) {
      standaloneMedia.addListener(handleStandaloneChange);
    }
    if (getStandaloneMode()) requestPersistentStorage();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      if (standaloneMedia && typeof standaloneMedia.removeEventListener === 'function') {
        standaloneMedia.removeEventListener('change', handleStandaloneChange);
      } else if (standaloneMedia) {
        standaloneMedia.removeListener(handleStandaloneChange);
      }
    };
  }, [requestPersistentStorage, setDismissedState]);

  const dismiss = useCallback(() => setDismissedState(true), [setDismissedState]);
  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setDismissedState(false);
      requestPersistentStorage();
    } else {
      setDismissedState(true);
    }
    return choice.outcome;
  }, [deferredPrompt, requestPersistentStorage, setDismissedState]);

  const value = useMemo<PwaInstallValue>(() => ({
    canPrompt: Boolean(deferredPrompt),
    dismiss,
    install,
    dismissed,
    isInstalled,
    isStandalone,
    platform,
    shouldShow: !dismissed && !isStandalone && !isInstalled &&
      (Boolean(deferredPrompt) || platform !== 'unknown'),
  }), [deferredPrompt, dismiss, dismissed, install, isInstalled, isStandalone, platform]);

  return createElement(PwaInstallContext.Provider, { value }, children);
}

export function usePwaInstall() {
  const value = useContext(PwaInstallContext);
  if (!value) throw new Error('usePwaInstall must be used within PwaInstallProvider');
  return value;
}
