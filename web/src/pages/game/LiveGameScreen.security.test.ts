import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/firebase', () => ({db: {}}));
vi.mock('../../services/cloudFunctions', () => ({
  finishGameLifecycle: vi.fn(),
  startGameLifecycle: vi.fn(),
  submitLiveGameEvent: vi.fn(),
  deleteLiveGameEvent: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({useAuth: vi.fn()}));
vi.mock('../../contexts/ToastContext', () => ({useToast: vi.fn()}));

import { getStreamEmbedUrl } from './LiveGameScreen';

const VIDEO_ID = 'dQw4w9WgXcQ';

describe('getStreamEmbedUrl', () => {
  it.each([
    [`https://www.youtube.com/watch?v=${VIDEO_ID}`, `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`],
    [`https://youtu.be/${VIDEO_ID}?t=30`, `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`],
    [`https://m.youtube.com/shorts/${VIDEO_ID}`, `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`],
    [`http://youtube.com/live/${VIDEO_ID}`, `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`],
  ])('normaliza uma URL legítima do YouTube: %s', (source, expected) => {
    expect(getStreamEmbedUrl(source, 'futebadosparcas.web.app')).toBe(expected);
  });

  it('gera player Twitch com parâmetros codificados', () => {
    expect(getStreamEmbedUrl('https://www.twitch.tv/futeba_parcas', 'FutebaDosParcas.web.app'))
      .toBe('https://player.twitch.tv/?channel=futeba_parcas&parent=futebadosparcas.web.app');
  });

  it.each([
    `https://youtube.com.attacker.example/watch?v=${VIDEO_ID}`,
    `https://evilyoutube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com@attacker.example/watch?v=${VIDEO_ID}`,
    `https://twitch.tv.attacker.example/futeba_parcas`,
    `ftp://www.youtube.com/watch?v=${VIDEO_ID}`,
    'javascript:alert(1)',
    'https://www.youtube.com/watch?v=bad%2Fidentifier',
    `https://www.youtube.com:444/watch?v=${VIDEO_ID}`,
  ])('rejeita origem, protocolo ou identificador não confiável: %s', (source) => {
    expect(getStreamEmbedUrl(source, 'futebadosparcas.web.app')).toBeNull();
  });
});
