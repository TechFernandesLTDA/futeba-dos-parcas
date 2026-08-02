const mockGetUser = jest.fn();
const mockSetCustomUserClaims = jest.fn();
const mockRevokeRefreshTokens = jest.fn();
const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockRunTransaction = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 4, resetAt: new Date(Date.now() + 3600000) }),
}));

jest.mock("../../src/validation/cpf", () => ({
  hashCpf: jest.fn((cpf: string, salt: string) => `hash_${cpf}`),
  isValidCpf: jest.fn((cpf: string) => cpf === "529.982.247-25" || cpf === "11144477735"),
  maskCpf: jest.fn((cpf: string) => "***.247.25"),
}));

jest.mock("../../src/validation/phone-identity", () => ({
  hashPhoneIdentity: jest.fn(() => "phone_hash"),
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
    where: mockWhere,
    limit: mockLimit,
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
    mockRunTransaction.mockImplementation(async (cb: any) => cb({
      get: jest.fn()
        .mockResolvedValueOnce({exists: false, data: () => null})
        .mockResolvedValueOnce({docs: []}),
      set: jest.fn(),
    }));
    mockWhere.mockReturnThis();
    mockLimit.mockReturnThis();
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
            .mockResolvedValueOnce({ exists: false, data: () => null })
            .mockResolvedValueOnce({docs: []}),
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
            .mockResolvedValueOnce({ exists: true, data: () => ({ uid: "outro_user" }) })
            .mockResolvedValueOnce({exists: false, data: () => null})
            .mockResolvedValueOnce({docs: []}),
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
            .mockResolvedValueOnce({ exists: true, data: () => ({ cpfHash: "hash_11144477735" }) })
            .mockResolvedValueOnce({docs: [{id: "hash_11144477735"}]}),
          set: jest.fn(),
        };
        return cb(tx);
      });

      await expect(
        verifyCpf(makeRequest()),
      ).rejects.toThrow();
    });

    it("bloqueia segundo CPF quando legado existe apenas em cpf_index", async () => {
      mockRunTransaction.mockImplementationOnce(async (cb: any) => cb({
        get: jest.fn()
          .mockResolvedValueOnce({exists: false, data: () => null})
          .mockResolvedValueOnce({exists: true, data: () => ({})})
          .mockResolvedValueOnce({docs: [{id: "legacy_cpf_hash"}]}),
        set: jest.fn(),
      }));

      await expect(verifyCpf(makeRequest())).rejects.toThrow();
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
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      mockSetCustomUserClaims.mockResolvedValueOnce(undefined);

      const result = await setUserVerified(makeRequest());

      expect(result.success).toBe(true);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({ verified: true, profileComplete: true }),
      );
      expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    });

    it("retorna alreadyVerified quando usuario ja verificado", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ cpfVerifiedAt: { _type: "ServerTimestamp" } }),
      });
      mockGetUser.mockResolvedValue({
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
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: null,
        customClaims: {},
      });

      await expect(
        setUserVerified(makeRequest()),
      ).rejects.toThrow();
    });

    it("bloqueia telefone indexado para outra identidade", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({cpfVerifiedAt: {_type: "ServerTimestamp"}}),
      });
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      mockRunTransaction.mockImplementationOnce(async (cb: any) => cb({
        get: jest.fn()
          .mockResolvedValueOnce({
            exists: true,
            data: () => ({uid: "other-user"}),
          })
          .mockResolvedValueOnce({docs: []}),
        set: jest.fn(),
      }));

      await expect(setUserVerified(makeRequest())).rejects.toThrow(
        "Este telefone já pertence a outra identidade.",
      );
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    it("remove índice antigo do mesmo usuário ao trocar de telefone", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          cpfVerifiedAt: {_type: "ServerTimestamp"},
          phoneHash: "old_phone_hash",
        }),
      });
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      const txDelete = jest.fn();
      mockRunTransaction.mockImplementationOnce(async (cb: any) => cb({
        get: jest.fn()
          .mockResolvedValueOnce({exists: false, data: () => null})
          .mockResolvedValueOnce({docs: [{id: "old_phone_hash"}]})
          .mockResolvedValueOnce({exists: true, data: () => ({uid: "user1"})}),
        set: jest.fn(),
        delete: txDelete,
      }));

      await setUserVerified(makeRequest());

      expect(txDelete).toHaveBeenCalledTimes(1);
    });

    it("reconcilia índice legado mesmo sem phoneHash em users_private", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({cpfVerifiedAt: {_type: "ServerTimestamp"}}),
      });
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      const txDelete = jest.fn();
      mockRunTransaction.mockImplementationOnce(async (cb: any) => cb({
        get: jest.fn()
          .mockResolvedValueOnce({exists: false, data: () => null})
          .mockResolvedValueOnce({docs: [{id: "legacy_phone_hash"}]})
          .mockResolvedValueOnce({exists: true, data: () => ({uid: "user1"})}),
        set: jest.fn(),
        delete: txDelete,
      }));

      await setUserVerified(makeRequest());

      expect(txDelete).toHaveBeenCalledTimes(1);
    });

    // #3935: setUserVerified NÃO deve gravar `phone` (E.164 em plaintext) em
    // users/{uid}. Antes, reconcilePhoneIdentity gravava `phone: phoneNumber`,
    // que é exatamente o guard que torna TODO usuário verificado ilegível aos
    // pares (escalção, ranking, perfil). O telefone canônico vive em
    // users_private.phoneNumber + Firebase Auth.
    it("#3935 não grava phone em users/{uid} (mantém peer-readability)", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({cpfVerifiedAt: {_type: "ServerTimestamp"}}),
      });
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      const txSet = jest.fn();
      mockRunTransaction.mockImplementationOnce(async (cb: any) => cb({
        get: jest.fn()
          .mockResolvedValueOnce({exists: false, data: () => null})
          .mockResolvedValueOnce({docs: []}),
        set: txSet,
      }));
      mockSetCustomUserClaims.mockResolvedValueOnce(undefined);

      await setUserVerified(makeRequest());

      // Nenhum tx.set deve conter a chave `phone` no payload de dados.
      // (phoneNumber/phoneHash/phone_verified são chaves distintas e OK.)
      const phoneWrites = txSet.mock.calls.filter(
        ([, data]: any[]) => data && typeof data === "object" && "phone" in data,
      );
      expect(phoneWrites).toHaveLength(0);
    });

    it("não concede profileComplete para telefone fora do formato BR", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({cpfVerifiedAt: {_type: "ServerTimestamp"}}),
      });
      mockGetUser.mockResolvedValue({
        uid: "user1",
        phoneNumber: "+12025550123",
        customClaims: {},
      });

      await setUserVerified(makeRequest());

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(
        "user1",
        expect.objectContaining({verified: true, profileComplete: false}),
      );
    });

    it("preserva claims relidas após reconciliação concorrente", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({cpfVerifiedAt: {_type: "ServerTimestamp"}}),
      });
      mockGetUser
        .mockResolvedValueOnce({
          uid: "user1",
          phoneNumber: "+5511999999999",
          customClaims: {role: "PLAYER"},
        })
        .mockResolvedValueOnce({
          uid: "user1",
          phoneNumber: "+5511999999999",
          customClaims: {role: "ADMIN", concurrent: true},
        });

      await setUserVerified(makeRequest());

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
        role: "ADMIN",
        concurrent: true,
        verified: true,
        profileComplete: true,
      });
    });

    it("aborta quando telefone muda durante a reconciliação", async () => {
      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({cpfVerifiedAt: {_type: "ServerTimestamp"}}),
      });
      mockGetUser
        .mockResolvedValueOnce({
          uid: "user1",
          phoneNumber: "+5511999999999",
          customClaims: {},
        })
        .mockResolvedValueOnce({
          uid: "user1",
          phoneNumber: "+5511888888888",
          customClaims: {},
        });

      await expect(setUserVerified(makeRequest()))
        .rejects.toThrow("telefone mudou");
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
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
      mockGetUser
        .mockResolvedValueOnce({
          uid: "admin1",
          customClaims: {role: "ADMIN"},
        })
        .mockResolvedValue({
        uid: "user2",
        phoneNumber: "+5511999999999",
        customClaims: {},
      });
      mockSetCustomUserClaims.mockResolvedValueOnce(undefined);

      const result = await setUserVerified(makeRequest({
        auth: { uid: "admin1", token: { role: "ADMIN" } },
        data: { uid: "user2" },
      }));

      expect(result.success).toBe(true);
    });
  });
});
