import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { PwaInstallProvider, usePwaInstall } from './usePwaInstall';

function wrapper({ children }: { children: ReactNode }) {
  return createElement(PwaInstallProvider, null, children);
}

function renderPwaHook() {
  return renderHook(() => usePwaInstall(), { wrapper });
}

function setNavigatorValue(key: keyof Navigator, value: unknown) {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
}

function createBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as BeforeInstallPromptEvent;
  const prompt = vi.fn().mockResolvedValue(undefined);

  Object.defineProperties(event, {
    platforms: { configurable: true, value: ['web'] },
    prompt: { configurable: true, value: prompt },
    userChoice: {
      configurable: true,
      value: Promise.resolve({ outcome, platform: 'web' }),
    },
  });

  return { event, prompt };
}

describe('usePwaInstall', () => {
  const persist = vi.fn().mockResolvedValue(false);

  beforeEach(() => {
    localStorage.clear();
    setNavigatorValue('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    setNavigatorValue('platform', 'MacIntel');
    setNavigatorValue('maxTouchPoints', 0);
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
    setNavigatorValue('storage', { persist });
    persist.mockClear();
  });

  it('mostra instrução manual no iPhone quando não está instalado', () => {
    setNavigatorValue(
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    );
    setNavigatorValue('platform', 'iPhone');
    setNavigatorValue('maxTouchPoints', 5);

    const { result } = renderPwaHook();

    expect(result.current.platform).toBe('ios');
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.shouldShow).toBe(true);
  });

  it('mostra instrução de Adicionar ao Dock no Safari do macOS', () => {
    setNavigatorValue(
      'userAgent',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
    );
    const { result } = renderPwaHook();
    expect(result.current.platform).toBe('safari-desktop');
    expect(result.current.canPrompt).toBe(false);
    expect(result.current.shouldShow).toBe(true);
  });

  it('mostra ajuda manual em navegadores Chromium mesmo antes do prompt nativo', () => {
    setNavigatorValue(
      'userAgent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
    );
    const { result } = renderPwaHook();
    expect(result.current.platform).toBe('chromium-desktop');
    expect(result.current.shouldShow).toBe(true);
  });

  it('captura beforeinstallprompt e executa o prompt nativo', async () => {
    const { result } = renderPwaHook();
    const { event, prompt } = createBeforeInstallPromptEvent();
    const preventDefault = vi.spyOn(event, 'preventDefault');

    act(() => {
      window.dispatchEvent(event);
    });

    await waitFor(() => expect(result.current.canPrompt).toBe(true));
    expect(preventDefault).toHaveBeenCalled();

    let installOutcome: 'accepted' | 'dismissed' | 'unavailable' = 'unavailable';
    await act(async () => {
      installOutcome = await result.current.install();
    });

    expect(prompt).toHaveBeenCalled();
    expect(installOutcome).toBe('accepted');
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.shouldShow).toBe(false);
  });

  it('não mostra chamada quando já está em modo standalone', () => {
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: true,
    });

    const { result } = renderPwaHook();

    expect(result.current.isStandalone).toBe(true);
    expect(result.current.shouldShow).toBe(false);
  });

  it('permite dispensar o prompt e não reapresenta após remontar', () => {
    const firstRender = renderPwaHook();
    const { event } = createBeforeInstallPromptEvent();

    act(() => {
      window.dispatchEvent(event);
    });

    expect(firstRender.result.current.shouldShow).toBe(true);

    act(() => {
      firstRender.result.current.dismiss();
    });

    expect(firstRender.result.current.shouldShow).toBe(false);

    firstRender.unmount();

    const secondRender = renderPwaHook();
    expect(secondRender.result.current.shouldShow).toBe(false);
  });

  it('pede persistência oportunisticamente após a instalação sem bloquear o fluxo', async () => {
    renderPwaHook();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  });
});
