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
const mockServerTimestamp = {_type: "server-timestamp"};

jest.mock("../src/_db", () => ({db: jest.fn(() => mockDb)}));
jest.mock("firebase-functions/v2", () => ({logger: {warn: mockWarn}}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: jest.fn(() => mockServerTimestamp)},
}));

const {
  acquireSchedulerLock,
  releaseSchedulerLock,
  heartbeatSchedulerLock,
  startSchedulerHeartbeat,
  SCHEDULER_LOCK_TTL_MS,
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

describe("startSchedulerHeartbeat (issue #3967)", () => {
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

  it("expõe constantes de TTL/heartbeat derivadas (não soltas)", () => {
    // Issue #3967 critério 3: TTL não é mais 12× o timeout — é
    // heartbeat-driven e exportado para reuso entre funções.
    expect(HEARTBEAT_INTERVAL_MS).toBe(15_000);
    expect(SCHEDULER_LOCK_TTL_MS).toBe(3 * HEARTBEAT_INTERVAL_MS);
  });
});
