/**
 * MONITORAMENTO DE LATÊNCIA P95 DE CALLABLES
 *
 * Coleta métricas de latência de Cloud Functions v2 callables via Cloud
 * Logging e persiste percentis (p50, p95, p99) no Firestore. Emite alerta
 * quando qualquer callable ultrapassa o SLO de 2000ms no p95.
 *
 * COMO FUNCIONA:
 * 1. Cloud Functions v2 callables rodam em Cloud Run — os logs de execução
 *    aparecem no recurso "cloud_run_revision" com campo httpRequest.latency.
 * 2. Filtramos pelo label "goog-firebase-functions" e prefixo de serviço
 *    de região para isolar as nossas callables.
 * 3. Computamos p50/p95/p99 sobre os tempos de execução em ms.
 * 4. Resultado vai para `metrics/{YYYY-MM-DD}_callable_latency`.
 * 5. Se p95 > 2000ms → alerta em `error_logs/p95_alert_{date}_{name}`.
 *
 * NOTA: Integração com `alerting.ts` createAlert não utilizada aqui
 * intencionalmente — alertas de latência são point-in-time e não requerem
 * o lifecycle de acknowledged/resolved da coleção `alerts`.
 *
 * @see functions/src/monitoring/alerting.ts
 * @see functions/src/monitoring/collect-metrics.ts
 * @see specs/2026-05-12_TESTING_AUDIT_ISSUES.md (Issue 7)
 */

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {db} from "../_db";

// ==========================================
// CONSTANTES
// ==========================================

/** SLO de p95 em ms. Callables acima disso disparam alerta. */
const P95_SLO_MS = 2000;

/** Projeto GCP — lido em runtime via variável de ambiente do Functions. */
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  "futebadosparcas";

// ==========================================
// INTERFACES
// ==========================================

/** Métricas de latência por callable. */
export interface CallableLatencyStats {
  count: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
}

/** Documento Firestore de métricas diárias. */
export interface CallableLatencyDoc {
  date: string;
  generated_at: FirebaseFirestore.FieldValue;
  callables: Record<string, CallableLatencyStats>;
}

/** Entrada de log retornada pelo Cloud Logging. */
export interface LogEntry {
  /** Nome do serviço Cloud Run (usado como nome do callable). */
  resource?: {
    labels?: {
      service_name?: string;
    };
  };
  /** Latência HTTP da requisição (formato "1.234s" ou "123ms"). */
  httpRequest?: {
    latency?: string;
  };
  /** JSON payload alternativo (CF v1 compat / fallback). */
  jsonPayload?: {
    executionTime?: number;
    functionName?: string;
  };
}

/** Tipo de função injetável para buscar logs (facilita testes). */
export type FetchLogsFn = (
  startTime: Date,
  endTime: Date
) => Promise<LogEntry[]>;

// ==========================================
// HELPERS PUROS (exportados para teste)
// ==========================================

/**
 * Parseia string de latência do Cloud Logging para milissegundos.
 *
 * Formatos aceitos:
 *  - "1.234s"  → 1234 ms
 *  - "234ms"   → 234 ms
 *  - "0.045s"  → 45 ms
 *
 * @param {string|undefined} raw - String de latência bruta.
 * @return {number|null} Latência em ms, ou null se não parseável.
 */
export function parseLatencyMs(raw: string | undefined): number | null {
  if (!raw) return null;

  // Formato "Xs" — segundos (com ou sem decimais)
  const secMatch = raw.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (secMatch) {
    return Math.round(parseFloat(secMatch[1]) * 1000);
  }

  // Formato "Xms" — milissegundos inteiros ou decimais
  const msMatch = raw.match(/^([0-9]+(?:\.[0-9]+)?)ms$/);
  if (msMatch) {
    return Math.round(parseFloat(msMatch[1]));
  }

  return null;
}

/**
 * Extrai nome do callable a partir do nome do serviço Cloud Run.
 *
 * Cloud Functions v2 callables são deployadas como serviços Cloud Run com
 * nome no formato "<region>-<callable-name>"
 * (ex: "southamericaeast1-createGame").
 *
 * @param {string|undefined} serviceName - Nome do serviço Cloud Run.
 * @return {string|null} Nome do callable ou null se inválido.
 */
export function extractCallableName(
  serviceName: string | undefined
): string | null {
  if (!serviceName) return null;

  // Remove prefixo de região (southamericaeast1-, uscentral1-, etc.)
  const match = serviceName.match(
    /^(?:southamericaeast1|uscentral1|us[a-z0-9]+[0-9]-[a-z0-9]+)-(.+)$/
  );
  if (match) return match[1];

  // Sem prefixo de região reconhecido — usa o nome inteiro
  return serviceName;
}

/**
 * Calcula percentil de uma lista de valores numéricos já ordenados.
 *
 * @param {number[]} sorted - Array de números ordenados crescentemente.
 * @param {number} p - Percentil (0–100).
 * @return {number} Valor no percentil p (interpolado linearmente).
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  const frac = idx - lower;

  return Math.round(
    sorted[lower] * (1 - frac) + sorted[upper] * frac
  );
}

/**
 * Agrupa latências por callable e computa p50/p95/p99.
 *
 * @param {LogEntry[]} entries - Entradas de log do Cloud Logging.
 * @return {Record<string, CallableLatencyStats>} Mapa de callable → stats.
 */
export function computeLatencyStats(
  entries: LogEntry[]
): Record<string, CallableLatencyStats> {
  // Agrupa latências por callable
  const latenciesByCallable: Record<string, number[]> = {};

  for (const entry of entries) {
    const serviceName = entry.resource?.labels?.service_name;
    const callableName = extractCallableName(serviceName);
    if (!callableName) continue;

    let latencyMs: number | null = null;

    // Tenta httpRequest.latency primeiro (Cloud Run / CF v2)
    if (entry.httpRequest?.latency) {
      latencyMs = parseLatencyMs(entry.httpRequest.latency);
    }

    // Fallback: jsonPayload.executionTime (CF v1 compat)
    if (latencyMs === null && entry.jsonPayload?.executionTime != null) {
      latencyMs = entry.jsonPayload.executionTime;
    }

    if (latencyMs === null || latencyMs < 0) continue;

    if (!latenciesByCallable[callableName]) {
      latenciesByCallable[callableName] = [];
    }
    latenciesByCallable[callableName].push(latencyMs);
  }

  // Computa percentis por callable
  const result: Record<string, CallableLatencyStats> = {};

  for (const [name, latencies] of Object.entries(latenciesByCallable)) {
    if (latencies.length === 0) continue;

    const sorted = [...latencies].sort((a, b) => a - b);

    result[name] = {
      count: sorted.length,
      p50_ms: percentile(sorted, 50),
      p95_ms: percentile(sorted, 95),
      p99_ms: percentile(sorted, 99),
    };
  }

  return result;
}

// ==========================================
// FETCH DE LOGS VIA CLOUD LOGGING
// ==========================================

/**
 * Busca entradas de log de execução de callables via Cloud Logging.
 *
 * Filtra por:
 * - resource.type = "cloud_run_revision" (CF v2 callables em Cloud Run)
 * - label goog-firebase-functions (garante CF, não outro serviço)
 * - httpRequest preenchido (indica request HTTP real, não log interno)
 *
 * @param {Date} startTime - Início do intervalo.
 * @param {Date} endTime - Fim do intervalo.
 * @return {Promise<LogEntry[]>} Lista de entradas de log parseadas.
 */
export async function fetchCallableLogs(
  startTime: Date,
  endTime: Date
): Promise<LogEntry[]> {
  const {Logging} = await import("@google-cloud/logging");
  const loggingClient = new Logging({projectId: PROJECT_ID});

  const startIso = startTime.toISOString();
  const endIso = endTime.toISOString();
  const filter = [
    "resource.type=\"cloud_run_revision\"",
    "labels.\"goog-firebase-functions\"=\"true\"",
    "httpRequest.latency!=\"\"",
    `timestamp >= "${startIso}"`,
    `timestamp <= "${endIso}"`,
  ].join("\n");

  const [entries] = await loggingClient.getEntries({
    filter,
    orderBy: "timestamp asc",
    pageSize: 10000,
  });

  // Mapeia para a interface interna
  return entries.map((entry) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = entry.metadata as any;
    return {
      resource: metadata.resource,
      httpRequest: metadata.httpRequest,
      jsonPayload: metadata.jsonPayload,
    } as LogEntry;
  });
}

// ==========================================
// ORQUESTRADOR PRINCIPAL (testável via DI)
// ==========================================

/**
 * Coleta e persiste métricas de latência dos callables das últimas 24h.
 *
 * @param {FetchLogsFn} fetchLogsFn - Função de busca de logs
 *   (injetável para testes). Se não fornecido, usa `fetchCallableLogs`.
 * @return {Promise<void>}
 */
export async function runCollectCallableLatencyMetrics(
  fetchLogsFn: FetchLogsFn = fetchCallableLogs
): Promise<void> {
  console.log(
    "[LATENCY_METRICS] Iniciando coleta de métricas de latência"
  );

  const now = new Date();
  // Referência = ontem: garante dados completos do dia
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const endOfYesterday = new Date(yesterday);
  endOfYesterday.setHours(23, 59, 59, 999);

  // Formato YYYY-MM-DD para o documento Firestore
  const dateStr = yesterday.toISOString().slice(0, 10);

  const startIsoLog = yesterday.toISOString();
  const endIsoLog = endOfYesterday.toISOString();
  console.log(
    "[LATENCY_METRICS] Coletando logs de " +
    `${startIsoLog} até ${endIsoLog}`
  );

  let entries: LogEntry[] = [];

  try {
    entries = await fetchLogsFn(yesterday, endOfYesterday);
    console.log(
      `[LATENCY_METRICS] ${entries.length} entradas de log encontradas`
    );
  } catch (err) {
    // Não aborta — escreve doc com callables vazio para indicar tentativa
    console.error(
      "[LATENCY_METRICS] Falha ao buscar logs do Cloud Logging:", err
    );
  }

  const callables = computeLatencyStats(entries);
  const callableCount = Object.keys(callables).length;

  console.log(
    `[LATENCY_METRICS] Métricas computadas para ${callableCount} callables`
  );

  const firestoreDb = db();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const batch = firestoreDb.batch();

  // Documento de resumo diário
  const metricsDocRef = firestoreDb
    .collection("metrics")
    .doc(`${dateStr}_callable_latency`);

  const metricsDoc: CallableLatencyDoc = {
    date: dateStr,
    generated_at: timestamp,
    callables,
  };

  batch.set(metricsDocRef, metricsDoc);

  // Alertas para callables que violam o SLO de p95
  const alertingCallables: string[] = [];

  for (const [name, stats] of Object.entries(callables)) {
    if (stats.p95_ms > P95_SLO_MS) {
      alertingCallables.push(name);

      const alertDocRef = firestoreDb
        .collection("error_logs")
        .doc(`p95_alert_${dateStr}_${name}`);

      batch.set(alertDocRef, {
        severity: "high",
        message: "p95 above SLO",
        callable: name,
        p95: stats.p95_ms,
        threshold: P95_SLO_MS,
        date: dateStr,
        created_at: timestamp,
      });

      console.warn(
        `[LATENCY_METRICS] ALERTA: callable "${name}" ` +
        `p95=${stats.p95_ms}ms ultrapassa SLO de ${P95_SLO_MS}ms`
      );
    }
  }

  await batch.commit();

  const alertSummary = alertingCallables.length > 0 ?
    alertingCallables.join(", ") :
    "nenhum";

  console.log(
    `[LATENCY_METRICS] Doc ${dateStr}_callable_latency salvo. ` +
    `Alertas: ${alertingCallables.length} (${alertSummary})`
  );
}

// ==========================================
// SCHEDULED FUNCTION (exportada via index.ts)
// ==========================================

/**
 * Função agendada: coleta métricas de latência dos callables diariamente.
 *
 * Trigger: diariamente à 01:00 BRT (dados do dia anterior completos).
 * Região: southamerica-east1 (padrão do projeto).
 */
export const collectCallableLatencyMetrics =
  functions.scheduler.onSchedule({
    schedule: "0 1 * * *", // Todos os dias à 01:00 BRT
    timeZone: "America/Sao_Paulo",
    region: "southamerica-east1",
    memory: "512MiB",
    timeoutSeconds: 540,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  }, async (_event) => {
    await runCollectCallableLatencyMetrics();
  });
