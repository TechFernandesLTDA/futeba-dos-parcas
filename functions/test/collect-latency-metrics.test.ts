/**
 * TESTES DE MONITORAMENTO DE LATÊNCIA P95
 *
 * Valida a lógica de collect-latency-metrics.ts:
 * - parseLatencyMs: conversão de string de latência para ms
 * - extractCallableName: extração de nome do callable a partir do serviço Cloud Run
 * - percentile: cálculo de percentis
 * - computeLatencyStats: agrupamento e cálculo de p50/p95/p99 por callable
 * - runCollectCallableLatencyMetrics: orquestração completa com Firestore mock
 *   - Documento de métricas escrito corretamente
 *   - Alerta escrito quando p95 > 2000ms
 *   - Nenhum alerta quando p95 <= 2000ms
 */

jest.mock("../src/middleware/rate-limiter");

// ==========================================
// MOCK FIREBASE-ADMIN
// ==========================================

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockDocFn = jest.fn();
const mockCollectionFn = jest.fn();

jest.mock("firebase-admin", () => {
  const mockFieldValue = {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockAdmin: Record<string, any> = {
    apps: [{name: "test"}],
    firestore: jest.fn(() => ({
      collection: mockCollectionFn,
      batch: jest.fn(() => ({
        set: mockBatchSet,
        commit: mockBatchCommit,
      })),
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = mockFieldValue;
  mockAdmin.firestore.Timestamp = {
    fromDate: jest.fn((date: Date) => ({toDate: () => date})),
    now: jest.fn(() => ({toDate: () => new Date()})),
  };

  return mockAdmin;
});

// ==========================================
// MOCK FIREBASE-FUNCTIONS/V2 SCHEDULER
// ==========================================

jest.mock("firebase-functions/v2", () => ({
  scheduler: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSchedule: jest.fn((_opts: unknown, handler: any) => handler),
  },
}));

// ==========================================
// IMPORTS (após mocks)
// ==========================================

import {
  parseLatencyMs,
  extractCallableName,
  percentile,
  computeLatencyStats,
  runCollectCallableLatencyMetrics,
  LogEntry,
} from "../src/monitoring/collect-latency-metrics";

// ==========================================
// HELPERS DE TESTE
// ==========================================

/**
 * Cria entradas de log sintéticas para um callable com latências informadas.
 *
 * @param serviceName - Nome do serviço Cloud Run
 *   (ex: "southamericaeast1-createGame")
 * @param latenciesMs - Lista de latências em ms
 * @return Lista de LogEntry prontas para teste
 */
function makeLogEntries(
  serviceName: string,
  latenciesMs: number[]
): LogEntry[] {
  return latenciesMs.map((ms) => ({
    resource: {
      labels: {
        service_name: serviceName,
      },
    },
    httpRequest: {
      // Formato "Xs" com 3 casas decimais, igual ao Cloud Logging real
      latency: `${(ms / 1000).toFixed(3)}s`,
    },
  }));
}

// ==========================================
// SETUP FIRESTORE MOCK
// ==========================================

beforeEach(() => {
  jest.clearAllMocks();

  // Configura mockCollectionFn para retornar objeto com doc()
  mockCollectionFn.mockReturnValue({
    doc: mockDocFn,
  });

  // mockDocFn retorna ref simples (batch.set usa a ref)
  mockDocFn.mockReturnValue({id: "mock-doc-id"});

  // Garante que mockBatchCommit resolve
  mockBatchCommit.mockResolvedValue(undefined);
});

// ==========================================
// TESTES UNITÁRIOS DE HELPERS
// ==========================================

describe("parseLatencyMs", () => {
  test("parseia formato em segundos (Xs)", () => {
    expect(parseLatencyMs("1.234s")).toBe(1234);
    expect(parseLatencyMs("0.045s")).toBe(45);
    expect(parseLatencyMs("2s")).toBe(2000);
    expect(parseLatencyMs("0.001s")).toBe(1);
  });

  test("parseia formato em milissegundos (Xms)", () => {
    expect(parseLatencyMs("234ms")).toBe(234);
    expect(parseLatencyMs("45ms")).toBe(45);
    expect(parseLatencyMs("1000ms")).toBe(1000);
  });

  test("retorna null para formatos inválidos", () => {
    expect(parseLatencyMs(undefined)).toBeNull();
    expect(parseLatencyMs("")).toBeNull();
    expect(parseLatencyMs("abc")).toBeNull();
    expect(parseLatencyMs("1.2")).toBeNull();
    expect(parseLatencyMs("1.2 s")).toBeNull();
  });
});

describe("extractCallableName", () => {
  test("extrai callable com prefixo southamericaeast1", () => {
    expect(extractCallableName("southamericaeast1-createGame"))
      .toBe("createGame");
    expect(extractCallableName("southamericaeast1-setUserRole"))
      .toBe("setUserRole");
  });

  test("extrai callable com prefixo uscentral1", () => {
    expect(extractCallableName("uscentral1-createGame")).toBe("createGame");
  });

  test("retorna nome inteiro quando não há prefixo de região reconhecido", () => {
    expect(extractCallableName("createGame")).toBe("createGame");
  });

  test("retorna null para undefined ou string vazia", () => {
    expect(extractCallableName(undefined)).toBeNull();
    expect(extractCallableName("")).toBeNull();
  });
});

describe("percentile", () => {
  test("retorna 0 para array vazio", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([], 95)).toBe(0);
  });

  test("retorna o único valor para array de 1 elemento", () => {
    expect(percentile([500], 95)).toBe(500);
  });

  test("calcula p50 corretamente", () => {
    const sorted = [100, 200, 300, 400, 500];
    expect(percentile(sorted, 50)).toBe(300);
  });

  test("calcula p95 corretamente para 20 elementos", () => {
    // sorted = [100, 200, ..., 2000]
    // idx = 0.95 * 19 = 18.05
    // lower=18 → 1900, upper=19 → 2000, frac=0.05
    // p95 = 1900*0.95 + 2000*0.05 = 1805 + 100 = 1905
    const sorted = Array.from({length: 20}, (_, i) => (i + 1) * 100);
    expect(percentile(sorted, 95)).toBe(1905);
  });

  test("p99 próximo ao máximo", () => {
    const sorted = Array.from({length: 100}, (_, i) => i * 10);
    expect(percentile(sorted, 99)).toBeGreaterThan(900);
  });
});

describe("computeLatencyStats", () => {
  test("retorna objeto vazio para entries sem service_name válido", () => {
    const entries: LogEntry[] = [
      {httpRequest: {latency: "0.1s"}},
      {resource: {labels: {}}, httpRequest: {latency: "0.2s"}},
    ];
    expect(computeLatencyStats(entries)).toEqual({});
  });

  test("agrupa corretamente por callable e computa count", () => {
    const entries = makeLogEntries(
      "southamericaeast1-createGame",
      [100, 200, 300, 400, 500]
    );
    const stats = computeLatencyStats(entries);
    expect(stats["createGame"]).toBeDefined();
    expect(stats["createGame"].count).toBe(5);
  });

  test("computa p50/p95/p99 para 20 entradas por callable", () => {
    // 3 callables × 20 entradas com latências variadas
    const latencies = Array.from({length: 20}, (_, i) => (i + 1) * 50);
    // latencies = [50, 100, 150, ..., 1000]

    const entries = [
      ...makeLogEntries("southamericaeast1-createGame", latencies),
      ...makeLogEntries(
        "southamericaeast1-getStats",
        latencies.map((l) => l * 2)
      ),
      ...makeLogEntries(
        "southamericaeast1-setUserRole",
        latencies.map((l) => l * 4)
      ),
    ];

    const stats = computeLatencyStats(entries);

    expect(Object.keys(stats)).toHaveLength(3);

    // createGame: 20 entradas
    expect(stats["createGame"].count).toBe(20);
    expect(stats["createGame"].p50_ms).toBeGreaterThan(0);
    expect(stats["createGame"].p95_ms).toBeGreaterThan(
      stats["createGame"].p50_ms
    );
    expect(stats["createGame"].p99_ms).toBeGreaterThanOrEqual(
      stats["createGame"].p95_ms
    );

    // getStats: 2x latências → p95 maior que createGame
    expect(stats["getStats"].p95_ms).toBeGreaterThan(
      stats["createGame"].p95_ms
    );

    // setUserRole: 4x latências → p95 maior que getStats
    expect(stats["setUserRole"].p95_ms).toBeGreaterThan(
      stats["getStats"].p95_ms
    );
  });

  test("ignora entradas com latência inválida", () => {
    const entries: LogEntry[] = [
      {
        resource: {labels: {service_name: "southamericaeast1-createGame"}},
        httpRequest: {latency: "invalid"},
      },
      {
        resource: {labels: {service_name: "southamericaeast1-createGame"}},
        httpRequest: {latency: "0.5s"},
      },
    ];
    const stats = computeLatencyStats(entries);
    expect(stats["createGame"].count).toBe(1);
    expect(stats["createGame"].p50_ms).toBe(500);
  });

  test("usa jsonPayload.executionTime como fallback quando httpRequest ausente", () => {
    const entries: LogEntry[] = [
      {
        resource: {labels: {service_name: "southamericaeast1-createGame"}},
        jsonPayload: {executionTime: 750, functionName: "createGame"},
      },
    ];
    const stats = computeLatencyStats(entries);
    expect(stats["createGame"].count).toBe(1);
    expect(stats["createGame"].p50_ms).toBe(750);
  });
});

// ==========================================
// TESTES DE INTEGRAÇÃO (com Firestore mock)
// ==========================================

describe("runCollectCallableLatencyMetrics", () => {
  /**
   * Cria fetchLogsFn sintética com 3 callables × 20 entradas.
   * createGame:    latências [100–2000ms] → p95 = 1905ms (dentro do SLO)
   * getStats:      latências [150–3000ms] → p95 = 2858ms (dentro do SLO depende)
   * slowCallable:  latências [500–10000ms] → p95 acima do SLO
   */
  function makeSyntheticFetch(opts?: {
    includeSlowCallable?: boolean;
  }): FetchLogsFn {
    // 20 entradas: [100, 200, ..., 2000] → p95 = 1905ms (< SLO)
    const baseLatencies = Array.from({length: 20}, (_, i) => (i + 1) * 100);

    const entries: LogEntry[] = [
      ...makeLogEntries("southamericaeast1-createGame", baseLatencies),
      ...makeLogEntries(
        "southamericaeast1-getStats",
        baseLatencies.map((l) => l * 1.0)
      ),
    ];

    if (opts?.includeSlowCallable) {
      // 20 entradas: [250, 500, ..., 5000] → p95 = 4763ms (> SLO de 2000ms)
      const slowLatencies = Array.from(
        {length: 20}, (_, i) => (i + 1) * 250
      );
      entries.push(
        ...makeLogEntries("southamericaeast1-slowCallable", slowLatencies)
      );
    }

    return async () => entries;
  }

  // Alias para conveniência de importação no teste
  type FetchLogsFn = (
    startTime: Date,
    endTime: Date
  ) => Promise<LogEntry[]>;

  test("escreve documento de métricas no Firestore com callables corretos", async () => {
    await runCollectCallableLatencyMetrics(makeSyntheticFetch());

    // Verifica que collection("metrics") foi chamada
    expect(mockCollectionFn).toHaveBeenCalledWith("metrics");

    // doc() foi chamado com ID no formato YYYY-MM-DD_callable_latency
    const metricsDocCall = mockDocFn.mock.calls.find(
      (call: string[]) => call[0] && call[0].includes("_callable_latency")
    );
    expect(metricsDocCall).toBeDefined();
    expect(metricsDocCall[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}_callable_latency$/
    );

    // batch.set foi chamado
    expect(mockBatchSet).toHaveBeenCalled();

    // batch.commit foi chamado uma vez
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);

    // Primeiro batch.set tem o documento de métricas
    const metricsDoc = mockBatchSet.mock.calls[0][1];
    expect(metricsDoc).toMatchObject({
      date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      callables: expect.objectContaining({
        createGame: expect.objectContaining({
          count: 20,
          p50_ms: expect.any(Number),
          p95_ms: expect.any(Number),
          p99_ms: expect.any(Number),
        }),
        getStats: expect.objectContaining({
          count: 20,
        }),
      }),
    });
  });

  test("não escreve alerta quando todos os callables estão dentro do SLO", async () => {
    await runCollectCallableLatencyMetrics(makeSyntheticFetch());

    // Sem callable com p95 > 2000ms: collection("error_logs") não chamada
    const errorLogsCall = mockCollectionFn.mock.calls.find(
      (call: string[]) => call[0] === "error_logs"
    );
    expect(errorLogsCall).toBeUndefined();
  });

  test("escreve alerta quando callable tem p95 > 2000ms", async () => {
    await runCollectCallableLatencyMetrics(
      makeSyntheticFetch({includeSlowCallable: true})
    );

    // collection("error_logs") deve ter sido chamada
    const errorLogsCall = mockCollectionFn.mock.calls.find(
      (call: string[]) => call[0] === "error_logs"
    );
    expect(errorLogsCall).toBeDefined();

    // doc() chamado com ID no formato p95_alert_{date}_slowCallable
    const alertDocCall = mockDocFn.mock.calls.find(
      (call: string[]) =>
        call[0] && call[0].startsWith("p95_alert_")
    );
    expect(alertDocCall).toBeDefined();
    expect(alertDocCall[0]).toMatch(
      /^p95_alert_\d{4}-\d{2}-\d{2}_slowCallable$/
    );

    // batch.set inclui doc de alerta com severidade "high"
    const alertSetCall = mockBatchSet.mock.calls.find(
      (call: unknown[]) => {
        const doc = call[1] as Record<string, unknown>;
        return doc && doc.severity === "high";
      }
    );
    expect(alertSetCall).toBeDefined();

    const alertDoc = alertSetCall![1] as Record<string, unknown>;
    expect(alertDoc).toMatchObject({
      severity: "high",
      message: "p95 above SLO",
      callable: "slowCallable",
      threshold: 2000,
    });
    expect(typeof alertDoc.p95).toBe("number");
    expect(alertDoc.p95 as number).toBeGreaterThan(2000);
  });

  test("não falha quando fetchLogsFn retorna lista vazia", async () => {
    const emptyFetch: FetchLogsFn = async () => [];

    await expect(
      runCollectCallableLatencyMetrics(emptyFetch)
    ).resolves.not.toThrow();

    // Doc de métricas ainda é escrito (com callables vazio)
    const metricsDoc = mockBatchSet.mock.calls[0]?.[1];
    expect(metricsDoc?.callables).toEqual({});
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  test("não falha quando fetchLogsFn lança erro", async () => {
    const failingFetch: FetchLogsFn = async () => {
      throw new Error("Cloud Logging indisponível");
    };

    await expect(
      runCollectCallableLatencyMetrics(failingFetch)
    ).resolves.not.toThrow();

    // Doc de métricas ainda é escrito (com callables vazio)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    const metricsDoc = mockBatchSet.mock.calls[0]?.[1];
    expect(metricsDoc?.callables).toEqual({});
  });
});
