const mockCollectionAdd = jest.fn().mockResolvedValue({ id: "log1" });
const mockCollectionGet = jest.fn();
const mockWhere = jest.fn().mockReturnThis();
const mockOrderBy = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockCountGet = jest.fn();
const mockGetUserByPhoneNumber = jest.fn();

const queryChain: any = { 
  where: mockWhere, 
  orderBy: mockOrderBy, 
  limit: mockLimit, 
  get: mockCollectionGet,
  count: jest.fn(() => ({ get: mockCountGet })),
};
mockWhere.mockReturnValue(queryChain);
mockLimit.mockReturnValue(queryChain);
mockOrderBy.mockReturnValue(queryChain);

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
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
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  delete: jest.fn(() => ({ _type: "FieldDelete" })),
  increment: jest.fn((n: number) => ({ _type: "Increment", value: n })),
};
const mockTimestamp = {
  now: jest.fn(() => ({ toDate: () => new Date(), _type: "Timestamp" })),
  fromMillis: jest.fn((ms: number) => ({ toDate: () => new Date(ms), _type: "Timestamp" })),
  fromDate: jest.fn((d: Date) => ({ toDate: () => d, _type: "Timestamp" })),
};
const mockFirestore = jest.fn(() => ({
  collection: jest.fn(() => ({
    doc: jest.fn(),
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
    get: mockCollectionGet,
    add: mockCollectionAdd,
    count: jest.fn(() => ({ get: mockCountGet })),
  })),
})) as any;
mockFirestore.FieldValue = mockFieldValue;
mockFirestore.Timestamp = mockTimestamp;

(mockFirestore as any).FieldValue = mockFieldValue;
(mockFirestore as any).Timestamp = mockTimestamp;

jest.mock("firebase-admin", () => ({
  apps: [{ name: "test" }],
  initializeApp: jest.fn(),
  firestore: mockFirestore,
  auth: jest.fn(() => ({
    getUserByPhoneNumber: mockGetUserByPhoneNumber,
  })),
}));

jest.mock("../../src/_db", () => ({
  db: jest.fn(() => ({
    collection: jest.fn((name: string) => ({
      doc: jest.fn(),
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
      get: mockCollectionGet,
      add: mockCollectionAdd,
      count: jest.fn(() => ({ get: mockCountGet })),
    })),
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCollectionAdd.mockResolvedValue({ id: "log1" });
  mockCountGet.mockResolvedValue({ data: () => ({ count: 1 }) });
  mockWhere.mockReturnValue(queryChain);
  mockLimit.mockReturnValue(queryChain);
  mockOrderBy.mockReturnValue(queryChain);
  mockGetUserByPhoneNumber.mockRejectedValue({ code: "auth/user-not-found" });
});

import { canSendSmsOtp, logVerificationFailure } from "../../src/auth/anti-abuse";
import { checkRateLimit } from "../../src/middleware/rate-limiter";

const makeRequest = (overrides: any = {}) => ({
  auth: overrides.auth === undefined ? { uid: "user1", token: {} } : overrides.auth,
  data: { phone: "+5511999999999", reason: "invalid_format", stage: "phone", ...overrides.data },
  app: { appId: "test-app", token: "test-token" },
  rawRequest: { ip: "127.0.0.1", headers: { "x-forwarded-for": "192.168.1.1" }, ...overrides.rawRequest },
});

describe("Auth — Anti Abuse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollectionAdd.mockResolvedValue({ id: "log1" });
    mockCountGet.mockResolvedValue({ data: () => ({ count: 1 }) });
    mockGetUserByPhoneNumber.mockRejectedValue({ code: "auth/user-not-found" });
  });

  describe("canSendSmsOtp", () => {
    it("permite envio quando dentro do rate limit", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: new Date(Date.now() + 3600000) });

      const result = await canSendSmsOtp(makeRequest());

      expect(result.allowed).toBe(true);
    });

    it("bloqueia telefone ja vinculado a outro usuario antes do rate limit", async () => {
      mockGetUserByPhoneNumber.mockResolvedValueOnce({ uid: "other-user" });

      const result = await canSendSmsOtp(makeRequest());

      expect(result).toEqual({
        allowed: false,
        reason: "duplicate_phone",
      });
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it("permite telefone ja vinculado ao mesmo usuario sem reenviar SMS", async () => {
      mockGetUserByPhoneNumber.mockResolvedValueOnce({ uid: "user1" });

      const result = await canSendSmsOtp(makeRequest());

      expect(result).toEqual({
        allowed: true,
        alreadyLinked: true,
      });
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it("usa limites de SMS que permitem recuperacao de onboarding sem liberar abuso", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 11, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 5, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 29, resetAt: new Date(Date.now() + 3600000) });

      await canSendSmsOtp(makeRequest());

      expect(checkRateLimit).toHaveBeenNthCalledWith(
        1,
        "user1",
        expect.objectContaining({
          keyPrefix: "sms_caller",
          maxRequests: 12,
          windowMs: 60 * 60 * 1000,
        }),
      );
      expect(checkRateLimit).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          keyPrefix: "sms_phone",
          maxRequests: 6,
          windowMs: 60 * 60 * 1000,
        }),
      );
      expect(checkRateLimit).toHaveBeenNthCalledWith(
        3,
        "192.168.1.1",
        expect.objectContaining({
          keyPrefix: "sms_ip",
          maxRequests: 30,
          windowMs: 60 * 60 * 1000,
        }),
      );
    });

    it("bloqueia quando rate limit por phone excedido", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date(Date.now() + 3600000) });

      const result = await canSendSmsOtp(makeRequest());

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("phone_rate_limit");
    });

    it("bloqueia quando rate limit por IP excedido", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date(Date.now() + 3600000) });

      const result = await canSendSmsOtp(makeRequest());

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ip_rate_limit");
    });

    it("rejeita phone invalido", async () => {
      await expect(
        canSendSmsOtp(makeRequest({ data: { phone: "11999999999" } })),
      ).rejects.toThrow();
    });

    it("rejeita sem autenticacao", async () => {
      await expect(
        canSendSmsOtp(makeRequest({ auth: null })),
      ).rejects.toThrow();
    });

    it("extrai penultimo IP valido de cadeia XFF com 2 hops", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: new Date(Date.now() + 3600000) });

      await canSendSmsOtp(makeRequest({
        rawRequest: { ip: "10.0.0.1", headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } },
      }));

      expect(checkRateLimit).toHaveBeenCalledWith(
        "203.0.113.5",
        expect.objectContaining({ keyPrefix: "sms_ip" }),
      );
    });

    it("ignora 1º hop forjado pelo atacante em cadeia XFF com 3+ hops", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: new Date(Date.now() + 3600000) });

      // Atacante injeta "1.2.3.4" como primeiro hop para burlar o rate limit.
      // O GFE acrescenta: "203.0.113.5" (cliente real) e "10.0.0.1" (LB).
      await canSendSmsOtp(makeRequest({
        rawRequest: {
          ip: "10.0.0.1",
          headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.5, 10.0.0.1" },
        },
      }));

      expect(checkRateLimit).toHaveBeenCalledWith(
        "203.0.113.5",
        expect.objectContaining({ keyPrefix: "sms_ip" }),
      );

      // Garante que o IP forjado "1.2.3.4" NÃO foi usado para o bucket sms_ip
      const ipBucketCall = (checkRateLimit as jest.Mock).mock.calls.find(
        (call) => call[1]?.keyPrefix === "sms_ip",
      );
      expect(ipBucketCall?.[0]).not.toBe("1.2.3.4");
    });

    // FIX #2479: cadeia XFF com lixo forjado no 1º hop não polui audit logs.
    it("rejeita IP malformado/lixo no 1º hop e usa hop confiável", async () => {
      (checkRateLimit as jest.Mock)
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 2, resetAt: new Date(Date.now() + 3600000) })
        .mockResolvedValueOnce({ allowed: true, remaining: 9, resetAt: new Date(Date.now() + 3600000) });

      // Atacante coloca lixo no 1º hop para tentar poluir logs.
      await canSendSmsOtp(makeRequest({
        rawRequest: {
          ip: "10.0.0.1",
          headers: { "x-forwarded-for": "lixo-forjado, 203.0.113.5, 10.0.0.1" },
        },
      }));

      expect(checkRateLimit).toHaveBeenCalledWith(
        "203.0.113.5",
        expect.objectContaining({ keyPrefix: "sms_ip" }),
      );
    });
  });

  describe("logVerificationFailure", () => {
    it("audita falha de verificacao com sucesso", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: true, remaining: 19, resetAt: new Date(Date.now() + 3600000) });
      mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 1 }) });

      const result = await logVerificationFailure(makeRequest());

      expect(result.logged).toBe(true);
      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: "user1",
          stage: "phone",
          reason: "invalid_format",
        }),
      );
    });

    it("rejeita sem autenticacao", async () => {
      await expect(
        logVerificationFailure(makeRequest({ auth: null })),
      ).rejects.toThrow();
    });

    it("rejeita valores invalidos para reason e stage", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: true, remaining: 19, resetAt: new Date(Date.now() + 3600000) });

      await expect(
        logVerificationFailure(makeRequest({ data: { reason: "invalid", stage: "invalid" } })),
      ).rejects.toThrow();
    });

    it("registra audit_log quando >5 falhas em 1h", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: true, remaining: 19, resetAt: new Date(Date.now() + 3600000) });
      mockCountGet.mockResolvedValueOnce({ data: () => ({ count: 6 }) });

      await logVerificationFailure(makeRequest());

      expect(mockCollectionAdd).toHaveBeenCalledWith(
        expect.objectContaining({ type: "VERIFICATION_ABUSE_DETECTED" }),
      );
    });

    it("respeita rate limit de log de falhas", async () => {
      (checkRateLimit as jest.Mock).mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date(Date.now() + 3600000) });

      await expect(
        logVerificationFailure(makeRequest()),
      ).rejects.toThrow();
    });
  });
});
