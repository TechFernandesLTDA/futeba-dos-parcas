const mockDocSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn((path: string) => ({
  id: path.split("/").pop(),
  set: mockDocSet,
}));

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 9,
    resetAt: new Date(Date.now() + 3600000),
  }),
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
  firestore: jest.fn(() => ({
    doc: mockDoc,
  })),
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
  piiValuesEqual,
  removePiiDocumentAtomically,
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
});

describe("piiValuesEqual", () => {
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
