import { useCallback, useEffect, useMemo, useState } from 'react';

type InstallPlatform = 'android' | 'ios' | 'desktop' | 'unknown';
const DISMISS_STORAGE_KEY = 'pwa_install_prompt_dismissed';

function getInstallPlatform(): InstallPlatform {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1);

  if (isIOS) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  if (!/Mobi|Android/i.test(userAgent)) return 'desktop';

  return 'unknown';
}

function getStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  return (typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches)) ||
    window.navigator.standalone === true;
}

export function usePwaInstall() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(getStandaloneMode);
  const [isInstalled, setIsInstalled] = useState(false);
  const platform = useMemo(getInstallPlatform, []);

  const setDismissedState = useCallback((value: boolean) => {
    setDismissed(value);
    try {
      if (value) {
        localStorage.setItem(DISMISS_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(DISMISS_STORAGE_KEY);
      }
    } catch {
      // noop
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
    };

    const standaloneMedia = typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;
    const handleStandaloneChange = () => setIsStandalone(getStandaloneMode());

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    if (!standaloneMedia) {
      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleInstalled);
      };
    }
    if (typeof standaloneMedia.addEventListener === 'function') {
      standaloneMedia.addEventListener('change', handleStandaloneChange);
    } else {
      standaloneMedia.addListener(handleStandaloneChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      if (typeof standaloneMedia.removeEventListener === 'function') {
        standaloneMedia.removeEventListener('change', handleStandaloneChange);
      } else {
        standaloneMedia.removeListener(handleStandaloneChange);
      }
    };
  }, [setDismissedState]);

  const dismiss = useCallback(() => {
    setDismissedState(true);
  }, [setDismissedState]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setDismissedState(false);
    } else {
      setDismissedState(true);
    }

    return choice.outcome;
  }, [deferredPrompt, setDismissedState]);

  return {
    canPrompt: Boolean(deferredPrompt),
    dismiss,
    install,
    dismissed,
    isInstalled,
    isStandalone,
    platform,
    shouldShow: !dismissed && !isStandalone && !isInstalled && (Boolean(deferredPrompt) || platform === 'ios'),
  };
}
