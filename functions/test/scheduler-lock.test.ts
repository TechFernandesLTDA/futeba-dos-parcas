const mockLockRef = {path: "system_locks/job"};
const mockTxGet = jest.fn();
const mockTxSet = jest.fn();
const mockRunTransaction = jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
  get: mockTxGet,
  set: mockTxSet,
}));
const mockDb = {
  collection: jest.fn(() => ({doc: jest.fn(() => mockLockRef)})),
  runTransaction: mockRunTransaction,
};
const mockWarn = jest.fn();
const mockError = jest.fn();
const mockServerTimestamp = {_type: "server-timestamp"};

jest.mock("../src/_db", () => ({db: jest.fn(() => mockDb)}));
jest.mock("firebase-functions/v2", () => ({logger: {warn: mockWarn, error: mockError}}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: jest.fn(() => mockServerTimestamp)},
}));

const {
  acquireSchedulerLock,
  releaseSchedulerLock,
  heartbeatSchedulerLock,
  startSchedulerHeartbeat,
  schedulerLockTtlForTimeout,
  schedulerHeartbeatIntervalForTtl,
  SCHEDULER_LOCK_TTL_MS,
  SCHEDULER_LOCK_TTL_SAFETY_FACTOR,
  HEARTBEATS_PER_TTL,
  HEARTBEAT_INTERVAL_MS,
} = require("../src/utils/scheduler-lock");

describe("scheduler lock fencing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("persiste e retorna um token proprietário", async () => {
    mockTxGet.mockResolvedValue({exists: false, data: () => undefined});

    const token = await acquireSchedulerLock("job", 60_000);

    expect(typeof token).toBe("string");
    expect(mockTxSet).toHaveBeenCalledWith(
      mockLockRef,
      expect.objectContaining({status: "running", owner_token: token}),
      {merge: true},
    );
  });

  it("impede owner antigo de liberar lock retomado", async () => {
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({owner_token: "successor-token", status: "running"}),
    });

    await expect(releaseSchedulerLock("job", "stale-token", "completed")).resolves.toBe(false);
    expect(mockTxSet).not.toHaveBeenCalled();
    expect(mockWarn).toHaveBeenCalledWith(expect.stringContaining("Owner obsoleto"));
  });
});

describe("scheduler lock heartbeat (issue #3967)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("atualiza heartbeat_at quando o owner ainda detém o lock", async () => {
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({owner_token: "owner-1", status: "running"}),
    });

    const ok = await heartbeatSchedulerLock("job", "owner-1");

    expect(ok).toBe(true);
    expect(mockTxSet).toHaveBeenCalledWith(
      mockLockRef,
      {heartbeat_at: mockServerTimestamp},
      {merge: true},
    );
  });

  it("não atualiza heartbeat quando outro owner detém o lock", async () => {
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({owner_token: "successor", status: "running"}),
    });

    const ok = await heartbeatSchedulerLock("job", "stale");

    expect(ok).toBe(false);
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("toma o lock quando heartbeat_at está mais velho que o TTL", async () => {
    // Repro do Defeito A (#3967): holder morreu de forma dura, o
    // finally não rodou, heartbeat_at congelou no passado. Mesmo com
    // started_at Fresco, o takeover DEVE acontecer — é o caminho que
    // libera as retries do Cloud Scheduler.
    const ttl = 45_000;
    const staleHeartbeat = {toMillis: () => Date.now() - ttl - 5_000};
    const freshStarted = {toMillis: () => Date.now()};
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({
        owner_token: "dead-owner",
        status: "running",
        heartbeat_at: staleHeartbeat,
        started_at: freshStarted,
      }),
    });

    const token = await acquireSchedulerLock("job", ttl);

    expect(typeof token).toBe("string");
    expect(token).not.toBeNull();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Lock stale detectado"),
    );
    expect(mockTxSet).toHaveBeenCalledWith(
      mockLockRef,
      expect.objectContaining({owner_token: token}),
      {merge: true},
    );
  });

  it("mantém o lock bloqueado enquanto heartbeat_at é fresco", async () => {
    // Holder vivo: heartbeat periódico mantém heartbeat_at recente.
    // Uma execução concorrente/retry NÃO deve tomar o lock.
    const ttl = 45_000;
    const freshHeartbeat = {toMillis: () => Date.now() - 1_000};
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({
        owner_token: "live-owner",
        status: "running",
        heartbeat_at: freshHeartbeat,
      }),
    });

    const token = await acquireSchedulerLock("job", ttl);

    expect(token).toBeNull();
    expect(mockTxSet).not.toHaveBeenCalled();
  });
});

describe("startSchedulerHeartbeat (issue #3967 / #3974)", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("dispara heartbeatSchedulerLock a cada intervalo até stop()", async () => {
    jest.useFakeTimers();
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({owner_token: "owner-1", status: "running"}),
    });

    const handle = startSchedulerHeartbeat("job", "owner-1", 1_000);

    // setInterval dispara em t=1s, 2s, 3s (não em t=0).
    await jest.advanceTimersByTimeAsync(3_000);
    expect(mockTxSet).toHaveBeenCalledTimes(3);

    handle.stop();
    mockTxSet.mockClear();
    await jest.advanceTimersByTimeAsync(5_000);
    expect(mockTxSet).not.toHaveBeenCalled();
  });

  it("issue #3974: isLost() começa false e só vira true quando heartbeat retorna false", async () => {
    // Defeito A: antes o retorno boolean do heartbeat era ignorado.
    // Agora isLost() reporta a perda de ownership para o caller abortar.
    jest.useFakeTimers();

    // Primeiro heartbeat: owner ainda detém o lock (retorna true).
    mockTxGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({owner_token: "owner-1", status: "running"}),
    });
    // Segundo heartbeat: outra instância tomou o lock (retorna false).
    mockTxGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({owner_token: "successor", status: "running"}),
    });

    const handle = startSchedulerHeartbeat("job", "owner-1", 1_000);

    expect(handle.isLost()).toBe(false);

    // t=1s: heartbeat bem-sucedido — continua detendo o lock.
    await jest.advanceTimersByTimeAsync(1_000);
    expect(handle.isLost()).toBe(false);

    // t=2s: heartbeat rejeitado — lock foi tomado.
    await jest.advanceTimersByTimeAsync(1_000);
    expect(handle.isLost()).toBe(true);

    // isLost é latching: uma vez perdido, não volta mais para este owner.
    mockTxGet.mockResolvedValue({
      exists: true,
      data: () => ({owner_token: "owner-1", status: "running"}),
    });
    await jest.advanceTimersByTimeAsync(1_000);
    expect(handle.isLost()).toBe(true);

    // Erro CRITICAL de takeover deve ser logado.
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("Heartbeat rejeitado para job"),
    );

    handle.stop();
  });

  it("issue #3974: falha isolada (exceção) do heartbeat NÃO marca isLost", async () => {
    // Best-effort: uma exceção transiente (network/throttle) não pode
    // abortar o job — só um `false` explícito (owner divergente) marca.
    jest.useFakeTimers();
    mockTxGet.mockRejectedValueOnce(new Error("transient firestore error"));

    const handle = startSchedulerHeartbeat("job", "owner-1", 1_000);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(handle.isLost()).toBe(false);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringContaining("Heartbeat falhou para job"),
      expect.any(Error),
    );

    handle.stop();
  });
});

describe("TTL/heartbeat derivados do timeoutSeconds (issue #3974 Defeito B)", () => {
  it("expõe constantes derivadas (não soltas) e TTL >= maior timeout", () => {
    // Issue #3974: corrige #3967 onde TTL=45s era 12× menor que o
    // timeout de 540s. Agora o TTL default (legado) cobre o maior
    // timeoutSeconds entre os crons (540s) com folga de segurança.
    expect(HEARTBEAT_INTERVAL_MS).toBe(15_000);
    expect(SCHEDULER_LOCK_TTL_SAFETY_FACTOR).toBe(2);
    expect(HEARTBEATS_PER_TTL).toBe(4);
    expect(SCHEDULER_LOCK_TTL_MS).toBe(540_000 * SCHEDULER_LOCK_TTL_SAFETY_FACTOR);
    // Invariante chave do Defeito B: TTL default NUNCA menor que o
    // maior timeoutSeconds declarado (540s).
    expect(SCHEDULER_LOCK_TTL_MS).toBeGreaterThanOrEqual(540_000);
  });

  it("schedulerLockTtlForTimeout retorna TTL >= timeout (não 12× menor)", () => {
    // Repro do Defeito B: #3967 usava TTL=45s para cleanupAllSoftDeleted
    // (timeoutSeconds:540) — 540/45 = 12 expirações durante a execução.
    const cleanupTtl = schedulerLockTtlForTimeout(540);
    expect(cleanupTtl).toBe(540 * 1000 * SCHEDULER_LOCK_TTL_SAFETY_FACTOR);
    expect(cleanupTtl).toBeGreaterThanOrEqual(540_000);

    const autoCancelTtl = schedulerLockTtlForTimeout(300);
    expect(autoCancelTtl).toBe(300 * 1000 * SCHEDULER_LOCK_TTL_SAFETY_FACTOR);
    expect(autoCancelTtl).toBeGreaterThanOrEqual(300_000);
  });

  it("schedulerHeartbeatIntervalForTtl deriva intervalo do TTL (vários heartbeats por TTL)", () => {
    // Intervalo = TTL / HEARTBEATS_PER_TTL: múltiplos heartbeats por TTL
    // toleram falhas isoladas sem takeover prematuro.
    const cleanupTtl = schedulerLockTtlForTimeout(540); // 1_080_000ms
    const interval = schedulerHeartbeatIntervalForTtl(cleanupTtl);
    expect(interval).toBe(Math.floor(cleanupTtl / HEARTBEATS_PER_TTL));
    expect(interval).toBe(270_000); // 4 heartbeats no TTL de 18min

    // Piso de 1s evita busy-loop em TTL muito pequeno.
    expect(schedulerHeartbeatIntervalForTtl(0)).toBe(1_000);
    expect(schedulerHeartbeatIntervalForTtl(500)).toBe(1_000);
  });
});
