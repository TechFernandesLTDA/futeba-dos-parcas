const mockGetUser = jest.fn();
const mockSetCustomUserClaims = jest.fn();
const mockRevokeRefreshTokens = jest.fn();
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 4, resetAt: new Date(Date.now() + 3600000) }),
}));

jest.mock("../../src/validation/cpf", () => ({
  hashCpf: jest.fn((cpf: string, salt: string) => `hash_${cpf}`),
  isValidCpf: jest.fn((cpf: string) => cpf === "529.982.247-25" || cpf === "11144477735"),
  maskCpf: jest.fn((cpf: string) => "***.247.25"),
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
  onCall: jest.fn((_c: any, h: any) => h || _c),
  HttpsError: MockHttpsError,
}));

jest.mock("firebase-functions/v2", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const mockFirestore = jest.fn(() => ({
  collection: jest.fn(() => ({
    doc: jest.fn((id: string) => ({ id, get: mockDocGet, set: mockDocSet, update: jest.fn() })),
  })),
  doc: jest.fn((path: string) => ({ id: path.split("/").pop(), get: mockDocGet, set: mockDocSet, update: jest.fn() })),
  get runTransaction() { return mockRunTransaction; },
})) as any;
mockFirestore.FieldValue = mockFieldValue;

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
  auth: jest.fn(() => ({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  })),
}));

import { verifyCpf, setUserVerified } from "../../src/auth/verification";

const makeRequest = (overrides: any = {}) => ({
  auth: overrides.auth === undefined ? { uid: "user1", token: {} } : overrides.auth,
  data: { cpf: "529.982.247-25", uid: "user1", ...overrides.data },
  app: { appId: "test-app", token: "test-token" },
  rawRequest: { ip: "127.0.0.1", headers: { "x-forwarded-for": "192.168.1.1" } },
  ...overrides,
});

describe("Auth — Verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunTransaction.mockReset();
    process.env.CPF_SALT = "abcdef1234567890abcdef1234567890";
  });

  afterEach(() => {
    delete process.env.CPF_SALT;
  });

  describe("verifyCpf", () => {
    it("valida CPF e cria users_private com sucesso", async () => {
      mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({ exists: false, data: () => null })
            .mockResolvedValueOnce({ exists: false, data: () => null }),
          set: jest.fn(),
        };
        return cb(tx);
      });

      const result = await verifyCpf(makeRequest());

      expect(result.success).toBe(true);
      expect(result.cpfMasked).toBe("***.247.25");
    });

    it("rejeita sem autenticacao", async () => {
      await expect(
        verifyCpf(makeRequest({ auth: null })),
      ).rejects.toThrow();
    });

    it("rejeita CPF invalido", async () => {
      await expect(
        verifyCpf(makeRequest({ data: { cpf: "000.000.000-00" } })),
      ).rejects.toThrow();
    });

    it("rejeita CPF ja registrado por outro usuario", async () => {
      mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({ exists: true, data: () => ({ uid: "outro_user" }) }),
          set: jest.fn(),
        };
        return cb(tx);
      });

      await expect(
        verifyCpf(makeRequest()),
      ).rejects.toThrow();
    });

    it("rejeita mudanca de CPF quando ja tem outro registrado", async () => {
      mockRunTransaction.mockImplementationOnce(async (cb: any) => {
        const tx = {
          get: jest.fn()
            .mockResolvedValueOnce({ exists: true, data: () => ({ uid: "user1" }) })
            .mockResolvedValueOnce({ exists: true, data: () => ({ cpfHash: "hash_11144477735" }) }),
          set: jest.fn(),
        };
        return cb(tx);
      });

      await expect(
        verifyCpf(makeRequest()),
      ).rejects.toThrow();
    });

    it("rejeita sem CPF_SALT configurado", async () => {
      delete process.env.CPF_SALT;
      await expect(
        verifyCpf(makeRequest()),
      ).rejects.toThrow();
    });
  });

  describe("setUserVerified", () => {
    it("seta verified=true quando pre-condicoes OK", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ cpfVerifiedAt: { _type: "ServerTimestamp" } }),
      });
      mockGetUser.mockResolvedValueOnce({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      mockSetCustomUserClaims.mockResolvedValueOnce(undefined);
      mockRevokeRefreshTokens.mockResolvedValueOnce(undefined);

      const result = await setUserVerified(makeRequest());

      expect(result.success).toBe(true);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ verified: true, profileComplete: true }),
      );
    });

    it("retorna alreadyVerified quando usuario ja verificado", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ cpfVerifiedAt: { _type: "ServerTimestamp" } }),
      });
      mockGetUser.mockResolvedValueOnce({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: { verified: true },
      });

      const result = await setUserVerified(makeRequest());

      expect(result.alreadyVerified).toBe(true);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({verified: true, profileComplete: true}),
      );
    });

    it("rejeita sem phone number", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ cpfVerifiedAt: { _type: "ServerTimestamp" } }),
      });
      mockGetUser.mockResolvedValueOnce({
        uid: "user1",
        phoneNumber: null,
        customClaims: {},
      });

      await expect(
        setUserVerified(makeRequest()),
      ).rejects.toThrow();
    });

    it("rejeita sem cpfVerifiedAt", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({}),
      });

      await expect(
        setUserVerified(makeRequest()),
      ).rejects.toThrow();
    });

    it("rejeita sem autenticacao", async () => {
      await expect(
        setUserVerified(makeRequest({ auth: null })),
      ).rejects.toThrow();
    });

    it("admin pode verificar outro usuario", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ cpfVerifiedAt: { _type: "ServerTimestamp" } }),
      });
      mockGetUser.mockResolvedValueOnce({
        uid: "user2",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      mockSetCustomUserClaims.mockResolvedValueOnce(undefined);
      mockRevokeRefreshTokens.mockResolvedValueOnce(undefined);

      const result = await setUserVerified(makeRequest({
        auth: { uid: "admin1", token: { role: "ADMIN" } },
        data: { uid: "user2" },
      }));

      expect(result.success).toBe(true);
    });
  });
});
