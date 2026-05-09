interface FeedbackContext {
  platform: string;
  app_version: string;
  screen_route: string;
  device_info: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    pixelRatio: number;
    vendor: string;
  };
  locale: string;
}

export function captureContext(): FeedbackContext {
  return {
    platform: 'web',
    app_version: '1.21.3',
    screen_route: typeof window !== 'undefined' ? window.location.pathname : '',
    device_info: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || '',
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      pixelRatio: window.devicePixelRatio || 1,
      vendor: navigator.vendor || '',
    },
    locale: navigator.language,
  };
}
