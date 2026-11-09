const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockRevokeRefreshTokens = jest.fn().mockResolvedValue(undefined);
const mockGetUser = jest.fn();
const mockDocGet = jest.fn();
const mockCheckRateLimit = jest.fn().mockResolvedValue({
  allowed: true,
  remaining: 10,
  resetAt: new Date(Date.now() + 60000),
});
const mockDoc = jest.fn().mockReturnValue({
  get: mockDocGet,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
});
// Leitura do doc de contas de revisão (admin.firestore().doc(path)). Mock
// separado do users/{uid} para a config não ser respondida com o perfil.
const mockConfigDocGet = jest.fn();
const mockConfigDoc = jest.fn().mockReturnValue({
  get: mockConfigDocGet,
});

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
    revokeRefreshTokens: mockRevokeRefreshTokens,
  })),
  firestore: jest.fn(() => ({
    collection: mockCollection,
    doc: mockConfigDoc,
  })),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
  RATE_LIMITS: {
    DEFAULT: { maxRequests: 10, windowMs: 60000 },
    BATCH_OPERATION: { maxRequests: 5, windowMs: 60000, keyPrefix: "batch" },
  },
}));

let onUserProfileWrittenHandler:
  ((event: any) => Promise<void>) | null = null;
let recomputeMyProfileClaimHandler:
  ((request: any) => Promise<any>) | null = null;

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((config: unknown, handler: any) => {
    onUserProfileWrittenHandler = handler;
    return handler;
  }),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((config: unknown, handler: any) => {
    recomputeMyProfileClaimHandler = handler;
    return handler;
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

const validCpf = "529.982.247-25";
const validPhone = "+55 41 99999-9999";

function loadModule() {
  let moduleExports: any;
  jest.isolateModules(() => {
    moduleExports = require("../../src/auth/profile-complete-claim");
  });
  return moduleExports;
}

function userWriteEvent(
  after: Record<string, unknown> | undefined,
  before?: Record<string, unknown> | undefined
) {
  return {
    params: {uid: "user1"},
    data: {
      before: {
        exists: before !== undefined,
        data: () => before,
      },
      after: {
        exists: after !== undefined,
        data: () => after,
      },
    },
  };
}

describe("Profile Complete Claim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onUserProfileWrittenHandler = null;
    recomputeMyProfileClaimHandler = null;
    mockGetUser.mockResolvedValue({customClaims: {}, phoneNumber: validPhone});
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetAt: new Date(Date.now() + 60000),
    });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({cpfVerifiedAt: {seconds: 1}, phone: validPhone}),
    });
    mockConfigDocGet.mockResolvedValue({exists: false, data: () => undefined});
    loadModule();
  });

  test("computeProfileComplete valida cpfVerifiedAt e telefone BR do Auth", () => {
    const {computeProfileComplete} = loadModule();

    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
    }, validPhone)).toBe(true);
    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
    }, "(41) 99999-9999")).toBe(true);
    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
    }, "+55 41 88888-8888")).toBe(false);
    expect(computeProfileComplete({
    }, validPhone)).toBe(false);
    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
      phone: validPhone,
    }, undefined)).toBe(false);
  });

  test("trigger seta claim true preservando role", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {role: "ADMIN"},
      phoneNumber: validPhone,
    });

    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone},
      {phone: validPhone}
    ));

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
      role: "ADMIN",
      profileComplete: true,
    });
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
  });

  test("trigger unseta claim quando telefone do Auth fica invalido", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {
        role: "FIELD_OWNER",
        profileComplete: true,
      },
      phoneNumber: "+55 41 88888-8888",
    });

    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}},
      {}
    ));

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
      role: "FIELD_OWNER",
      profileComplete: false,
    });
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
  });

  test("trigger eh idempotente quando valor nao muda", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {
        role: "PLAYER",
        profileComplete: true,
      },
      phoneNumber: validPhone,
    });

    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone},
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone}
    ));

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  test("trigger encerra com seguranca quando usuario do Auth foi removido", async () => {
    mockGetUser.mockRejectedValue(Object.assign(
      new Error("User not found"),
      {code: "auth/user-not-found"}
    ));

    await expect(onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}},
      {}
    ))).resolves.toBeUndefined();

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  test("trigger propaga falha transitoria para o retry do Cloud Functions", async () => {
    const transientError = Object.assign(new Error("Auth unavailable"), {
      code: "auth/internal-error",
    });
    mockGetUser.mockRejectedValue(transientError);

    await expect(onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}},
      {}
    ))).rejects.toBe(transientError);
  });

  test("trigger pula quando campos relevantes nao mudam", async () => {
    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone, displayName: "New"},
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone, displayName: "Old"}
    ));

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
  });

  test("callable recomputa claim do proprio usuario", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {
        role: "PLAYER",
        profileComplete: false,
      },
      phoneNumber: validPhone,
    });
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({cpfVerifiedAt: {seconds: 1}, phone: validPhone}),
    });

    const result = await recomputeMyProfileClaimHandler!({
      auth: {uid: "user1", token: {}},
    });

    expect(result).toEqual({
      success: true,
      profileComplete: true,
      updated: true,
    });
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
      role: "PLAYER",
      profileComplete: true,
    });
    expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
  });

  test("callable rejeita usuario nao autenticado", async () => {
    await expect(
      recomputeMyProfileClaimHandler!({auth: null})
    ).rejects.toMatchObject({code: "unauthenticated"});
  });

  test("callable respeita rate limit antes de ler o perfil", async () => {
    mockCheckRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60000),
    });

    await expect(recomputeMyProfileClaimHandler!({
      auth: {uid: "user1", token: {}},
    })).rejects.toMatchObject({code: "resource-exhausted"});
    expect(mockDocGet).not.toHaveBeenCalled();
  });

  test("callable encapsula falha transitoria inesperada como internal", async () => {
    mockGetUser.mockRejectedValue(Object.assign(new Error("Auth unavailable"), {
      code: "auth/internal-error",
    }));

    await expect(recomputeMyProfileClaimHandler!({
      auth: {uid: "user1", token: {}},
    })).rejects.toMatchObject({code: "internal"});
  });
  describe("conta de revisão da Play", () => {
    // UIDs fictícios. O UID real do revisor nunca entra no repo (público).
    const REVIEW_UID = "review-uid-test";

    function listReviewUids(uids: unknown[]) {
      mockConfigDocGet.mockResolvedValue({
        exists: true,
        data: () => ({uids}),
      });
    }

    function reviewWriteEvent(
      after: Record<string, unknown> | undefined,
      before?: Record<string, unknown> | undefined
    ) {
      const event = userWriteEvent(after, before);
      event.params.uid = REVIEW_UID;
      return event;
    }

    test("(a) callable dá verified e profileComplete ao UID listado, sem CPF/telefone", async () => {
      listReviewUids([REVIEW_UID]);
      mockGetUser.mockResolvedValue({
        customClaims: {role: "PLAYER"},
        phoneNumber: undefined,
      });
      mockDocGet.mockResolvedValue({exists: true, data: () => ({})});

      const result = await recomputeMyProfileClaimHandler!({
        auth: {uid: REVIEW_UID, token: {}},
      });

      expect(mockConfigDoc).toHaveBeenCalledWith(
        "system_config/play_review_accounts"
      );
      expect(result).toEqual({
        success: true,
        profileComplete: true,
        updated: true,
      });
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        verified: true,
        profileComplete: true,
        reviewAccount: true,
      });
      expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
    });

    test("(b) trigger não remove as claims do UID listado quando o CPF some", async () => {
      listReviewUids([REVIEW_UID]);
      mockGetUser.mockResolvedValue({
        customClaims: {
          role: "PLAYER",
          verified: true,
          profileComplete: true,
          reviewAccount: true,
        },
        phoneNumber: undefined,
      });

      // Presença de cpfVerifiedAt muda (antes tinha, depois não): o trigger
      // não sai cedo e chega ao cálculo da claim.
      await onUserProfileWrittenHandler!(reviewWriteEvent(
        {},
        {cpfVerifiedAt: {seconds: 1}}
      ));

      expect(mockGetUser).toHaveBeenCalledWith(REVIEW_UID);
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });

    test("(b) trigger restaura as claims do UID listado se alguém as baixou", async () => {
      listReviewUids(["outro-uid-test", REVIEW_UID]);
      mockGetUser.mockResolvedValue({
        customClaims: {role: "PLAYER", profileComplete: false},
        phoneNumber: undefined,
      });

      await onUserProfileWrittenHandler!(reviewWriteEvent(
        {cpfVerifiedAt: {seconds: 1}},
        {}
      ));

      expect(mockSetCustomUserClaims).toHaveBeenCalledTimes(1);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        verified: true,
        profileComplete: true,
        reviewAccount: true,
      });
    });

    test("(c) UID não listado segue a regra antiga, mesmo com a lista preenchida", async () => {
      listReviewUids([REVIEW_UID]);
      mockGetUser.mockResolvedValue({
        customClaims: {role: "PLAYER", profileComplete: true},
        phoneNumber: undefined,
      });

      await onUserProfileWrittenHandler!(userWriteEvent(
        {},
        {cpfVerifiedAt: {seconds: 1}}
      ));

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
        role: "PLAYER",
        profileComplete: false,
      });
      expect(mockSetCustomUserClaims.mock.calls[0][1]).not.toHaveProperty(
        "verified"
      );
    });

    test("(c) lista malformada não libera ninguém", async () => {
      mockConfigDocGet.mockResolvedValue({
        exists: true,
        data: () => ({uids: REVIEW_UID}),
      });
      mockGetUser.mockResolvedValue({
        customClaims: {role: "PLAYER"},
        phoneNumber: undefined,
      });
      mockDocGet.mockResolvedValue({exists: true, data: () => ({})});

      const result = await recomputeMyProfileClaimHandler!({
        auth: {uid: REVIEW_UID, token: {}},
      });

      expect(result.profileComplete).toBe(false);
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        profileComplete: false,
      });
    });

    const designatedClaims = {
      role: "PLAYER",
      verified: true,
      profileComplete: true,
      reviewAccount: true,
    };

    test("remoção: trigger volta à regra normal, retira verified e revoga tokens", async () => {
      listReviewUids(["outro-uid-test"]);
      mockGetUser.mockResolvedValue({
        customClaims: designatedClaims,
        phoneNumber: undefined,
      });

      await onUserProfileWrittenHandler!(reviewWriteEvent(
        {},
        {cpfVerifiedAt: {seconds: 1}}
      ));

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        profileComplete: false,
      });
      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith(REVIEW_UID);
    });

    test("remoção: callable retira as claims mesmo sem mudança no perfil", async () => {
      // Documento de config ausente = lista vazia.
      mockGetUser.mockResolvedValue({
        customClaims: designatedClaims,
        phoneNumber: undefined,
      });
      mockDocGet.mockResolvedValue({exists: true, data: () => ({})});

      const result = await recomputeMyProfileClaimHandler!({
        auth: {uid: REVIEW_UID, token: {}},
      });

      expect(result).toEqual({
        success: true,
        profileComplete: false,
        updated: true,
      });
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        profileComplete: false,
      });
      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith(REVIEW_UID);
    });

    test("remoção: conta com verificação real (CPF + telefone) mantém verified", async () => {
      mockGetUser.mockResolvedValue({
        customClaims: designatedClaims,
        phoneNumber: validPhone,
      });

      await onUserProfileWrittenHandler!(reviewWriteEvent(
        {cpfVerifiedAt: {seconds: 1}},
        {}
      ));

      expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
        role: "PLAYER",
        verified: true,
        profileComplete: true,
      });
    });

    describe("revokeRemovedReviewAccount (script)", () => {
      test("UID ainda listado não é tocado", async () => {
        const {revokeRemovedReviewAccount} = loadModule();
        await expect(revokeRemovedReviewAccount(
          REVIEW_UID, new Set([REVIEW_UID]), true
        )).resolves.toBe("still-listed");
        expect(mockGetUser).not.toHaveBeenCalled();
      });

      test("conta sem a marca não é tocada", async () => {
        const {revokeRemovedReviewAccount} = loadModule();
        mockGetUser.mockResolvedValue({
          customClaims: {role: "PLAYER", verified: true, profileComplete: true},
          phoneNumber: validPhone,
        });
        await expect(revokeRemovedReviewAccount(
          REVIEW_UID, new Set(), true
        )).resolves.toBe("not-marked");
        expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
      });

      test("dry-run não grava nem revoga", async () => {
        const {revokeRemovedReviewAccount} = loadModule();
        mockGetUser.mockResolvedValue({customClaims: designatedClaims});
        await expect(revokeRemovedReviewAccount(
          REVIEW_UID, new Set(), false
        )).resolves.toBe("would-revoke");
        expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
        expect(mockRevokeRefreshTokens).not.toHaveBeenCalled();
      });

      test("execute retira as claims da designação e revoga tokens", async () => {
        const {revokeRemovedReviewAccount} = loadModule();
        mockGetUser.mockResolvedValue({
          customClaims: designatedClaims,
          phoneNumber: undefined,
        });
        mockDocGet.mockResolvedValue({exists: true, data: () => ({})});
        await expect(revokeRemovedReviewAccount(
          REVIEW_UID, new Set(), true
        )).resolves.toBe("revoked");
        expect(mockSetCustomUserClaims).toHaveBeenCalledWith(REVIEW_UID, {
          role: "PLAYER",
          profileComplete: false,
        });
        expect(mockRevokeRefreshTokens).toHaveBeenCalledWith(REVIEW_UID);
      });
    });

    test("trigger propaga falha ao ler a lista (retry) em vez de rebaixar a claim", async () => {
      const readError = new Error("Firestore unavailable");
      mockConfigDocGet.mockRejectedValue(readError);
      mockGetUser.mockResolvedValue({
        customClaims: {role: "PLAYER", verified: true, profileComplete: true},
        phoneNumber: undefined,
      });

      await expect(onUserProfileWrittenHandler!(reviewWriteEvent(
        {},
        {cpfVerifiedAt: {seconds: 1}}
      ))).rejects.toBe(readError);
      expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
    });
  });
});
