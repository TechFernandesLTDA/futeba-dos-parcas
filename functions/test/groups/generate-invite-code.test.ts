process.env.FUNCTIONS_EMULATOR = "true";

const store = new Map<string, Record<string, unknown>>();
const mockRandomInt = jest.fn();
const mockCheckRateLimit = jest.fn().mockResolvedValue({allowed: true});

function snap(path: string) {
  const data = store.get(path);
  return {
    exists: data !== undefined,
    id: path.split("/").pop(),
    data: () => data,
  };
}

function docRef(path: string) {
  return {
    path,
    id: path.split("/").pop(),
    get: jest.fn(async () => snap(path)),
    set: jest.fn(async (data: Record<string, unknown>, options?: {merge?: boolean}) =>
      store.set(path, options?.merge ? {...(store.get(path) || {}), ...data} : data)),
    update: jest.fn(async (data: Record<string, unknown>) => {
      store.set(path, {...(store.get(path) || {}), ...data});
    }),
    create: jest.fn(async (data: Record<string, unknown>) => {
      if (store.has(path)) {
        const err = new Error("already exists") as Error & {code: number};
        err.code = 6;
        throw err;
      }
      store.set(path, data);
    }),
  };
}

const firestore = {
  doc: jest.fn((path: string) => docRef(path)),
};

jest.mock("../../src/_db", () => ({
  db: () => firestore,
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
    increment: jest.fn((v: number) => ({__increment: v})),
  },
  Timestamp: {
    fromMillis: (ms: number) => ({toMillis: () => ms, _ms: ms}),
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const callableHandlers: Record<string, (request: unknown) => Promise<unknown>> = {};
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: (request: unknown) => Promise<unknown>) => {
    callableHandlers.generateGroupInviteCode = handler;
    return handler;
  }),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("../../src/constants", () => ({
  FUNCTION_REGION: "southamerica-east1",
}));

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

const INVITE_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
jest.mock("../../src/auth/invite-code", () => ({
  generateInviteCode: (length = 6): string => {
    let code = "";
    for (let i = 0; i < length; i++) {
      code += INVITE_CODE_ALPHABET[mockRandomInt(INVITE_CODE_ALPHABET.length)];
    }
    return code;
  },
}));

function seedAdmin(groupId: string, uid: string) {
  store.set(`groups/${groupId}/members/${uid}`, {
    user_id: uid,
    role: "OWNER",
    status: "ACTIVE",
  });
}

describe("generateGroupInviteCode callable (#3937)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomInt.mockReturnValue(0);
    mockCheckRateLimit.mockResolvedValue({allowed: true});
    store.clear();
    Object.keys(callableHandlers).forEach((k) => delete callableHandlers[k]);
    jest.isolateModules(() => {
      require("../../src/groups/generate-invite-code");
    });
  });

  it("gera código bem-formado a partir do alfabeto criptográfico", async () => {
    seedAdmin("grp-1", "admin-1");
    mockRandomInt.mockReturnValue(5);

    const result = await callableHandlers.generateGroupInviteCode({
      auth: {uid: "admin-1", token: {name: "Admin Name"}},
      data: {groupId: "grp-1", groupName: "Meu Grupo"},
    }) as {code: string};

    expect(result.code).toHaveLength(6);
    expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(result.code).toBe("FFFFFF");
    expect(store.get(`invites/${result.code}`)).toMatchObject({
      group_id: "grp-1",
      group_name: "Meu Grupo",
      inviter_id: "admin-1",
      inviter_name: "Admin Name",
      used: false,
    });
  });

  it("códigos sucessivos são diferentes (não-determinísticos)", async () => {
    seedAdmin("grp-2", "admin-2");
    const codes = new Set<string>();
    let counter = 0;
    mockRandomInt.mockImplementation(() => counter++ % INVITE_CODE_ALPHABET.length);

    for (let i = 0; i < 3; i++) {
      const result = await callableHandlers.generateGroupInviteCode({
        auth: {uid: "admin-2", token: {}},
        data: {groupId: `grp-2`, groupName: "G"},
      }) as {code: string};
      codes.add(result.code);
    }
    expect(codes.size).toBe(3);
  });

  it("colisão de código retenta e gera outro disponível", async () => {
    seedAdmin("grp-3", "admin-3");
    // Primeira geração colide com doc pré-existente; segunda succeede.
    store.set("invites/COLIDE", {used: false, group_id: "other"});
    let call = 0;
    const indices = [2, 11, 8, 8, 2, 11];
    mockRandomInt.mockImplementation(() => indices[call++ % indices.length]);

    const result = await callableHandlers.generateGroupInviteCode({
      auth: {uid: "admin-3", token: {}},
      data: {groupId: "grp-3", groupName: "G3"},
    }) as {code: string};

    expect(result.code).not.toBe("COLIDE");
    expect(store.get(`invites/${result.code}`)).toMatchObject({
      group_id: "grp-3",
      inviter_id: "admin-3",
    });
  });

  it("exige autenticação", async () => {
    await expect(callableHandlers.generateGroupInviteCode({
      auth: null,
      data: {groupId: "g", groupName: "n"},
    })).rejects.toMatchObject({code: "unauthenticated"});
  });

  it("rejeita groupId/groupName vazios", async () => {
    await expect(callableHandlers.generateGroupInviteCode({
      auth: {uid: "admin-x", token: {}},
      data: {groupId: "  ", groupName: "n"},
    })).rejects.toMatchObject({code: "invalid-argument"});

    await expect(callableHandlers.generateGroupInviteCode({
      auth: {uid: "admin-x", token: {}},
      data: {groupId: "g", groupName: ""},
    })).rejects.toMatchObject({code: "invalid-argument"});
  });

  it("bloqueia não-admin (permission-denied)", async () => {
    store.set("groups/grp-4/members/member-regular", {
      user_id: "member-regular",
      role: "MEMBER",
      status: "ACTIVE",
    });

    await expect(callableHandlers.generateGroupInviteCode({
      auth: {uid: "member-regular", token: {}},
      data: {groupId: "grp-4", groupName: "G4"},
    })).rejects.toMatchObject({code: "permission-denied"});
  });

  it("respeita rate limit", async () => {
    seedAdmin("grp-5", "admin-5");
    mockCheckRateLimit.mockResolvedValue({allowed: false});

    await expect(callableHandlers.generateGroupInviteCode({
      auth: {uid: "admin-5", token: {}},
      data: {groupId: "grp-5", groupName: "G5"},
    })).rejects.toMatchObject({code: "resource-exhausted"});
  });
});
