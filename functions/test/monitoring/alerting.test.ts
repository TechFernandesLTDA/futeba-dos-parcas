/**
 * TESTES DO SISTEMA DE ALERTAS (monitoring/alerting.ts)
 *
 * Foco: CHECK 8 — consumidor dos sinais de saturação do janitor de mural
 * (backlog_possible / cleanup_failures / oldest_expired_age_ms), adicionado na
 * issue #3969. Antes destes sinais eram gravados pelo janitor mas nunca lidos.
 */

jest.mock("../../src/middleware/rate-limiter");

// Snapshot de alertas gravados em memória para asserção.
const addedMetrics: Array<Record<string, unknown>> = [];
const addedAlerts: Array<Record<string, unknown>> = [];

interface QuerySpec {
  collection: string;
  wheres: Array<{field: string; operator: string; value: unknown}>;
  orderBy?: {field: string; direction: string};
  limit?: number;
}

// Respostas programáveis por collection para `.get()` (queries de docs).
const queryDocsByCollection: Record<
  string,
  () => { empty: boolean; size: number; docs: Array<{id: string; data: () => Record<string, unknown>}>}
> = {};

// Contadores programáveis por collection para `.count().get()`.
const countByCollection: Record<string, number> = {};

const buildQuery = (spec: QuerySpec) => {
  const builder: any = {
    where: (field: string, operator: string, value: unknown) => {
      spec.wheres.push({field, operator, value});
      return builder;
    },
    orderBy: (field: string, direction: string) => {
      spec.orderBy = {field, direction};
      return builder;
    },
    limit: (value: number) => {
      spec.limit = value;
      return builder;
    },
    count: () => ({
      get: async () => ({
        data: () => ({count: countByCollection[spec.collection] ?? 0}),
      }),
    }),
    get: async () => {
      const fn = queryDocsByCollection[spec.collection];
      return fn ? fn() : {empty: true, size: 0, docs: []};
    },
  };
  return builder;
};

const firestoreInstance = {
  collection: (name: string) => {
    const spec: QuerySpec = {collection: name, wheres: []};
    const base = buildQuery(spec);
    base.doc = () => ({id: "alert-doc"});
    base.add = async (data: Record<string, unknown>) => {
      addedMetrics.push({__collection: name, ...data});
      return {id: `metric-${addedMetrics.length}`};
    };
    return base;
  },
  batch: () => ({
    set: (_ref: unknown, data: Record<string, unknown>) => {
      addedAlerts.push(data);
    },
    update: jest.fn(),
    commit: async () => [],
  }),
};
(firestoreInstance as any).FieldValue = {
  serverTimestamp: () => ({_type: "ServerTimestamp"}),
  delete: () => ({_type: "FieldDelete"}),
};
(firestoreInstance as any).Timestamp = {
  now: () => ({toDate: () => new Date(), toMillis: () => Date.now()}),
  fromDate: (d: Date) => ({toDate: () => d, toMillis: () => d.getTime()}),
  fromMillis: (ms: number) => ({toDate: () => new Date(ms), toMillis: () => ms}),
};

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: () => firestoreInstance,
}));

jest.mock("firebase-functions/v2", () => ({
  setGlobalOptions: jest.fn(),
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
  scheduler: {onSchedule: jest.fn((_c: unknown, h: unknown) => h)},
  https: {onCall: jest.fn((_c: unknown, h: unknown) => h), HttpsError: jest.fn()},
}));

import {systemHealthCheck} from "../../src/monitoring/alerting";

const resetState = () => {
  addedMetrics.length = 0;
  addedAlerts.length = 0;
  for (const k of Object.keys(queryDocsByCollection)) delete queryDocsByCollection[k];
  for (const k of Object.keys(countByCollection)) delete countByCollection[k];
};

describe("monitoring/alerting — systemHealthCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetState();
  });

  it("#3969: gera alerta quando janitor de mural reporta backlog_possible", async () => {
    // A métrica mais recente do janitor indica saturação (backlog não drenado).
    queryDocsByCollection.metrics = () => ({
      empty: false,
      size: 1,
      docs: [{
        id: "metric-1",
        data: () => ({
          type: "group_wall_media_pipeline",
          event: "DRAFT_EXPIRED",
          backlog_possible: true,
          cleanup_failures: 0,
          oldest_expired_age_ms: 5_000,
          scanned: 200,
          orphan_count: 150,
        }),
      }],
    });

    await systemHealthCheck();

    expect(addedAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "WALL_MEDIA_JANITOR_BACKLOG",
          severity: "WARNING",
        }),
      ]),
    );
    // Status do check reflete WARNING
    expect(addedMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "health_check",
          status: "DEGRADED",
          checks: expect.objectContaining({
            wall_media_janitor: expect.objectContaining({status: "WARNING"}),
          }),
        }),
      ]),
    );
  });

  it("#3969: gera alerta quando draft está preso (oldest_expired_age_ms alto)", async () => {
    queryDocsByCollection.metrics = () => ({
      empty: false,
      size: 1,
      docs: [{
        id: "metric-1",
        data: () => ({
          backlog_possible: false,
          cleanup_failures: 0,
          oldest_expired_age_ms: 75 * 60 * 1000, // 75min > threshold 60min
          scanned: 10,
        }),
      }],
    });

    await systemHealthCheck();

    expect(addedAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "WALL_MEDIA_DRAFT_STUCK",
          severity: "WARNING",
        }),
      ]),
    );
  });

  it("#3969: gera alerta quando janitor reporta cleanup_failures", async () => {
    queryDocsByCollection.metrics = () => ({
      empty: false,
      size: 1,
      docs: [{
        id: "metric-1",
        data: () => ({
          backlog_possible: false,
          cleanup_failures: 3, // >= threshold (1)
          oldest_expired_age_ms: 1_000,
          scanned: 50,
        }),
      }],
    });

    await systemHealthCheck();

    expect(addedAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "WALL_MEDIA_CLEANUP_FAILURES",
          metadata: expect.objectContaining({cleanup_failures: 3}),
        }),
      ]),
    );
  });

  it("#3969: NAO gera alerta de mural quando janitor está saudável", async () => {
    queryDocsByCollection.metrics = () => ({
      empty: false,
      size: 1,
      docs: [{
        id: "metric-1",
        data: () => ({
          backlog_possible: false,
          cleanup_failures: 0,
          oldest_expired_age_ms: 5_000, // < threshold
          scanned: 10,
        }),
      }],
    });

    await systemHealthCheck();

    const wallMediaAlerts = addedAlerts.filter((a) =>
      typeof a.type === "string" && a.type.startsWith("WALL_MEDIA_"),
    );
    expect(wallMediaAlerts).toHaveLength(0);
  });

  it("#3969: NAO gera alerta de mural quando não há métrica recente do janitor", async () => {
    // metrics.get() retorna vazio → nenhum alerta de mural.
    await systemHealthCheck();

    const wallMediaAlerts = addedAlerts.filter((a) =>
      typeof a.type === "string" && a.type.startsWith("WALL_MEDIA_"),
    );
    expect(wallMediaAlerts).toHaveLength(0);
  });
});
