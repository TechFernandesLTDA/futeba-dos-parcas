const mockAuditAdd = jest.fn().mockResolvedValue({id: "audit-1"});

jest.mock("firebase-functions", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((config: unknown, handler: unknown) => ({
    config,
    handler,
  })),
  HttpsError: class HttpsError extends Error {
    code: string;
    details?: unknown;

    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
      this.name = "HttpsError";
    }
  },
}));

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      add: mockAuditAdd,
    })),
  })),
  auth: jest.fn(() => ({
    getUser: jest.fn(),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({_type: "ServerTimestamp"})),
  },
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn(),
  checkRateLimitByIp: jest.fn(),
}));

jest.mock("../src/auth/anti-abuse", () => ({
  clientIp: jest.fn(() => "127.0.0.1"),
}));

import {secureCallable} from "../src/middleware/secure-callable-wrapper";

type CallableUnderTest = {
  config: {
    enforceAppCheck: boolean;
    consumeAppCheckToken: boolean;
  };
  handler: (request: Record<string, unknown>) => Promise<unknown>;
};

describe("secureCallable App Check token consumption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("bloqueia replay quando consumo de token App Check esta ativo", async () => {
    const callable = secureCallable(
      {
        appCheck: true,
        requireAuth: false,
        enableAuditLog: false,
      },
      async () => ({ok: true})
    ) as unknown as CallableUnderTest;

    expect(callable.config).toMatchObject({
      enforceAppCheck: true,
      consumeAppCheckToken: true,
    });

    await expect(callable.handler({
      app: {alreadyConsumed: true},
      rawRequest: {ip: "127.0.0.1"},
    })).rejects.toMatchObject({
      code: "failed-precondition",
      message: "App Check token already consumed. Possible replay.",
    });

    expect(mockAuditAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "APP_CHECK_REPLAY",
        status: "BLOCKED",
      })
    );
  });

  it("permite leitura idempotente com App Check sem consumir token", async () => {
    const handler = jest.fn().mockResolvedValue({ok: true});
    const callable = secureCallable(
      {
        appCheck: true,
        consumeAppCheckToken: false,
        requireAuth: false,
        enableAuditLog: false,
      },
      handler
    ) as unknown as CallableUnderTest;

    expect(callable.config).toMatchObject({
      enforceAppCheck: true,
      consumeAppCheckToken: false,
    });

    await expect(callable.handler({
      app: {alreadyConsumed: true},
      rawRequest: {ip: "127.0.0.1"},
    })).resolves.toEqual({ok: true});
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
