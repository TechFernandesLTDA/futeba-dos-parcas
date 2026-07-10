import {createHash, randomUUID} from "node:crypto";
import {FieldValue} from "firebase-admin/firestore";
import {logger} from "firebase-functions/v2";
import {
  CallableRequest,
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {db} from "../_db";
import {FUNCTION_REGION} from "../constants";
import {checkRateLimit} from "../middleware/rate-limiter";

export const REALTIME_SAMPLE_TTL_HOURS = 72;
export const REALTIME_AGGREGATION_WINDOW_MINUTES = 15;
export const REALTIME_SAMPLE_COLLECTION = "realtime_slo_samples";
export const REALTIME_ROLLUP_COLLECTION = "realtime_slo_rollups";

export const REALTIME_RATE_LIMIT = {
  maxRequests: 120,
  windowMs: 60 * 1000,
  keyPrefix: "realtime_slo",
};

export const REALTIME_SLO_THRESHOLDS = {
  bootstrapP95Ms: 2500,
  applyP95Ms: 300,
  reconnectP95Ms: 5000,
  errorRate: 0.02,
  triggerLagP95Ms: 2000,
  abortedPerWindow: 10,
  resourceExhaustedPerWindow: 5,
} as const;

export const REALTIME_PLATFORMS = ["web", "android", "ios"] as const;
export const REALTIME_FLOWS = [
  "games",
  "group_polls",
  "direct_messages",
  "players",
  "live_events",
  "cashbox",
  "live_game",
  "social_feed",
  "public_games_map",
  "locations_map",
] as const;
export const REALTIME_PHASES = [
  "bootstrap",
  "apply",
  "reconnect",
  "error",
] as const;

export type RealtimePlatform = typeof REALTIME_PLATFORMS[number];
export type RealtimeFlow = typeof REALTIME_FLOWS[number];
export type RealtimePhase = typeof REALTIME_PHASES[number];

export interface RealtimeMetric {
  platform: RealtimePlatform;
  flow: RealtimeFlow;
  phase: RealtimePhase;
  duration: number;
  release: string;
}

export interface RealtimeSampleDocument extends RealtimeMetric {
  recorded_at: FirebaseFirestore.FieldValue;
  expires_at: Date;
}

export interface RealtimeLogSignal {
  flow?: RealtimeFlow;
  release?: string;
  triggerLagMs?: number;
  code?: "ABORTED" | "RESOURCE_EXHAUSTED";
}

export interface PercentileStats {
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface RealtimeSloViolation {
  metric: string;
  actual: number;
  threshold: number;
}

export interface RealtimeFlowRollup extends PercentileStats {
  flow: RealtimeFlow;
  release: string;
  errorCount: number;
  errorRate: number;
  platformCounts: Partial<Record<RealtimePlatform, number>>;
  phases: Partial<Record<RealtimePhase, PercentileStats>>;
  triggerLag: PercentileStats;
  abortedCount: number;
  resourceExhaustedCount: number;
  violations: RealtimeSloViolation[];
}

export interface RealtimeSloRollup {
  groups: RealtimeFlowRollup[];
  globalSignals: {
    triggerLag: PercentileStats;
    abortedCount: number;
    resourceExhaustedCount: number;
  };
}

const ALLOWED_FIELDS = [
  "platform",
  "flow",
  "phase",
  "duration",
  "release",
] as const;
const ALLOWED_FIELD_SET = new Set<string>(ALLOWED_FIELDS);
const PLATFORM_SET = new Set<string>(REALTIME_PLATFORMS);
const FLOW_SET = new Set<string>(REALTIME_FLOWS);
const PHASE_SET = new Set<string>(REALTIME_PHASES);
const RELEASE_PATTERN =
  /^(?:v?\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?|[a-f0-9]{7,12})$/i;
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "futebadosparcas";

/**
 * Valida o contrato sem aceitar cardinalidade livre.
 * @param {unknown} data Payload recebido pela callable.
 * @return {RealtimeMetric} Métrica normalizada.
 */
export function validateRealtimeMetric(data: unknown): RealtimeMetric {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Métrica inválida");
  }

  const payload = data as Record<string, unknown>;
  const unknownFields = Object.keys(payload)
    .filter((field) => !ALLOWED_FIELD_SET.has(field));
  if (unknownFields.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      "A métrica contém campos não permitidos"
    );
  }

  if (typeof payload.platform !== "string" ||
      !PLATFORM_SET.has(payload.platform)) {
    throw new HttpsError("invalid-argument", "Plataforma inválida");
  }
  if (typeof payload.flow !== "string" || !FLOW_SET.has(payload.flow)) {
    throw new HttpsError("invalid-argument", "Fluxo inválido");
  }
  if (typeof payload.phase !== "string" || !PHASE_SET.has(payload.phase)) {
    throw new HttpsError("invalid-argument", "Fase inválida");
  }
  if (!Number.isInteger(payload.duration) ||
      (payload.duration as number) < 0 ||
      (payload.duration as number) > 120_000) {
    throw new HttpsError("invalid-argument", "Duração inválida");
  }
  if (typeof payload.release !== "string" ||
      !RELEASE_PATTERN.test(payload.release)) {
    throw new HttpsError("invalid-argument", "Release inválida");
  }

  return {
    platform: payload.platform as RealtimePlatform,
    flow: payload.flow as RealtimeFlow,
    phase: payload.phase as RealtimePhase,
    duration: payload.duration as number,
    release: payload.release,
  };
}

/**
 * Gera hash unidirecional para o bucket de rate limit.
 * @param {string} uid UID autenticado, nunca persistido na amostra.
 * @return {string} Chave opaca de cardinalidade fixa.
 */
export function hashRealtimeRateLimitKey(uid: string): string {
  return createHash("sha256")
    .update(`realtime-slo:${uid}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Cria ID distribuído sem prefixo temporal.
 * @return {string} ID com entropia no prefixo.
 */
export function createRealtimeSampleId(): string {
  const id = randomUUID().replace(/-/g, "");
  return `${id.slice(0, 2)}_${id.slice(2)}`;
}

/**
 * Monta documento com timestamps operacionais e TTL.
 * @param {RealtimeMetric} metric Métrica validada.
 * @param {Date} now Instante injetável da coleta.
 * @param {FirebaseFirestore.FieldValue} recordedAt Timestamp do servidor.
 * @return {RealtimeSampleDocument} Documento sem identificadores pessoais.
 */
export function buildRealtimeSampleDocument(
  metric: RealtimeMetric,
  now: Date,
  recordedAt: FirebaseFirestore.FieldValue = FieldValue.serverTimestamp()
): RealtimeSampleDocument {
  return {
    ...metric,
    recorded_at: recordedAt,
    expires_at: new Date(
      now.getTime() + REALTIME_SAMPLE_TTL_HOURS * 60 * 60 * 1000
    ),
  };
}

/**
 * Persiste uma amostra em documento exclusivo.
 * @param {RealtimeMetric} metric Métrica validada.
 * @param {Date} now Instante da coleta.
 * @return {Promise<void>} Conclusão da escrita.
 */
async function writeRealtimeSample(
  metric: RealtimeMetric,
  now: Date
): Promise<void> {
  await db()
    .collection(REALTIME_SAMPLE_COLLECTION)
    .doc(createRealtimeSampleId())
    .create(buildRealtimeSampleDocument(metric, now));
}

export interface RealtimeMetricHandlerDeps {
  allowRequest: (rateKey: string) => Promise<boolean>;
  writeSample: (metric: RealtimeMetric, now: Date) => Promise<void>;
  now: () => Date;
}

const DEFAULT_HANDLER_DEPS: RealtimeMetricHandlerDeps = {
  allowRequest: async (rateKey) => {
    const result = await checkRateLimit(rateKey, REALTIME_RATE_LIMIT);
    return result.allowed;
  },
  writeSample: writeRealtimeSample,
  now: () => new Date(),
};

/**
 * Executa autenticação, validação, rate limit e persistência.
 * @param {Pick<CallableRequest<unknown>, "auth"|"app"|"data">} request
 * Requisição callable.
 * @param {RealtimeMetricHandlerDeps} deps Dependências injetáveis.
 * @return {Promise<{accepted: true}>} Confirmação sem ecoar dados.
 */
export async function handleRealtimeMetricRequest(
  request: Pick<CallableRequest<unknown>, "auth" | "app" | "data">,
  deps: RealtimeMetricHandlerDeps = DEFAULT_HANDLER_DEPS
): Promise<{accepted: true}> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticação necessária");
  }
  if (!request.app) {
    throw new HttpsError(
      "failed-precondition",
      "App Check necessário"
    );
  }

  const metric = validateRealtimeMetric(request.data);
  const rateKey = hashRealtimeRateLimitKey(request.auth.uid);
  if (!await deps.allowRequest(rateKey)) {
    throw new HttpsError(
      "resource-exhausted",
      "Limite de telemetria excedido"
    );
  }

  await deps.writeSample(metric, deps.now());
  return {accepted: true};
}

export const reportRealtimeSloMetric = onCall<Record<string, unknown>>(
  {
    region: FUNCTION_REGION,
    enforceAppCheck: true,
    consumeAppCheckToken: false,
    timeoutSeconds: 10,
    memory: "256MiB",
  },
  (request) => handleRealtimeMetricRequest(request)
);

/**
 * Calcula percentil interpolado de valores numéricos.
 * @param {number[]} values Valores não necessariamente ordenados.
 * @param {number} percentile Percentil entre zero e cem.
 * @return {number} Valor arredondado no percentil.
 */
export function realtimePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) return sorted[0];
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const fraction = index - lower;
  return Math.round(
    sorted[lower] * (1 - fraction) + sorted[upper] * fraction
  );
}

/**
 * Resume uma série em p50, p95 e p99.
 * @param {number[]} values Durações em milissegundos.
 * @return {PercentileStats} Percentis e quantidade.
 */
function percentileStats(values: number[]): PercentileStats {
  return {
    count: values.length,
    p50Ms: realtimePercentile(values, 50),
    p95Ms: realtimePercentile(values, 95),
    p99Ms: realtimePercentile(values, 99),
  };
}

/**
 * Compara um rollup com thresholds operacionais.
 * @param {object} rollup Rollup do fluxo.
 * @param {object} thresholds Limites injetáveis.
 * @return {RealtimeSloViolation[]} Violações encontradas.
 */
export function evaluateRealtimeSlo(
  rollup: Omit<RealtimeFlowRollup, "violations">,
  thresholds = REALTIME_SLO_THRESHOLDS
): RealtimeSloViolation[] {
  const violations: RealtimeSloViolation[] = [];
  const checks: Array<[string, number, number]> = [
    [
      "bootstrap_p95_ms",
      rollup.phases.bootstrap?.p95Ms ?? 0,
      thresholds.bootstrapP95Ms,
    ],
    [
      "apply_p95_ms",
      rollup.phases.apply?.p95Ms ?? 0,
      thresholds.applyP95Ms,
    ],
    [
      "reconnect_p95_ms",
      rollup.phases.reconnect?.p95Ms ?? 0,
      thresholds.reconnectP95Ms,
    ],
    ["error_rate", rollup.errorRate, thresholds.errorRate],
    [
      "trigger_lag_p95_ms",
      rollup.triggerLag.p95Ms,
      thresholds.triggerLagP95Ms,
    ],
    ["aborted_count", rollup.abortedCount, thresholds.abortedPerWindow],
    [
      "resource_exhausted_count",
      rollup.resourceExhaustedCount,
      thresholds.resourceExhaustedPerWindow,
    ],
  ];

  for (const [metric, actual, threshold] of checks) {
    if (actual > threshold) violations.push({metric, actual, threshold});
  }
  return violations;
}

/**
 * Cria acumuladores vazios para sinais extraídos de logs.
 * @return {object} Acumuladores de lag e códigos.
 */
function emptySignalStats() {
  return {
    triggerLag: [] as number[],
    abortedCount: 0,
    resourceExhaustedCount: 0,
  };
}

/**
 * Agrega amostras por fluxo e release.
 * @param {RealtimeMetric[]} samples Amostras validadas.
 * @param {RealtimeLogSignal[]} signals Sinais sanitizados dos logs.
 * @return {RealtimeSloRollup} Rollup correlacionado.
 */
export function aggregateRealtimeSlo(
  samples: RealtimeMetric[],
  signals: RealtimeLogSignal[] = []
): RealtimeSloRollup {
  const grouped = new Map<string, {
    flow: RealtimeFlow;
    release: string;
    samples: RealtimeMetric[];
    signals: ReturnType<typeof emptySignalStats>;
  }>();

  for (const sample of samples) {
    const key = `${sample.flow}\u0000${sample.release}`;
    const current = grouped.get(key) ?? {
      flow: sample.flow,
      release: sample.release,
      samples: [],
      signals: emptySignalStats(),
    };
    current.samples.push(sample);
    grouped.set(key, current);
  }

  const globalSignalValues = emptySignalStats();
  for (const signal of signals) {
    if (signal.triggerLagMs !== undefined) {
      globalSignalValues.triggerLag.push(signal.triggerLagMs);
    }
    if (signal.code === "ABORTED") globalSignalValues.abortedCount += 1;
    if (signal.code === "RESOURCE_EXHAUSTED") {
      globalSignalValues.resourceExhaustedCount += 1;
    }

    if (!signal.flow) continue;
    for (const group of grouped.values()) {
      if (group.flow !== signal.flow) continue;
      if (signal.release && group.release !== signal.release) continue;
      if (signal.triggerLagMs !== undefined) {
        group.signals.triggerLag.push(signal.triggerLagMs);
      }
      if (signal.code === "ABORTED") group.signals.abortedCount += 1;
      if (signal.code === "RESOURCE_EXHAUSTED") {
        group.signals.resourceExhaustedCount += 1;
      }
    }
  }

  const groups = [...grouped.values()].map((group) => {
    const phases: Partial<Record<RealtimePhase, PercentileStats>> = {};
    for (const phase of REALTIME_PHASES) {
      const durations = group.samples
        .filter((sample) => sample.phase === phase)
        .map((sample) => sample.duration);
      if (durations.length > 0) phases[phase] = percentileStats(durations);
    }
    const durations = group.samples
      .filter((sample) => sample.phase !== "error")
      .map((sample) => sample.duration);
    const errorCount = group.samples
      .filter((sample) => sample.phase === "error").length;
    const platformCounts: Partial<Record<RealtimePlatform, number>> = {};
    for (const sample of group.samples) {
      platformCounts[sample.platform] =
        (platformCounts[sample.platform] ?? 0) + 1;
    }
    const base: Omit<RealtimeFlowRollup, "violations"> = {
      flow: group.flow,
      release: group.release,
      ...percentileStats(durations),
      errorCount,
      errorRate: group.samples.length === 0 ? 0 :
        Number((errorCount / group.samples.length).toFixed(4)),
      platformCounts,
      phases,
      triggerLag: percentileStats(group.signals.triggerLag),
      abortedCount: group.signals.abortedCount,
      resourceExhaustedCount: group.signals.resourceExhaustedCount,
    };
    return {...base, violations: evaluateRealtimeSlo(base)};
  });

  groups.sort((left, right) =>
    `${left.flow}:${left.release}`.localeCompare(
      `${right.flow}:${right.release}`
    )
  );
  return {
    groups,
    globalSignals: {
      triggerLag: percentileStats(globalSignalValues.triggerLag),
      abortedCount: globalSignalValues.abortedCount,
      resourceExhaustedCount: globalSignalValues.resourceExhaustedCount,
    },
  };
}

interface LoggingPayload {
  flow?: unknown;
  release?: unknown;
  trigger_lag_ms?: unknown;
  triggerLagMs?: unknown;
  code?: unknown;
  status?: unknown;
}

/**
 * Extrai apenas campos operacionais allowlisted de um log.
 * @param {LoggingPayload} payload Payload estruturado do Cloud Logging.
 * @param {string} textPayload Texto usado somente para detectar código.
 * @return {RealtimeLogSignal|null} Sinal sanitizado ou null.
 */
export function parseRealtimeLogSignal(
  payload: LoggingPayload,
  textPayload = ""
): RealtimeLogSignal | null {
  const flow = typeof payload.flow === "string" && FLOW_SET.has(payload.flow) ?
    payload.flow as RealtimeFlow : undefined;
  const release = typeof payload.release === "string" &&
    RELEASE_PATTERN.test(payload.release) ? payload.release : undefined;
  const rawLag = payload.trigger_lag_ms ?? payload.triggerLagMs;
  const triggerLagMs = typeof rawLag === "number" &&
    Number.isFinite(rawLag) && rawLag >= 0 ? Math.round(rawLag) : undefined;
  const rawCode = `${payload.code ?? payload.status ?? ""} ${textPayload}`
    .toUpperCase();
  const code = rawCode.includes("RESOURCE_EXHAUSTED") ?
    "RESOURCE_EXHAUSTED" as const :
    rawCode.includes("ABORTED") ? "ABORTED" as const : undefined;
  if (triggerLagMs === undefined && code === undefined) return null;
  return {flow, release, triggerLagMs, code};
}

/**
 * Busca sinais de contenção e lag no Cloud Logging.
 * @param {Date} startTime Início inclusivo da janela.
 * @param {Date} endTime Fim exclusivo da janela.
 * @return {Promise<RealtimeLogSignal[]>} Sinais sem mensagens ou IDs.
 */
export async function fetchRealtimeLogSignals(
  startTime: Date,
  endTime: Date
): Promise<RealtimeLogSignal[]> {
  const {Logging} = await import("@google-cloud/logging");
  const logging = new Logging({projectId: PROJECT_ID});
  const filter = [
    "resource.type=\"cloud_run_revision\"",
    `timestamp >= "${startTime.toISOString()}"`,
    `timestamp < "${endTime.toISOString()}"`,
    "(jsonPayload.trigger_lag_ms:* OR jsonPayload.triggerLagMs:* " +
      "OR textPayload:\"ABORTED\" " +
      "OR textPayload:\"RESOURCE_EXHAUSTED\" " +
      "OR jsonPayload.code=\"ABORTED\" " +
      "OR jsonPayload.code=\"RESOURCE_EXHAUSTED\")",
  ].join("\n");
  const [entries] = await logging.getEntries({
    filter,
    orderBy: "timestamp asc",
    pageSize: 10000,
  });
  return entries.flatMap((entry) => {
    // Cloud Logging metadata has a wider runtime shape than its public type.
    const metadata = entry.metadata as unknown as {
      jsonPayload?: LoggingPayload;
      textPayload?: string;
    };
    const signal = parseRealtimeLogSignal(
      metadata.jsonPayload ?? {},
      metadata.textPayload
    );
    return signal ? [signal] : [];
  });
}

/**
 * Busca e valida as amostras de uma janela.
 * @param {Date} startTime Início inclusivo da janela.
 * @param {Date} endTime Fim exclusivo da janela.
 * @return {Promise<RealtimeMetric[]>} Amostras válidas.
 */
async function fetchRealtimeSamples(
  startTime: Date,
  endTime: Date
): Promise<RealtimeMetric[]> {
  const snapshot = await db()
    .collection(REALTIME_SAMPLE_COLLECTION)
    .where("recorded_at", ">=", startTime)
    .where("recorded_at", "<", endTime)
    .limit(10000)
    .get();
  return snapshot.docs.flatMap((sample) => {
    const raw = sample.data();
    try {
      return [validateRealtimeMetric({
        platform: raw.platform,
        flow: raw.flow,
        phase: raw.phase,
        duration: raw.duration,
        release: raw.release,
      })];
    } catch {
      return [];
    }
  });
}

export interface RealtimeAggregatorDeps {
  now: () => Date;
  fetchSamples: (
    startTime: Date,
    endTime: Date
  ) => Promise<RealtimeMetric[]>;
  fetchSignals: (
    startTime: Date,
    endTime: Date
  ) => Promise<RealtimeLogSignal[]>;
  persist: (
    id: string,
    startTime: Date,
    endTime: Date,
    rollup: RealtimeSloRollup
  ) => Promise<void>;
}

const DEFAULT_AGGREGATOR_DEPS: RealtimeAggregatorDeps = {
  now: () => new Date(),
  fetchSamples: fetchRealtimeSamples,
  fetchSignals: fetchRealtimeLogSignals,
  persist: async (id, startTime, endTime, rollup) => {
    await db().collection(REALTIME_ROLLUP_COLLECTION).doc(id).set({
      window_start: startTime,
      window_end: endTime,
      generated_at: FieldValue.serverTimestamp(),
      thresholds: REALTIME_SLO_THRESHOLDS,
      ...rollup,
    });
  },
};

/**
 * Executa o rollup de uma janela de quinze minutos.
 * @param {RealtimeAggregatorDeps} deps Dependências injetáveis.
 * @return {Promise<RealtimeSloRollup>} Rollup persistido.
 */
export async function runRealtimeSloAggregation(
  deps: RealtimeAggregatorDeps = DEFAULT_AGGREGATOR_DEPS
): Promise<RealtimeSloRollup> {
  const endTime = deps.now();
  const startTime = new Date(
    endTime.getTime() - REALTIME_AGGREGATION_WINDOW_MINUTES * 60 * 1000
  );
  const samples = await deps.fetchSamples(startTime, endTime);
  let signals: RealtimeLogSignal[] = [];
  try {
    signals = await deps.fetchSignals(startTime, endTime);
  } catch (error) {
    logger.warn("[REALTIME_SLO] Cloud Logging indisponível", {error});
  }
  const rollup = aggregateRealtimeSlo(samples, signals);
  const id = startTime.toISOString().replace(/[:.]/g, "-");
  await deps.persist(id, startTime, endTime, rollup);

  for (const group of rollup.groups) {
    const payload = {
      metric_type: "realtime_slo_rollup",
      flow: group.flow,
      release: group.release,
      p50_ms: group.p50Ms,
      p95_ms: group.p95Ms,
      p99_ms: group.p99Ms,
      error_rate: group.errorRate,
      trigger_lag_p95_ms: group.triggerLag.p95Ms,
      aborted_count: group.abortedCount,
      resource_exhausted_count: group.resourceExhaustedCount,
      violations: group.violations.map((violation) => violation.metric),
    };
    if (group.violations.length > 0) {
      logger.warn("[REALTIME_SLO] SLO violado", payload);
    } else {
      logger.info("[REALTIME_SLO] Rollup", payload);
    }
  }
  return rollup;
}

export const aggregateRealtimeSloMetrics = onSchedule(
  {
    schedule: "*/15 * * * *",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    await runRealtimeSloAggregation();
  }
);
