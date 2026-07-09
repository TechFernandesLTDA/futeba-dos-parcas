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
