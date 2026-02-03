/**
 * TESTES DE CUSTOM CLAIMS
 *
 * Testa as Cloud Functions de custom-claims.ts:
 * - setUserRole: Validação de permissão, role e sincronização
 * - onNewUserCreated: Definição de role padrão ao criar usuário
 * - migrateAllUsersToCustomClaims: Migração em lote
 */

// Mock firebase-admin
const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockCollectionAdd = jest.fn().mockResolvedValue({ id: "audit_log_1" });
const mockDoc = jest.fn().mockReturnValue({
  get: mockDocGet,
  update: mockDocUpdate,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
  add: mockCollectionAdd,
  limit: jest.fn().mockReturnThis(),
  startAfter: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
});

jest.mock("firebase-admin", () => {
  const mockAdmin: any = {
    apps: [{ name: "test" }],
    firestore: jest.fn(() => ({
      collection: mockCollection,
    })),
    auth: jest.fn(() => ({
      setCustomUserClaims: mockSetCustomUserClaims,
    })),
    initializeApp: jest.fn(),
  };

  mockAdmin.firestore.FieldValue = {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  };
  mockAdmin.firestore.Timestamp = {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
    now: jest.fn(() => ({ toDate: () => new Date() })),
  };

  return mockAdmin;
});

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _type: "ServerTimestamp" })),
  },
}));

// Capturar handlers
let setUserRoleHandler: ((request: any) => Promise<any>) | null = null;
let onNewUserCreatedHandler: ((event: any) => Promise<void>) | null = null;
let migrateHandler: ((request: any) => Promise<any>) | null = null;

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((configOrHandler: any, handler?: any) => {
    const actualHandler = handler || configOrHandler;
    // Diferenciar pelo contexto de chamada
    if (!setUserRoleHandler) {
      setUserRoleHandler = actualHandler;
    } else {
      migrateHandler = actualHandler;
    }
    return actualHandler;
  }),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "HttpsError";
    }
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((path: string, handler: any) => {
    onNewUserCreatedHandler = handler;
    return handler;
  }),
}));

describe("Custom Claims - setUserRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUserRoleHandler = null;
    onNewUserCreatedHandler = null;
    migrateHandler = null;

    jest.isolateModules(() => {
      require("../src/auth/custom-claims");
    });
  });

  test("deve registrar o handler setUserRole", () => {
    expect(setUserRoleHandler).not.toBeNull();
    expect(typeof setUserRoleHandler).toBe("function");
  });

  test("deve rejeitar request sem autenticação", async () => {
    const request = {
      auth: null,
      data: { uid: "user1", role: "ADMIN" },
    };

    await expect(setUserRoleHandler!(request)).rejects.toThrow(
      "User must be authenticated"
    );
  });

  test("deve rejeitar quando caller não é ADMIN (sem claim e sem Firestore role)", async () => {
    // Caller não tem claim de ADMIN
    const request = {
      auth: {
        uid: "caller1",
        token: { role: "PLAYER" },
      },
      data: { uid: "target1", role: "ADMIN" },
    };

    // Mock Firestore - caller também não é ADMIN no Firestore
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "PLAYER" }),
    });

    await expect(setUserRoleHandler!(request)).rejects.toThrow(
      "Only administrators can change user roles"
    );
  });

  test("deve permitir quando caller é ADMIN via Custom Claims", async () => {
    const request = {
      auth: {
        uid: "admin1",
        token: { role: "ADMIN" },
      },
      data: { uid: "target1", role: "FIELD_OWNER" },
      rawRequest: { ip: "127.0.0.1" },
    };

    // Mock target user exists
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "PLAYER" }),
    });

    const result = await setUserRoleHandler!(request);

    expect(result.success).toBe(true);
    expect(result.uid).toBe("target1");
    expect(result.role).toBe("FIELD_OWNER");
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("target1", {
      role: "FIELD_OWNER",
    });
  });

  test("deve permitir quando caller é ADMIN via Firestore (fallback)", async () => {
    const request = {
      auth: {
        uid: "admin2",
        token: { role: undefined }, // Sem Custom Claim
      },
      data: { uid: "target2", role: "PLAYER" },
      rawRequest: { ip: "10.0.0.1" },
    };

    // Mock Firestore - caller é ADMIN
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "ADMIN" }),
      })
      // Mock target user exists
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "FIELD_OWNER" }),
      });

    const result = await setUserRoleHandler!(request);
    expect(result.success).toBe(true);
  });

  test("deve rejeitar uid inválido", async () => {
    const request = {
      auth: {
        uid: "admin1",
        token: { role: "ADMIN" },
      },
      data: { uid: "", role: "PLAYER" },
    };

    await expect(setUserRoleHandler!(request)).rejects.toThrow(
      "uid must be a non-empty string"
    );
  });

  test("deve rejeitar role inválido", async () => {
    const request = {
      auth: {
        uid: "admin1",
        token: { role: "ADMIN" },
      },
      data: { uid: "target1", role: "SUPER_ADMIN" },
    };

    await expect(setUserRoleHandler!(request)).rejects.toThrow(
      "role must be one of"
    );
  });

  test("deve rejeitar quando target user não existe", async () => {
    const request = {
      auth: {
        uid: "admin1",
        token: { role: "ADMIN" },
      },
      data: { uid: "nonexistent", role: "PLAYER" },
    };

    mockDocGet.mockResolvedValueOnce({
      exists: false,
      data: () => null,
    });

    await expect(setUserRoleHandler!(request)).rejects.toThrow(
      "not found"
    );
  });

  test("deve aceitar roles válidos: ADMIN, FIELD_OWNER, PLAYER", async () => {
    const validRoles = ["ADMIN", "FIELD_OWNER", "PLAYER"];

    for (const role of validRoles) {
      jest.clearAllMocks();

      const request = {
        auth: {
          uid: "admin1",
          token: { role: "ADMIN" },
        },
        data: { uid: "target1", role },
        rawRequest: { ip: "127.0.0.1" },
      };

      mockDocGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "PLAYER" }),
      });

      const result = await setUserRoleHandler!(request);
      expect(result.success).toBe(true);
      expect(result.role).toBe(role);
    }
  });
});

describe("Custom Claims - onNewUserCreated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUserRoleHandler = null;
    onNewUserCreatedHandler = null;
    migrateHandler = null;

    jest.isolateModules(() => {
      require("../src/auth/custom-claims");
    });
  });

  test("deve registrar o handler onDocumentCreated", () => {
    expect(onNewUserCreatedHandler).not.toBeNull();
    expect(typeof onNewUserCreatedHandler).toBe("function");
  });

  test("deve definir role padrão PLAYER para novo usuário", async () => {
    const event = {
      params: { userId: "new_user_1" },
      data: {
        data: () => ({ role: undefined, name: "Test User" }),
      },
    };

    await onNewUserCreatedHandler!(event);

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("new_user_1", {
      role: "PLAYER",
    });
  });

  test("deve usar role do documento quando disponível", async () => {
    const event = {
      params: { userId: "admin_user" },
      data: {
        data: () => ({ role: "ADMIN", name: "Admin" }),
      },
    };

    await onNewUserCreatedHandler!(event);

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("admin_user", {
      role: "ADMIN",
    });
  });

  test("deve ignorar quando event.data é null", async () => {
    const event = {
      params: { userId: "no_data_user" },
      data: null,
    };

    await onNewUserCreatedHandler!(event);

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  test("não deve propagar erro de Auth (non-critical)", async () => {
    mockSetCustomUserClaims.mockRejectedValueOnce(
      new Error("Auth service unavailable")
    );

    const event = {
      params: { userId: "error_user" },
      data: {
        data: () => ({ name: "Error User" }),
      },
    };

    // Não deve lançar exceção
    await expect(onNewUserCreatedHandler!(event)).resolves.not.toThrow();
  });
});

describe("Custom Claims - migrateAllUsersToCustomClaims", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUserRoleHandler = null;
    onNewUserCreatedHandler = null;
    migrateHandler = null;

    jest.isolateModules(() => {
      require("../src/auth/custom-claims");
    });
  });

  test("deve registrar o handler de migração", () => {
    expect(migrateHandler).not.toBeNull();
    expect(typeof migrateHandler).toBe("function");
  });

  test("deve rejeitar request sem autenticação", async () => {
    const request = {
      auth: null,
    };

    await expect(migrateHandler!(request)).rejects.toThrow(
      "Authentication required"
    );
  });

  test("deve rejeitar quando caller não é ADMIN", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ role: "PLAYER" }),
    });

    const request = {
      auth: { uid: "player1" },
    };

    await expect(migrateHandler!(request)).rejects.toThrow(
      "Admin access required"
    );
  });
});
