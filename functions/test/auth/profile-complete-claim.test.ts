const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockGetUser = jest.fn();
const mockDocGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({
  get: mockDocGet,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
});

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    getUser: mockGetUser,
    setCustomUserClaims: mockSetCustomUserClaims,
  })),
  firestore: jest.fn(() => ({
    collection: mockCollection,
  })),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
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
    mockGetUser.mockResolvedValue({customClaims: {}});
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({cpfVerifiedAt: {seconds: 1}, phone: validPhone}),
    });
    loadModule();
  });

  test("computeProfileComplete valida cpfVerifiedAt e telefone BR", () => {
    const {computeProfileComplete} = loadModule();

    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
      phone: validPhone,
    })).toBe(true);
    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
      phone: "(41) 99999-9999",
    })).toBe(true);
    expect(computeProfileComplete({
      cpfVerifiedAt: {seconds: 1},
      phone: "+55 41 88888-8888",
    })).toBe(false);
    expect(computeProfileComplete({
      phone: validPhone,
    })).toBe(false);
  });

  test("trigger seta claim true preservando role", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {role: "ADMIN"},
    });

    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone},
      {phone: validPhone}
    ));

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
      role: "ADMIN",
      profileComplete: true,
    });
  });

  test("trigger unseta claim quando telefone fica invalido", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {
        role: "FIELD_OWNER",
        profileComplete: true,
      },
    });

    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}, phone: ""},
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone}
    ));

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user1", {
      role: "FIELD_OWNER",
      profileComplete: false,
    });
  });

  test("trigger eh idempotente quando valor nao muda", async () => {
    mockGetUser.mockResolvedValue({
      customClaims: {
        role: "PLAYER",
        profileComplete: true,
      },
    });

    await onUserProfileWrittenHandler!(userWriteEvent(
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone},
      {cpfVerifiedAt: {seconds: 1}, phone: validPhone}
    ));

    expect(mockSetCustomUserClaims).not.toHaveBeenCalled();
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
  });

  test("callable rejeita usuario nao autenticado", async () => {
    await expect(
      recomputeMyProfileClaimHandler!({auth: null})
    ).rejects.toMatchObject({code: "unauthenticated"});
  });
});
