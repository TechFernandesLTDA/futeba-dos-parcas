import {HttpsError} from "firebase-functions/v2/https";

jest.mock("../src/_db", () => ({
  db: jest.fn(),
}));
jest.mock("firebase-functions/v2/https", () => {
  const actual = jest.requireActual("firebase-functions/v2/https");
  return {
    ...actual,
    onCall: jest.fn((_options, handler) => handler),
  };
});
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_options, handler) => handler),
}));
jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
}));

import {
  REALTIME_SAMPLE_TTL_HOURS,
  REALTIME_SLO_THRESHOLDS,
  aggregateRealtimeSlo,
  buildRealtimeSampleDocument,
  createRealtimeSampleId,
  handleRealtimeMetricRequest,
  hashRealtimeRateLimitKey,
  parseRealtimeLogSignal,
  realtimePercentile,
  runRealtimeSloAggregation,
  validateRealtimeMetric,
  type RealtimeMetric,
} from "../src/monitoring/realtime-slo";

const validMetric: RealtimeMetric = {
  platform: "web",
  flow: "games",
  phase: "bootstrap",
  duration: 125,
  release: "1.51.35",
};

function expectHttpsCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("A validação deveria falhar");
  } catch (error) {
    expect(error).toBeInstanceOf(HttpsError);
    expect((error as HttpsError).code).toBe(code);
  }
}

describe("realtime SLO metric contract", () => {
  test("aceita somente o schema e enums allowlisted", () => {
    expect(validateRealtimeMetric(validMetric)).toEqual(validMetric);
    expect(validateRealtimeMetric({
      ...validMetric,
      platform: "android",
      flow: "public_games_map",
      phase: "reconnect",
      release: "v2.4.0-beta.1",
    })).toMatchObject({
      platform: "android",
      flow: "public_games_map",
    });
  });

  test.each(["uid", "userId", "name", "path", "message", "email"])(
    "rejeita campo desconhecido/PII %s",
    (field) => {
      expectHttpsCode(
        () => validateRealtimeMetric({...validMetric, [field]: "secret"}),
        "invalid-argument"
      );
    }
  );

  test("rejeita release de alta cardinalidade e duração fora do limite", () => {
    expectHttpsCode(
      () => validateRealtimeMetric({...validMetric, release: "ana@email.com"}),
      "invalid-argument"
    );
    expectHttpsCode(
      () => validateRealtimeMetric({...validMetric, duration: 120_001}),
      "invalid-argument"
    );
  });

  test("exige autenticação, App Check e rate limit", async () => {
    const deps = {
      allowRequest: jest.fn().mockResolvedValue(true),
      writeSample: jest.fn().mockResolvedValue(undefined),
      now: () => new Date("2026-07-10T12:00:00Z"),
    };
    await expect(handleRealtimeMetricRequest({
      auth: undefined,
      app: {} as never,
      data: validMetric,
    }, deps)).rejects.toMatchObject({code: "unauthenticated"});
    await expect(handleRealtimeMetricRequest({
      auth: {uid: "uid-1"} as never,
      app: undefined,
      data: validMetric,
    }, deps)).rejects.toMatchObject({code: "failed-precondition"});

    deps.allowRequest.mockResolvedValueOnce(false);
    await expect(handleRealtimeMetricRequest({
      auth: {uid: "uid-1"} as never,
      app: {} as never,
      data: validMetric,
    }, deps)).rejects.toMatchObject({code: "resource-exhausted"});
    expect(deps.writeSample).not.toHaveBeenCalled();
  });

  test("persiste somente a métrica, usando hash não reversível no rate limit", async () => {
    const deps = {
      allowRequest: jest.fn().mockResolvedValue(true),
      writeSample: jest.fn().mockResolvedValue(undefined),
      now: () => new Date("2026-07-10T12:00:00Z"),
    };
    await expect(handleRealtimeMetricRequest({
      auth: {uid: "private-uid"} as never,
      app: {} as never,
      data: validMetric,
    }, deps)).resolves.toEqual({accepted: true});
    const rateKey = deps.allowRequest.mock.calls[0][0] as string;
    expect(rateKey).not.toContain("private-uid");
    expect(rateKey).toBe(hashRealtimeRateLimitKey("private-uid"));
    expect(deps.writeSample).toHaveBeenCalledWith(
      validMetric,
      new Date("2026-07-10T12:00:00Z")
    );
  });
});

describe("realtime SLO storage and aggregation", () => {
  test("gera IDs distribuídos e TTL de 72 horas", () => {
    const ids = Array.from({length: 1000}, () => createRealtimeSampleId());
    expect(new Set(ids).size).toBe(1000);
    expect(new Set(ids.map((id) => id.slice(0, 2))).size).toBeGreaterThan(32);

    const recordedAt = {} as FirebaseFirestore.FieldValue;
    const now = new Date("2026-07-10T12:00:00Z");
    const document = buildRealtimeSampleDocument(
      validMetric,
      now,
      recordedAt
    );
    expect(document.recorded_at).toBe(recordedAt);
    expect(document.expires_at.getTime() - now.getTime()).toBe(
      REALTIME_SAMPLE_TTL_HOURS * 60 * 60 * 1000
    );
    expect(Object.keys(document).sort()).toEqual([
      "duration",
      "expires_at",
      "flow",
      "phase",
      "platform",
      "recorded_at",
      "release",
    ]);
  });

  test("calcula percentis, erro e sinais correlacionados por release", () => {
    expect(realtimePercentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(realtimePercentile([10, 20, 30, 40, 50], 95)).toBe(48);
    expect(realtimePercentile([10, 20, 30, 40, 50], 99)).toBe(50);

    const samples: RealtimeMetric[] = [10, 20, 30, 40, 50].map(
      (duration) => ({...validMetric, phase: "apply", duration})
    );
    samples.push({...validMetric, phase: "error", duration: 75});
    const rollup = aggregateRealtimeSlo(samples, [
      {
        flow: "games",
        release: "1.51.35",
        triggerLagMs: 900,
        code: "ABORTED",
      },
      {flow: "games", triggerLagMs: 1100, code: "RESOURCE_EXHAUSTED"},
    ]);
    expect(rollup.groups).toHaveLength(1);
    expect(rollup.groups[0]).toMatchObject({
      flow: "games",
      release: "1.51.35",
      count: 5,
      p50Ms: 30,
      p95Ms: 48,
      p99Ms: 50,
      errorCount: 1,
      errorRate: 0.1667,
      abortedCount: 1,
      resourceExhaustedCount: 1,
    });
    expect(rollup.groups[0].triggerLag).toMatchObject({
      count: 2,
      p50Ms: 1000,
      p95Ms: 1090,
    });
  });

  test("thresholds exportados produzem violações testáveis", () => {
    const samples: RealtimeMetric[] = [
      {...validMetric, phase: "bootstrap", duration: 3000},
      {...validMetric, phase: "apply", duration: 400},
      {...validMetric, phase: "reconnect", duration: 6000},
      {...validMetric, phase: "error", duration: 1},
    ];
    const signals = Array.from({length: 11}, () => ({
      flow: "games" as const,
      triggerLagMs: 2500,
      code: "ABORTED" as const,
    }));
    const group = aggregateRealtimeSlo(samples, signals).groups[0];
    expect(group.violations.map((item) => item.metric)).toEqual(
      expect.arrayContaining([
        "bootstrap_p95_ms",
        "apply_p95_ms",
        "reconnect_p95_ms",
        "error_rate",
        "trigger_lag_p95_ms",
        "aborted_count",
      ])
    );
    expect(REALTIME_SLO_THRESHOLDS.errorRate).toBe(0.02);
  });

  test("extrai somente lag e códigos operacionais dos logs", () => {
    expect(parseRealtimeLogSignal({
      flow: "games",
      release: "1.51.35",
      trigger_lag_ms: 321.4,
      code: "ABORTED",
    }, "mensagem que não deve ser persistida")).toEqual({
      flow: "games",
      release: "1.51.35",
      triggerLagMs: 321,
      code: "ABORTED",
    });
    expect(parseRealtimeLogSignal({}, "RESOURCE_EXHAUSTED details"))
      .toEqual({
        flow: undefined,
        release: undefined,
        triggerLagMs: undefined,
        code: "RESOURCE_EXHAUSTED",
      });
    expect(parseRealtimeLogSignal({}, "unrelated")).toBeNull();
  });

  test("orquestrador usa janela de 15 minutos e rollup imutável", async () => {
    const persist = jest.fn().mockResolvedValue(undefined);
    const result = await runRealtimeSloAggregation({
      now: () => new Date("2026-07-10T12:15:00Z"),
      fetchSamples: jest.fn().mockResolvedValue([validMetric]),
      fetchSignals: jest.fn().mockResolvedValue([]),
      persist,
    });
    expect(result.groups).toHaveLength(1);
    expect(persist).toHaveBeenCalledWith(
      "2026-07-10T12-00-00-000Z",
      new Date("2026-07-10T12:00:00Z"),
      new Date("2026-07-10T12:15:00Z"),
      result
    );
  });
});
