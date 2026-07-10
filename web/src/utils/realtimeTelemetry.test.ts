import { describe, expect, it, vi } from 'vitest';

vi.mock('../services/cloudFunctions', () => ({
  getCallable: vi.fn(() => vi.fn()),
}));

import {
  MAX_REALTIME_SAMPLE_RATE,
  createRealtimeTelemetry,
  normalizeRealtimeSampleRate,
  shouldSampleRealtimeTelemetry,
} from './realtimeTelemetry';

function findSeed(sampled: boolean): string {
  for (let index = 0; index < 100_000; index += 1) {
    const seed = `seed-${index}`;
    if (shouldSampleRealtimeTelemetry(seed, MAX_REALTIME_SAMPLE_RATE) === sampled) {
      return seed;
    }
  }
  throw new Error('Seed determinística não encontrada');
}

describe('realtimeTelemetry', () => {
  it('mantém sampling determinístico e limita qualquer configuração a 5%', () => {
    expect(normalizeRealtimeSampleRate(1)).toBe(MAX_REALTIME_SAMPLE_RATE);
    expect(normalizeRealtimeSampleRate(-1)).toBe(0);
    expect(normalizeRealtimeSampleRate(Number.NaN)).toBe(0);

    for (let index = 0; index < 1000; index += 1) {
      const seed = `client-${index}`;
      expect(shouldSampleRealtimeTelemetry(seed, 1)).toBe(
        shouldSampleRealtimeTelemetry(seed, MAX_REALTIME_SAMPLE_RATE),
      );
      expect(shouldSampleRealtimeTelemetry(seed, 0)).toBe(false);
    }
  });

  it('não envia nada para cliente fora da amostra', () => {
    const send = vi.fn();
    const telemetry = createRealtimeTelemetry({
      seed: findSeed(false),
      sampleRate: MAX_REALTIME_SAMPLE_RATE,
      release: '1.51.35',
      send,
    });
    telemetry.record('games', 'error', 10);
    telemetry.start('group_polls', 'bootstrap').finish();
    expect(telemetry.sampled).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('mede bootstrap, apply, reconnect e error com clock e sender injetáveis', () => {
    let now = 100;
    const send = vi.fn();
    const telemetry = createRealtimeTelemetry({
      now: () => now,
      seed: findSeed(true),
      sampleRate: MAX_REALTIME_SAMPLE_RATE,
      release: '1.51.35',
      send,
    });

    const bootstrap = telemetry.start('games', 'bootstrap');
    now = 220;
    bootstrap.finish();
    bootstrap.finish();

    const apply = telemetry.start('games', 'apply');
    now = 245;
    apply.finish();

    const reconnect = telemetry.start('group_polls', 'reconnect');
    now = 300;
    reconnect.finish();

    const failed = telemetry.start('group_polls', 'apply');
    now = 340;
    failed.error();

    expect(send).toHaveBeenCalledTimes(4);
    expect(send.mock.calls.map(([metric]) => metric)).toEqual([
      {
        platform: 'web',
        flow: 'games',
        phase: 'bootstrap',
        duration: 120,
        release: '1.51.35',
      },
      {
        platform: 'web',
        flow: 'games',
        phase: 'apply',
        duration: 25,
        release: '1.51.35',
      },
      {
        platform: 'web',
        flow: 'group_polls',
        phase: 'reconnect',
        duration: 55,
        release: '1.51.35',
      },
      {
        platform: 'web',
        flow: 'group_polls',
        phase: 'error',
        duration: 40,
        release: '1.51.35',
      },
    ]);
    for (const [metric] of send.mock.calls) {
      expect(Object.keys(metric).sort()).toEqual([
        'duration',
        'flow',
        'phase',
        'platform',
        'release',
      ]);
      expect(metric).not.toHaveProperty('uid');
      expect(metric).not.toHaveProperty('name');
      expect(metric).not.toHaveProperty('path');
      expect(metric).not.toHaveProperty('message');
    }
  });

  it('normaliza release/duração antes do envio', () => {
    const send = vi.fn();
    const telemetry = createRealtimeTelemetry({
      seed: findSeed(true),
      sampleRate: MAX_REALTIME_SAMPLE_RATE,
      release: 'user@example.com',
      send,
    });
    telemetry.record('games', 'error', Number.POSITIVE_INFINITY);
    expect(send).toHaveBeenCalledWith({
      platform: 'web',
      flow: 'games',
      phase: 'error',
      duration: 0,
      release: '0.0.0',
    });
  });
});
