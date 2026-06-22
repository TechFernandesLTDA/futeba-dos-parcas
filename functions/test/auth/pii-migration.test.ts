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
  },
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
}));

import {updateUserPii} from "../../src/auth/pii-migration";
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
