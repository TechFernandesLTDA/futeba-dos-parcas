import { useCallback, useEffect, useMemo, useState } from 'react';

type InstallPlatform = 'android' | 'ios' | 'desktop' | 'unknown';

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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(getStandaloneMode);
  const [isInstalled, setIsInstalled] = useState(false);
  const platform = useMemo(getInstallPlatform, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
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
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }

    return choice.outcome;
  }, [deferredPrompt]);

  return {
    canPrompt: Boolean(deferredPrompt),
    install,
    isInstalled,
    isStandalone,
    platform,
    shouldShow: !isStandalone && !isInstalled && (Boolean(deferredPrompt) || platform === 'ios'),
  };
}
