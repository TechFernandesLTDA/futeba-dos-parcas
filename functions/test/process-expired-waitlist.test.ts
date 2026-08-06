const mockSendNotificationToUser = jest.fn().mockResolvedValue(true);
const mockSendNotificationToUsers = jest.fn().mockResolvedValue(1);
const mockSaveNotificationToFirestore = jest.fn().mockResolvedValue("notif-id");
const mockRunTransaction = jest.fn();
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockCollectionGet = jest.fn();

const mockHeartbeatStop = jest.fn();
const mockHeartbeatIsLost = jest.fn().mockReturnValue(false);
const mockHeartbeatHandle = {
  stop: mockHeartbeatStop,
  isLost: mockHeartbeatIsLost,
};

const mockAcquireSchedulerLock = jest.fn().mockResolvedValue("fake-token");
const mockReleaseSchedulerLock = jest.fn().mockResolvedValue(true);
const mockStartSchedulerHeartbeat = jest.fn(() => mockHeartbeatHandle);

const queryChain: any = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: mockCollectionGet,
};

const mockDoc = jest.fn((id: string) => ({
  id,
  get: jest.fn(),
  collection: jest.fn(() => ({
    where: queryChain.where,
    orderBy: queryChain.orderBy,
    limit: queryChain.limit,
    startAfter: queryChain.startAfter,
    get: mockCollectionGet,
  })),
}));

const mockCollection = jest.fn(() => ({
  doc: mockDoc,
  where: queryChain.where,
  orderBy: queryChain.orderBy,
  limit: queryChain.limit,
  startAfter: queryChain.startAfter,
  get: mockCollectionGet,
}));

const mockCollectionGroup = jest.fn(() => ({
  where: queryChain.where,
  orderBy: queryChain.orderBy,
  limit: queryChain.limit,
  startAfter: queryChain.startAfter,
  get: mockCollectionGet,
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  delete: jest.fn(() => ({_type: "FieldDelete"})),
};
const mockTimestamp = {
  fromDate: jest.fn((d: Date) => ({toDate: () => d, _type: "Timestamp"})),
  now: jest.fn(() => ({toDate: () => new Date(), _type: "Timestamp"})),
};
const mockFirestore = jest.fn(() => ({
  collection: mockCollection,
  collectionGroup: mockCollectionGroup,
  FieldValue: mockFieldValue,
  Timestamp: mockTimestamp,
  runTransaction: mockRunTransaction,
}));

(mockFirestore as any).FieldValue = mockFieldValue;
(mockFirestore as any).Timestamp = mockTimestamp;

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_c: any, h: any) => h),
}));

jest.mock("../src/notifications", () => ({
  sendNotificationToUser: mockSendNotificationToUser,
  sendNotificationToUsers: mockSendNotificationToUsers,
  saveNotificationToFirestore: mockSaveNotificationToFirestore,
  NotificationType: {
    GAME_CANCELLED: "GAME_CANCELLED",
    GAME_REMINDER: "GAME_REMINDER",
    GAME_SUMMON: "GAME_SUMMON",
  },
}));

jest.mock("../src/utils/scheduler-lock", () => ({
  acquireSchedulerLock: mockAcquireSchedulerLock,
  releaseSchedulerLock: mockReleaseSchedulerLock,
  startSchedulerHeartbeat: mockStartSchedulerHeartbeat,
  schedulerLockTtlForTimeout: jest.fn(() => 600_000),
  schedulerHeartbeatIntervalForTtl: jest.fn(() => 150_000),
}));

import {processExpiredWaitlistEntries} from "../src/reminders";

const DEFAULT_TX_GET = {exists: false, data: () => null};

function setupTransactionMock(impl: (refOrQuery: any) => any) {
  mockTransactionGet.mockImplementation(async (refOrQuery: any) => {
    const result = impl(refOrQuery);
    if (result instanceof Error) throw result;
    return result;
  });
}

describe("processExpiredWaitlistEntries (#4012)", () => {
  beforeEach(() => {
    mockTransactionGet.mockReset();
    mockCollectionGet.mockReset();
    mockRunTransaction.mockReset();
    mockTransactionUpdate.mockReset();
    mockTransactionSet.mockReset();
    mockSendNotificationToUser.mockReset().mockResolvedValue(true);
    mockSendNotificationToUsers.mockReset().mockResolvedValue(1);
    mockSaveNotificationToFirestore.mockReset().mockResolvedValue("notif-id");
    mockAcquireSchedulerLock.mockReset().mockResolvedValue("fake-token");
    mockReleaseSchedulerLock.mockReset().mockResolvedValue(true);
    mockStartSchedulerHeartbeat.mockReset().mockReturnValue(mockHeartbeatHandle);
    mockHeartbeatIsLost.mockReturnValue(false);
    queryChain.where = jest.fn().mockReturnThis();
    queryChain.orderBy = jest.fn().mockReturnThis();
    queryChain.limit = jest.fn().mockReturnThis();
    queryChain.startAfter = jest.fn().mockReturnThis();
    queryChain.get = mockCollectionGet;

    mockRunTransaction.mockImplementation(async (callback: any) =>
      callback({
        get: mockTransactionGet,
        set: mockTransactionSet,
        update: mockTransactionUpdate,
      })
    );
    mockTransactionGet.mockResolvedValue(DEFAULT_TX_GET);
  });

  it("expira entrada NOTIFIED e promove proxima WAITING", async () => {
    const entryRef = {id: "wl1"};
    const nextRef = {id: "wl2"};

    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "wl1",
            ref: entryRef,
            data: () => ({
              status: "NOTIFIED",
              game_id: "game1",
              user_id: "user1",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({docs: [], size: 0});

    setupTransactionMock((ref) => {
      if (ref === entryRef)
        return {
          exists: true,
          data: () => ({
            status: "NOTIFIED",
            game_id: "game1",
            user_id: "user1",
          }),
        };
      return {
        docs: [
          {
            ref: nextRef,
            data: () => ({
              user_id: "user2",
              user_name: "Jogador 2",
              status: "WAITING",
            }),
          },
        ],
        empty: false,
        size: 1,
      };
    });

    await processExpiredWaitlistEntries();

    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      entryRef,
      expect.objectContaining({status: "EXPIRED"})
    );
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      nextRef,
      expect.objectContaining({status: "NOTIFIED"})
    );
    expect(mockSendNotificationToUser).toHaveBeenCalledWith(
      "user2",
      expect.objectContaining({type: "GAME_SUMMON"})
    );
  });

  it("tx.update para EXPIRED vem DEPOIS de tx.get para WAITING (read-before-write)", async () => {
    const entryRef = {id: "wl1"};
    const nextRef = {id: "wl2"};
    const txCallOrder: string[] = [];

    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "wl1",
            ref: entryRef,
            data: () => ({
              status: "NOTIFIED",
              game_id: "game1",
              user_id: "user1",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({docs: [], size: 0});

    setupTransactionMock((ref) => {
      if (ref === entryRef) {
        txCallOrder.push("get:entry");
        return {
          exists: true,
          data: () => ({
            status: "NOTIFIED",
            game_id: "game1",
            user_id: "user1",
          }),
        };
      }
      txCallOrder.push("get:nextQuery");
      return {
        docs: [
          {
            ref: nextRef,
            data: () => ({
              user_id: "user2",
              user_name: "Jogador 2",
              status: "WAITING",
            }),
          },
        ],
        empty: false,
        size: 1,
      };
    });

    mockTransactionUpdate.mockImplementation(async (ref: any) => {
      txCallOrder.push(`update:${ref?.id}`);
    });

    await processExpiredWaitlistEntries();

    const getNextIdx = txCallOrder.indexOf("get:nextQuery");
    const updateEntryIdx = txCallOrder.indexOf("update:wl1");

    expect(getNextIdx).toBeGreaterThan(-1);
    expect(updateEntryIdx).toBeGreaterThan(-1);
    expect(getNextIdx).toBeLessThan(updateEntryIdx);
  });

  it("nao promove quando nao ha WAITING na fila", async () => {
    const entryRef = {id: "wl1"};

    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "wl1",
            ref: entryRef,
            data: () => ({
              status: "NOTIFIED",
              game_id: "game1",
              user_id: "user1",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({docs: [], size: 0});

    let callCount = 0;
    setupTransactionMock(() => {
      callCount++;
      if (callCount === 1)
        return {
          exists: true,
          data: () => ({
            status: "NOTIFIED",
            game_id: "game1",
            user_id: "user1",
          }),
        };
      return {docs: [], empty: true, size: 0};
    });

    await processExpiredWaitlistEntries();

    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      entryRef,
      expect.objectContaining({status: "EXPIRED"})
    );
    expect(mockSendNotificationToUser).not.toHaveBeenCalled();
  });

  it("falha por entrada faz cron terminar em erro (nao engole)", async () => {
    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "wl1",
            ref: {id: "wl1"},
            data: () => ({
              status: "NOTIFIED",
              game_id: "game1",
              user_id: "user1",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({docs: [], size: 0});

    mockTransactionGet.mockImplementation(async () => {
      throw new Error(
        "Firestore transactions require all reads to be executed before all writes."
      );
    });

    await expect(processExpiredWaitlistEntries()).rejects.toThrow(
      /falharam ao processar/
    );
  });

  it("pagina com cursor avanca para segunda pagina", async () => {
    const docs = Array.from({length: 101}, (_, i) => ({
      id: `wl${i}`,
      ref: {id: `wl${i}`},
      data: () => ({
        status: "NOTIFIED",
        game_id: "game1",
        user_id: `user${i}`,
      }),
    }));

    mockCollectionGet
      .mockResolvedValueOnce({docs: docs.slice(0, 100), size: 100})
      .mockResolvedValueOnce({docs: docs.slice(100), size: 1})
      .mockResolvedValueOnce({docs: [], size: 0});

    mockTransactionGet.mockResolvedValue(DEFAULT_TX_GET);

    await processExpiredWaitlistEntries();

    expect(queryChain.startAfter).toHaveBeenCalled();
    expect(mockCollectionGet).toHaveBeenCalledTimes(2);
  });

  it("pula entrada com status != NOTIFIED (TOCTOU guard)", async () => {
    const entryRef = {id: "wl1"};

    mockCollectionGet
      .mockResolvedValueOnce({
        docs: [
          {
            id: "wl1",
            ref: entryRef,
            data: () => ({
              status: "NOTIFIED",
              game_id: "game1",
              user_id: "user1",
            }),
          },
        ],
        size: 1,
      })
      .mockResolvedValueOnce({docs: [], size: 0});

    setupTransactionMock((ref) => {
      if (ref === entryRef)
        return {
          exists: true,
          data: () => ({
            status: "EXPIRED",
            game_id: "game1",
            user_id: "user1",
          }),
        };
      return {docs: [], empty: true, size: 0};
    });

    await processExpiredWaitlistEntries();

    expect(mockTransactionUpdate).not.toHaveBeenCalled();
    expect(mockSendNotificationToUser).not.toHaveBeenCalled();
  });
});
