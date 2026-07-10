import type { HttpsCallable } from 'firebase/functions';
import { getCallable } from '../services/cloudFunctions';

export const MAX_REALTIME_SAMPLE_RATE = 0.05;
const SAMPLE_SEED_STORAGE_KEY = 'realtime_slo_sample_seed_v1';
const RELEASE_PATTERN = /^(?:v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?|[a-f0-9]{7,12})$/i;

export type RealtimeTelemetryPlatform = 'web' | 'android' | 'ios';
export type RealtimeTelemetryFlow =
  | 'games'
  | 'group_polls'
  | 'direct_messages'
  | 'players'
  | 'live_events'
  | 'cashbox'
  | 'live_game'
  | 'social_feed'
  | 'public_games_map'
  | 'locations_map';
export type RealtimeTelemetryPhase = 'bootstrap' | 'apply' | 'reconnect' | 'error';

export interface RealtimeTelemetryMetric {
  platform: RealtimeTelemetryPlatform;
  flow: RealtimeTelemetryFlow;
  phase: RealtimeTelemetryPhase;
  duration: number;
  release: string;
}

export interface RealtimeMeasurement {
  finish: () => void;
  error: () => void;
  cancel: () => void;
}

interface RealtimeTelemetryOptions {
  now?: () => number;
  release?: string;
  sampleRate?: number;
  seed?: string;
  send?: (metric: RealtimeTelemetryMetric) => void | Promise<unknown>;
}

let fallbackSeed: string | null = null;
let metricCallable: HttpsCallable<RealtimeTelemetryMetric, unknown> | null = null;

function randomSeed(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(16)}${values[1].toString(16)}`;
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function stableClientSeed(): string {
  if (fallbackSeed) return fallbackSeed;
  try {
    const stored = globalThis.localStorage?.getItem(SAMPLE_SEED_STORAGE_KEY);
    if (stored) {
      fallbackSeed = stored;
      return stored;
    }
    fallbackSeed = randomSeed();
    globalThis.localStorage?.setItem(SAMPLE_SEED_STORAGE_KEY, fallbackSeed);
    return fallbackSeed;
  } catch {
    fallbackSeed = randomSeed();
    return fallbackSeed;
  }
}

function normalizeRelease(release: string | undefined): string {
  return release && RELEASE_PATTERN.test(release) ? release : '0.0.0';
}

function normalizeDuration(duration: number): number {
  if (!Number.isFinite(duration)) return 0;
  return Math.min(120_000, Math.max(0, Math.round(duration)));
}

function defaultSender(metric: RealtimeTelemetryMetric): Promise<unknown> {
  metricCallable ??= getCallable<RealtimeTelemetryMetric, unknown>('reportRealtimeSloMetric');
  return metricCallable(metric);
}

export function normalizeRealtimeSampleRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.min(MAX_REALTIME_SAMPLE_RATE, Math.max(0, rate));
}

export function realtimeSampleFraction(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function shouldSampleRealtimeTelemetry(seed: string, rate: number): boolean {
  return realtimeSampleFraction(seed) < normalizeRealtimeSampleRate(rate);
}

export function createRealtimeTelemetry(options: RealtimeTelemetryOptions = {}) {
  const now = options.now ?? (() => performance.now());
  const release = normalizeRelease(options.release ?? import.meta.env.VITE_APP_VERSION);
  const sampleRate = normalizeRealtimeSampleRate(
    options.sampleRate ?? (import.meta.env.PROD ? MAX_REALTIME_SAMPLE_RATE : 0),
  );
  const sampled = shouldSampleRealtimeTelemetry(
    options.seed ?? stableClientSeed(),
    sampleRate,
  );
  const send = options.send ?? defaultSender;

  const submit = (
    flow: RealtimeTelemetryFlow,
    phase: RealtimeTelemetryPhase,
    duration: number,
  ) => {
    if (!sampled) return;
    const metric: RealtimeTelemetryMetric = {
      platform: 'web',
      flow,
      phase,
      duration: normalizeDuration(duration),
      release,
    };
    try {
      void Promise.resolve(send(metric)).catch(() => undefined);
    } catch {
      // Telemetria nunca deve alterar o fluxo do produto.
    }
  };

  return {
    sampled,
    record(
      flow: RealtimeTelemetryFlow,
      phase: RealtimeTelemetryPhase,
      duration = 0,
    ) {
      submit(flow, phase, duration);
    },
    start(
      flow: RealtimeTelemetryFlow,
      phase: Exclude<RealtimeTelemetryPhase, 'error'>,
    ): RealtimeMeasurement {
      const startedAt = now();
      let pending = true;
      const complete = (resultPhase: RealtimeTelemetryPhase) => {
        if (!pending) return;
        pending = false;
        submit(flow, resultPhase, now() - startedAt);
      };
      return {
        finish: () => complete(phase),
        error: () => complete('error'),
        cancel: () => {
          pending = false;
        },
      };
    },
  };
}

export const realtimeTelemetry = createRealtimeTelemetry();
