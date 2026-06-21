const mockCollectionAdd = jest.fn().mockResolvedValue({ id: "metric1" });
const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue([]);
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockStartAfter = jest.fn().mockReturnThis();

// FIX #2799: startAfter necessário para paginação cursor nas iterações > 1
const queryChain: any = { where: mockWhere, orderBy: mockOrderBy, limit: mockLimit, startAfter: mockStartAfter, get: mockCollectionGet };
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);
mockStartAfter.mockReturnValue(queryChain);

const mockBatchFn = jest.fn(() => ({ delete: mockBatchDelete, commit: mockBatchCommit }));

const cleanupFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const cleanupTimestamp = {
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
  fromMillis: jest.fn((ms: number) => ({ toDate: () => new Date(ms), _type: "Timestamp" })),
};

const mockCollection = jest.fn((name?: string) => ({
  doc: jest.fn((id: string) => ({ id, get: jest.fn(), update: jest.fn() })),
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockCollectionGet,
  add: mockCollectionAdd,
}));

const cleanupFirestore = jest.fn(() => ({
  collection: mockCollection,
  batch: mockBatchFn,
  runTransaction: jest.fn(),
})) as any;
cleanupFirestore.FieldValue = cleanupFieldValue;
cleanupFirestore.Timestamp = cleanupTimestamp;
cleanupFirestore.FieldPath = { documentId: jest.fn(() => "__name__") };

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: cleanupFirestore,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  setGlobalOptions: jest.fn(),
  scheduler: { onSchedule: jest.fn((_c: any, h: any) => h) },
  https: {
    onCall: jest.fn((_c: any, h: any) => h || _c),
    HttpsError: jest.fn(),
  },
}));

jest.mock("../../src/_db", () => ({
  db: jest.fn(() => ({
    collection: mockCollection,
    batch: mockBatchFn,
  })),
}));

jest.mock("../../src/constants", () => ({
  FIRESTORE_PAGINATION_LIMIT: 500,
}));

import { cleanupOldXpLogs, cleanupOldActivities, cleanupOldNotifications } from "../../src/maintenance/cleanup-old-logs";

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue([]);
  mockCollectionAdd.mockResolvedValue({ id: "metric1" });
  mockBatchFn.mockImplementation(() => ({ delete: mockBatchDelete, commit: mockBatchCommit }));
  mockWhere.mockReturnValue(queryChain);
  mockLimit.mockReturnValue(queryChain);
  mockOrderBy.mockReturnValue(queryChain);
  mockStartAfter.mockReturnValue(queryChain);
  mockCollectionGet.mockResolvedValue({ empty: true, size: 0, docs: [] });
});

describe("Cleanup Old Logs", () => {
  describe("cleanupOldXpLogs", () => {
    it("deleta logs mais velhos que 1 ano", async () => {
      mockCollectionGet.mockResolvedValueOnce({ empty: false, size: 3, docs: [{ ref: { id: "log1" } }, { ref: { id: "log2" } }, { ref: { id: "log3" } }] });

      await cleanupOldXpLogs();

      expect(mockBatchDelete).toHaveBeenCalledTimes(3);
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it("FIX #2799: nao para em 100 batches — continua ate esvaziar", async () => {
      // Simula 101 páginas com 1 doc cada (leve no mock) seguidas de página vazia.
      // Antes do fix, o loop parava em batchCount=100; agora deve ir até 101.
      const singleDocPage = {
        empty: false,
        size: 500, // size >= FIRESTORE_PAGINATION_LIMIT → loop continua
        docs: [{ ref: { id: "log0" } }],
      };
      for (let i = 0; i < 101; i++) {
        mockCollectionGet.mockResolvedValueOnce(singleDocPage);
      }
      // Página vazia encerra o loop naturalmente
      mockCollectionGet.mockResolvedValueOnce({ empty: true, size: 0, docs: [] });

      await cleanupOldXpLogs();

      // Sem cap de 100 batches, deve ter comitado 101 vezes
      expect(mockBatchCommit).toHaveBeenCalledTimes(101);
    });

    it("para quando collection vazia", async () => {
      await cleanupOldXpLogs();

      expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it("registra metricas apos cleanup", async () => {
      mockCollectionGet.mockResolvedValueOnce({ empty: false, size: 2, docs: [{ ref: { id: "l1" } }, { ref: { id: "l2" } }] });

      await cleanupOldXpLogs();

      expect(mockCollectionAdd).toHaveBeenCalledWith(expect.objectContaining({ type: "xp_logs_cleanup" }));
    });

    it("registra metrica de erro quando falha", async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error("Firestore timeout"));

      await cleanupOldXpLogs().catch(() => {});

      expect(mockCollectionAdd).toHaveBeenCalledWith(expect.objectContaining({ type: "xp_logs_cleanup_error" }));
    });
  });

  describe("cleanupOldActivities", () => {
    it("deleta activities mais velhas que 90 dias", async () => {
      mockCollectionGet.mockResolvedValueOnce({ empty: false, size: 2, docs: [{ ref: { id: "act1" } }, { ref: { id: "act2" } }] });

      await cleanupOldActivities();

      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockCollectionAdd).toHaveBeenCalledWith(expect.objectContaining({ type: "activities_cleanup" }));
    });

    it("para quando collection vazia", async () => {
      await cleanupOldActivities();

      expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it("registra metrica mesmo quando nao ha activities", async () => {
      await cleanupOldActivities();

      expect(mockCollectionAdd).toHaveBeenCalledWith(expect.objectContaining({ type: "activities_cleanup" }));
    });
  });

  describe("cleanupOldNotifications", () => {
    it("deleta notificacoes lidas mais velhas que 30 dias", async () => {
      mockCollectionGet.mockResolvedValueOnce({ empty: false, size: 2, docs: [{ ref: { id: "notif1" } }, { ref: { id: "notif2" } }] });

      await cleanupOldNotifications();

      expect(mockBatchDelete).toHaveBeenCalledTimes(2);
      expect(mockCollectionAdd).toHaveBeenCalledWith(expect.objectContaining({ type: "notifications_cleanup" }));
    });

    it("para quando collection vazia", async () => {
      await cleanupOldNotifications();

      expect(mockBatchDelete).not.toHaveBeenCalled();
    });

    it("registra metrica de erro quando falha", async () => {
      mockCollectionGet.mockRejectedValueOnce(new Error("DB error"));

      await cleanupOldNotifications().catch(() => {});

      expect(mockCollectionAdd).toHaveBeenCalledWith(expect.objectContaining({ type: "notifications_cleanup_error" }));
    });
  });
});
