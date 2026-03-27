import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEvent, trackScreenView } from './analytics';

describe('analytics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trackEvent loga em modo dev', () => {
    trackEvent('login', { method: 'email' });
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('login'),
      expect.objectContaining({ method: 'email' })
    );
  });

  it('trackScreenView registra tela', () => {
    trackScreenView('HomeScreen');
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('screen_viewed'),
      expect.objectContaining({ screen: 'HomeScreen' })
    );
  });

  it('trackEvent com parâmetros de jogo', () => {
    trackEvent('game_created', { fieldType: 'SOCIETY', groupId: 'g1' });
    expect(console.debug).toHaveBeenCalled();
  });
});
