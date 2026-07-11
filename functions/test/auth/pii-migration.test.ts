const mockDocSet = jest.fn().mockResolvedValue(undefined);
let mockFirestoreDb: unknown;
const mockDoc = jest.fn((path: string) => ({
  id: path.split("/").pop(),
  set: mockDocSet,
}));
const mockAcquireOperationLease = jest.fn();
const mockCompleteOperationLease = jest.fn();
const mockFailOperationLease = jest.fn();

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetAt: new Date(Date.now() + 3600000),
  }),
}));

jest.mock("../../src/middleware/operation-lock", () => ({
  acquireOperationLease: (...args: unknown[]) =>
    mockAcquireOperationLease(...args),
  completeOperationLease: (...args: unknown[]) =>
    mockCompleteOperationLease(...args),
  failOperationLease: (...args: unknown[]) =>
    mockFailOperationLease(...args),
}));

class MockHttpsError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
  }
}

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((_config: unknown, handler: unknown) => handler),
  onDocumentUpdated: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestoreDb ?? {doc: mockDoc}),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
    delete: jest.fn(() => ({_type: "FieldDelete"})),
  },
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
}));

import {
  migratePiiDocumentAtomically,
  migratePiiToUsersPrivate,
  piiValuesEqual,
  removePiiDocumentAtomically,
  removePiiFromUsers,
  updateUserPii,
} from "../../src/auth/pii-migration";
import {checkRateLimit} from "../../src/middleware/rate-limiter";

const makeRequest = (overrides: Record<string, unknown> = {}) => ({
  auth: {uid: "user-1", token: {role: "PLAYER"}},
  data: {gender: "MALE"},
  ...overrides,
});

describe("Auth — PII migration callables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetAt: new Date(Date.now() + 3600000),
    });
    mockDocSet.mockResolvedValue(undefined);
    mockFirestoreDb = undefined;
    mockAcquireOperationLease.mockResolvedValue({
      operationId: "pii-test",
      leaseId: "lease-1",
      ownerUid: "admin-1",
      ref: {path: "system_locks/pii-test"},
    });
    mockCompleteOperationLease.mockResolvedValue(undefined);
    mockFailOperationLease.mockResolvedValue(undefined);
  });

  describe("updateUserPii", () => {
    it("salva gênero NOT_INFORMED enviado pela web", async () => {
      const result = await updateUserPii(makeRequest({
        data: {gender: "NOT_INFORMED"},
      }) as never);

      expect(result).toEqual({success: true, updated: ["gender"]});
      expect(mockDoc).toHaveBeenCalledWith("users_private/user-1");
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({gender: "NOT_INFORMED"}),
        {merge: true}
      );
    });

    it("permite limpar gênero com null", async () => {
      const result = await updateUserPii(makeRequest({
        data: {gender: null},
      }) as never);

      expect(result).toEqual({success: true, updated: ["gender"]});
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({gender: null}),
        {merge: true}
      );
    });

    it("rejeita gênero inválido", async () => {
      await expect(
        updateUserPii(makeRequest({data: {gender: "INVALID"}}) as never)
      ).rejects.toThrow("Campo gender inválido");
      expect(mockDocSet).not.toHaveBeenCalled();
    });

    it("rejeita request sem autenticação", async () => {
      await expect(
        updateUserPii(makeRequest({auth: null}) as never)
      ).rejects.toThrow("Login obrigatório");
      expect(mockDocSet).not.toHaveBeenCalled();
    });
  });

  describe("migração e cleanup administrativos", () => {
    function adminDatabase(
      users: Array<{id: string; publicData: Record<string, unknown>}>,
      privateById: Record<string, Record<string, unknown>> = {},
      failingUserId?: string,
    ) {
      const queryGet = jest.fn().mockResolvedValue({
        empty: users.length === 0,
        size: users.length,
        docs: users.map((user) => ({
          id: user.id,
          ref: {
            id: user.id,
            path: `users/${user.id}`,
            publicData: user.publicData,
          },
        })),
      });
      const query = {
        orderBy: jest.fn(),
        limit: jest.fn(),
        startAfter: jest.fn(),
        get: queryGet,
      };
      query.orderBy.mockReturnValue(query);
      query.limit.mockReturnValue(query);
      query.startAfter.mockReturnValue(query);
      const txSet = jest.fn();
      const txUpdate = jest.fn();
      const database = {
        collection: jest.fn(() => query),
        doc: jest.fn((path: string) => ({
          id: path.split("/").pop(),
          path,
        })),
        runTransaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
          callback({
            get: jest.fn(async (ref: {
              id: string;
              path: string;
              publicData?: Record<string, unknown>;
            }) => {
              if (ref.id === failingUserId) throw new Error("transaction failed");
              const isPrivate = ref.path.startsWith("users_private/");
              const data = isPrivate ? privateById[ref.id] ?? {} :
                ref.publicData ?? {};
              return {exists: true, data: () => data};
            }),
            set: txSet,
            update: txUpdate,
          })),
      };
      return {database, queryGet, txSet, txUpdate};
    }

    const adminRequest = {
      auth: {uid: "admin-1", token: {role: "ADMIN"}},
      data: {},
    };

    it("migra uma página, contabiliza skips e conclui o lease", async () => {
      const {database, txSet} = adminDatabase([
        {id: "with-pii", publicData: {email: "one@example.com"}},
        {id: "without-pii", publicData: {display_name: "Sem PII"}},
      ]);
      mockFirestoreDb = database;

      await expect(migratePiiToUsersPrivate(adminRequest as never)).resolves
        .toEqual({
          success: true,
          migrated: 1,
          skipped: 1,
          errors: [],
          total: 2,
        });
      expect(txSet).toHaveBeenCalledTimes(1);
      expect(mockCompleteOperationLease).toHaveBeenCalledWith(
        database,
        expect.any(Object),
        {migrated: 1, skipped: 1, errors_count: 0},
      );
    });

    it("preserva conflitos e falhas individuais sem perder a página", async () => {
      const {database} = adminDatabase([
        {id: "conflict", publicData: {email: "public@example.com"}},
        {id: "broken", publicData: {email: "broken@example.com"}},
      ], {
        conflict: {email: "private@example.com"},
      }, "broken");
      mockFirestoreDb = database;

      const result = await migratePiiToUsersPrivate(adminRequest as never);

      expect(result).toMatchObject({success: true, migrated: 0, total: 2});
      expect(result.errors).toEqual([
        {uid: "conflict", error: "PII privada divergente: email"},
        {uid: "broken", error: "transaction failed"},
      ]);
    });

    it("remove PII confirmada e relata divergências", async () => {
      const {database, txUpdate} = adminDatabase([
        {id: "clean", publicData: {email: "same@example.com"}},
        {id: "conflict", publicData: {gender: "MALE"}},
        {id: "empty", publicData: {display_name: "Sem PII"}},
      ], {
        clean: {email: "same@example.com"},
        conflict: {gender: "FEMALE"},
      });
      mockFirestoreDb = database;

      const result = await removePiiFromUsers(adminRequest as never);

      expect(result).toEqual({
        success: true,
        cleaned: 1,
        skipped: 1,
        errors: [{
          uid: "conflict",
          error: "PII privada ausente ou divergente: gender",
        }],
        total: 3,
      });
      expect(txUpdate).toHaveBeenCalledTimes(1);
      expect(mockCompleteOperationLease).toHaveBeenCalledWith(
        database,
        expect.any(Object),
        {cleaned: 1, skipped: 1, errors_count: 1},
      );
    });

    it("marca o lease como falho quando a paginação quebra", async () => {
      const {database, queryGet} = adminDatabase([]);
      queryGet.mockRejectedValueOnce(new Error("query unavailable"));
      mockFirestoreDb = database;

      await expect(migratePiiToUsersPrivate(adminRequest as never))
        .rejects.toMatchObject({code: "internal"});
      expect(mockFailOperationLease).toHaveBeenCalledWith(
        database,
        expect.any(Object),
        expect.objectContaining({message: "query unavailable"}),
      );
    });
  });
});

describe("piiValuesEqual", () => {
  it("compara Date e protege comparadores que lançam", () => {
    expect(piiValuesEqual(new Date(123), new Date(123))).toBe(true);
    expect(piiValuesEqual(new Date(123), new Date(456))).toBe(false);
    expect(piiValuesEqual({isEqual: () => {
      throw new Error("invalid comparable");
    }}, {})).toBe(false);
    expect(piiValuesEqual({}, {isEqual: () => true})).toBe(true);
    expect(piiValuesEqual({}, {isEqual: () => {
      throw new Error("invalid comparable");
    }})).toBe(false);
    expect(piiValuesEqual({}, {}, 9)).toBe(false);
  });

  it("compara Timestamp por millis e não por referência", () => {
    expect(piiValuesEqual(
      {toMillis: () => 1_234},
      {toMillis: () => 1_234},
    )).toBe(true);
    expect(piiValuesEqual(
      {toMillis: () => 1_234},
      {toMillis: () => 9_999},
    )).toBe(false);
  });

  it("usa isEqual de tipos Firestore como GeoPoint", () => {
    const point = {
      latitude: -23.5,
      longitude: -46.6,
      isEqual: (other: unknown) => {
        const candidate = other as {latitude?: number; longitude?: number};
        return candidate.latitude === -23.5 && candidate.longitude === -46.6;
      },
    };
    expect(piiValuesEqual(point, {
      latitude: -23.5,
      longitude: -46.6,
    })).toBe(true);
  });

  it("compara mapas e arrays aninhados semanticamente", () => {
    expect(piiValuesEqual(
      {date: {seconds: 10, nanoseconds: 20}, values: [1, "a"]},
      {values: [1, "a"], date: {nanoseconds: 20, seconds: 10}},
    )).toBe(true);
    expect(piiValuesEqual({seconds: 10}, {seconds: 11})).toBe(false);
  });
});

describe("PII migration atomic helpers", () => {
  const userRef = {id: "user-1", path: "users/user-1"};

  function databaseWith(
    publicData: Record<string, unknown>,
    privateData: Record<string, unknown>,
  ) {
    const txSet = jest.fn();
    const txUpdate = jest.fn();
    const privateRef = {id: "user-1", path: "users_private/user-1"};
    const database = {
      doc: jest.fn(() => privateRef),
      runTransaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          get: jest.fn(async (ref: {path: string}) => ({
            exists: true,
            data: () => ref.path.startsWith("users_private/") ?
              privateData :
              publicData,
          })),
          set: txSet,
          update: txUpdate,
        })),
    };
    return {database, txSet, txUpdate};
  }

  it("não sobrescreve PII privada mais nova com snapshot público antigo", async () => {
    const {database, txSet} = databaseWith(
      {email: "old@example.com"},
      {email: "new@example.com"},
    );
    const result = await migratePiiDocumentAtomically(
      database as never,
      userRef as never,
    );
    expect(result).toEqual({
      hadPii: true,
      changed: false,
      conflicts: ["email"],
    });
    expect(txSet).not.toHaveBeenCalled();
  });

  it("persiste PII ausente no documento privado", async () => {
    const {database, txSet} = databaseWith(
      {email: "new@example.com"},
      {},
    );
    const result = await migratePiiDocumentAtomically(
      database as never,
      userRef as never,
    );
    expect(result).toEqual({hadPii: true, changed: true, conflicts: []});
    expect(txSet).toHaveBeenCalledWith(
      expect.objectContaining({path: "users_private/user-1"}),
      expect.objectContaining({email: "new@example.com"}),
      {merge: true},
    );
  });

  it("não apaga PII alterada depois da paginação do cleanup", async () => {
    const {database, txUpdate} = databaseWith(
      {email: "new@example.com"},
      {email: "old@example.com"},
    );
    const result = await removePiiDocumentAtomically(
      database as never,
      userRef as never,
    );
    expect(result.conflicts).toEqual(["email"]);
    expect(result.changed).toBe(false);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("remove somente PII confirmada pela releitura transacional", async () => {
    const {database, txUpdate} = databaseWith(
      {email: "same@example.com"},
      {email: "same@example.com"},
    );
    const result = await removePiiDocumentAtomically(
      database as never,
      userRef as never,
    );
    expect(result).toMatchObject({changed: true, conflicts: []});
    expect(txUpdate).toHaveBeenCalledWith(
      userRef,
      {email: {_type: "FieldDelete"}},
    );
  });
});
