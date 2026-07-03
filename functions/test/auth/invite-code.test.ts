process.env.FUNCTIONS_EMULATOR = "true";

const store = new Map<string, Record<string, unknown>>();
const setCalls: Array<{path: string; data: Record<string, unknown>}> = [];
const updateCalls: Array<{path: string; data: Record<string, unknown>}> = [];
const mockRandomInt = jest.fn(() => 0);
const mockCheckRateLimit = jest.fn().mockResolvedValue({allowed: true});
const mockCheckRateLimitByIp = jest.fn().mockResolvedValue({allowed: true});

function snap(path: string) {
  const data = store.get(path);
  return {
    exists: data !== undefined,
    id: path.split("/").pop(),
    data: () => data,
  };
}

function applySet(path: string, data: Record<string, unknown>, merge = false) {
  setCalls.push({path, data});
  store.set(path, merge ? {...(store.get(path) || {}), ...data} : data);
}

function applyUpdate(path: string, data: Record<string, unknown>) {
  updateCalls.push({path, data});
  const current = store.get(path) || {};
  const next = {...current};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "__increment" in value) {
      next[key] = ((next[key] as number | undefined) || 0) +
        ((value as {__increment: number}).__increment);
    } else {
      next[key] = value;
    }
  }
  store.set(path, next);
}

function docRef(path: string) {
  return {
    path,
    id: path.split("/").pop(),
    get: jest.fn(async () => snap(path)),
    set: jest.fn(async (data, options?: {merge?: boolean}) =>
      applySet(path, data, options?.merge)),
    update: jest.fn(async (data) => applyUpdate(path, data)),
    create: jest.fn(async (data) => {
      if (store.has(path)) {
        const err = new Error("already exists") as Error & {code: number};
        err.code = 6;
        throw err;
      }
      applySet(path, data);
    }),
  };
}

function collectionRef(name: string) {
  return {
    doc: (id: string) => docRef(`${name}/${id}`),
    where: (field: string, _op: string, value: unknown) => ({
      limit: () => ({
        get: async () => {
          const docs = Array.from(store.entries())
            .filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
            .map(([path]) => snap(path));
          return {empty: docs.length === 0, docs};
        },
      }),
    }),
  };
}

const firestore = {
  collection: jest.fn(collectionRef),
  runTransaction: jest.fn(async (callback) => callback({
    get: async (ref: {path: string}) => snap(ref.path),
    set: (ref: {path: string}, data: Record<string, unknown>) =>
      applySet(ref.path, data),
    update: (ref: {path: string}, data: Record<string, unknown>) =>
      applyUpdate(ref.path, data),
  })),
};

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  initializeApp: jest.fn(),
  firestore: jest.fn(() => firestore),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
    increment: jest.fn((value: number) => ({__increment: value})),
  },
}));

const firestoreHandlers: Record<string, Array<(event: unknown) => Promise<void>>> = {};
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn((config: {document: string}, handler: (event: unknown) => Promise<void>) => {
    firestoreHandlers[config.document] = firestoreHandlers[config.document] || [];
    firestoreHandlers[config.document].push(handler);
    return handler;
  }),
}));

const callableHandlers: Record<string, (request: unknown) => Promise<unknown>> = {};
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: (request: unknown) => Promise<unknown>) => {
    const key = Object.keys(callableHandlers).length === 0 ?
      "generateMyInviteCode" :
      "validateInviteCode";
    callableHandlers[key] = handler;
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

jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: mockCheckRateLimit,
  checkRateLimitByIp: mockCheckRateLimitByIp,
}));

jest.mock("../../src/auth/anti-abuse", () => ({
  clientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomInt: mockRandomInt,
}));

describe("auth/invite-code apadrinhamento", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRandomInt.mockReturnValue(0);
    mockCheckRateLimit.mockResolvedValue({allowed: true});
    mockCheckRateLimitByIp.mockResolvedValue({allowed: true});
    store.clear();
    setCalls.length = 0;
    updateCalls.length = 0;
    Object.keys(firestoreHandlers).forEach((key) => delete firestoreHandlers[key]);
    Object.keys(callableHandlers).forEach((key) => delete callableHandlers[key]);

    jest.isolateModules(() => {
      require("../../src/auth/invite-code");
    });
  });

  it("generateMyInviteCode sincroniza codigo existente do usuario", async () => {
    store.set("users/member-1", {
      invite_code: "OLD123",
      name: "",
      invite_count: 4,
    });

    const result = await callableHandlers.generateMyInviteCode({
      auth: {uid: "member-1", token: {name: "Nome Token"}},
      data: {},
    }) as {inviteCode: string};

    expect(result).toEqual({inviteCode: "OLD123"});
    expect(store.get("invite_codes/OLD123")).toMatchObject({
      user_id: "member-1",
      inviter_name: "Nome Token",
      active: true,
    });
  });

  it("generateMyInviteCode cria codigo novo com owner atomico", async () => {
    store.set("users/member-2", {
      name: "Bruno Padrinho",
      invite_count: 7,
    });

    const result = await callableHandlers.generateMyInviteCode({
      auth: {uid: "member-2", token: {}},
      data: {},
    }) as {inviteCode: string};

    expect(result).toEqual({inviteCode: "AAAAAA"});
    expect(store.get("invite_codes/AAAAAA")).toMatchObject({
      user_id: "member-2",
      inviter_name: "Bruno Padrinho",
      active: true,
    });
    expect(store.get("users/member-2")).toMatchObject({
      invite_code: "AAAAAA",
      invite_count: 7,
    });
  });

  it("validateInviteCode bloqueia rate limit, codigo invalido e auto-convite", async () => {
    mockCheckRateLimitByIp.mockResolvedValueOnce({allowed: false});
    await expect(callableHandlers.validateInviteCode({
      data: {inviteCode: "ABC123"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    })).rejects.toMatchObject({code: "resource-exhausted"});

    mockCheckRateLimitByIp.mockResolvedValue({allowed: true});
    await expect(callableHandlers.validateInviteCode({
      data: {inviteCode: "!"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    })).resolves.toEqual({valid: false});

    store.set("users/inviter-self", {
      invite_code: "SELF123",
      name: "Auto Convite",
    });
    await expect(callableHandlers.validateInviteCode({
      auth: {uid: "inviter-self"},
      data: {inviteCode: "SELF123"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    })).resolves.toEqual({valid: false});
  });

  it("validateInviteCode valida codigo legado e sincroniza invite_codes/{code}", async () => {
    store.set("users/inviter-1", {
      invite_code: "ABC123",
      name: "Ana Padrinha",
      experience_points: 100,
      level: 1,
    });

    const result = await callableHandlers.validateInviteCode({
      data: {inviteCode: "abc-123"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    }) as {valid: boolean; inviteCode: string; inviterName: string; xpReward: number};

    expect(result).toMatchObject({
      valid: true,
      inviteCode: "ABC123",
      inviterName: "Ana Padrinha",
      xpReward: 50,
    });
    expect(store.get("invite_codes/ABC123")).toMatchObject({
      user_id: "inviter-1",
      active: true,
    });
  });

  it("validateInviteCode nao reativa invite_codes desativado", async () => {
    store.set("users/inviter-disabled", {
      invite_code: "OFF123",
      name: "Codigo Desativado",
    });
    store.set("invite_codes/OFF123", {
      user_id: "inviter-disabled",
      inviter_name: "Codigo Desativado",
      active: false,
    });

    await expect(callableHandlers.validateInviteCode({
      data: {inviteCode: "OFF123"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    })).resolves.toEqual({valid: false});

    expect(store.get("invite_codes/OFF123")).toMatchObject({
      user_id: "inviter-disabled",
      active: false,
    });
  });

  it("onUserCreatedProcessInvite registra aceite e credita XP ao padrinho", async () => {
    store.set("users/inviter-1", {
      invite_code: "ABC123",
      name: "Ana Padrinha",
      invite_count: 2,
      experience_points: 90,
      level: 0,
    });
    store.set("users/new-user", {
      email: "novo@test.com",
      invited_by_code: "ABC123",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "new-user"},
      data: {data: () => store.get("users/new-user")},
    });

    expect(store.get("users/inviter-1")).toMatchObject({
      invite_count: 3,
      experience_points: 140,
      level: 1,
    });
    expect(store.get("users/new-user")).toMatchObject({
      invited_by: "inviter-1",
    });
    expect(store.get("app_invite_redemptions/new-user")).toMatchObject({
      invite_code: "ABC123",
      inviter_id: "inviter-1",
      invited_user_id: "new-user",
      xp_awarded: 50,
    });
    expect(store.get("xp_logs/app_invite_inviter-1_new-user")).toMatchObject({
      user_id: "inviter-1",
      source: "app_invite_accepted",
      xp_earned: 50,
      xp_before: 90,
      xp_after: 140,
    });
  });

  it("onUserCreatedProcessInvite ignora codigo desativado sem reativa-lo", async () => {
    store.set("users/inviter-disabled", {
      invite_code: "OFF123",
      name: "Codigo Desativado",
      invite_count: 2,
      experience_points: 90,
      level: 0,
    });
    store.set("invite_codes/OFF123", {
      user_id: "inviter-disabled",
      inviter_name: "Codigo Desativado",
      active: false,
    });
    store.set("users/new-user-disabled", {
      email: "novo@test.com",
      invited_by_code: "OFF123",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "new-user-disabled"},
      data: {data: () => store.get("users/new-user-disabled")},
    });

    expect(store.get("users/new-user-disabled")).toMatchObject({
      invite_status: "INVALID_CODE",
    });
    expect(store.get("users/inviter-disabled")).toMatchObject({
      invite_count: 2,
      experience_points: 90,
    });
    expect(store.get("invite_codes/OFF123")).toMatchObject({
      active: false,
    });
  });

  it("onUserCreatedGenerateInviteCode gera codigo com owner para novo usuario", async () => {
    store.set("users/member-3", {
      name: "Carla Criadora",
    });

    await firestoreHandlers["users/{userId}"][0]({
      params: {userId: "member-3"},
      data: {data: () => store.get("users/member-3")},
    });

    expect(store.get("users/member-3")).toMatchObject({
      invite_code: "AAAAAA",
      invite_count: 0,
    });
    expect(store.get("invite_codes/AAAAAA")).toMatchObject({
      user_id: "member-3",
      inviter_name: "Carla Criadora",
      active: true,
    });
  });

  it("onUserCreatedProcessInvite ignora convite ausente, invalido e ja resgatado", async () => {
    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "without-code"},
      data: {data: () => ({email: "sem@test.com"})},
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "invalid-code"},
      data: {data: () => ({invited_by_code: "BAD123"})},
    });

    store.set("users/inviter-2", {
      invite_code: "USED123",
      name: "Padrinho Usado",
      invite_count: 1,
      experience_points: 20,
    });
    store.set("app_invite_redemptions/already-user", {
      invite_code: "USED123",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "already-user"},
      data: {data: () => ({invited_by_code: "USED123"})},
    });

    expect(store.get("users/inviter-2")).toMatchObject({
      invite_count: 1,
      experience_points: 20,
    });
    expect(store.has("xp_logs/app_invite_inviter-2_already-user")).toBe(false);
  });

  it("onUserCreatedProcessInvite marca invite_status INVALID_CODE em codigo desconhecido", async () => {
    // #3187: codigo desconhecido nao pode ser no-op silencioso — o doc do
    // usuario recebe invite_status pra ficar visivel/queryavel em auditoria.
    store.set("users/ghost-invite", {
      email: "ghost@test.com",
      invited_by_code: "NOPE99",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "ghost-invite"},
      data: {data: () => store.get("users/ghost-invite")},
    });

    // Doc marcado (merge preserva campos existentes)
    expect(store.get("users/ghost-invite")).toMatchObject({
      invite_status: "INVALID_CODE",
    });
    // Nenhum efeito colateral de resgate: sem redemption nem XP
    expect(store.has("app_invite_redemptions/ghost-invite")).toBe(false);
    expect(
      Array.from(store.keys()).some((path) => path.startsWith("xp_logs/"))
    ).toBe(false);
  });

  it("onUserCreatedProcessInvite nao propaga erro se o set de INVALID_CODE falhar (#3187)", async () => {
    // Cobertura do catch (markErr): se o set que marca invite_status falha,
    // o handler loga e segue — nao deixa a conta invisivel nem quebra o
    // trigger de criacao de usuario.
    store.set("users/ghost-fail", {
      email: "ghost-fail@test.com",
      invited_by_code: "NOPE99",
    });
    const originalSet = store.set.bind(store);
    const setSpy = jest
      .spyOn(store, "set")
      .mockImplementation((path: unknown, data: unknown) => {
        if (String(path) === "users/ghost-fail") {
          throw new Error("firestore unavailable");
        }
        return originalSet(path, data);
      });

    await expect(
      firestoreHandlers["users/{userId}"][1]({
        params: {userId: "ghost-fail"},
        data: {data: () => ({email: "ghost-fail@test.com", invited_by_code: "NOPE99"})},
      })
    ).resolves.toBeUndefined();

    setSpy.mockRestore();
    // set falhou: doc permanece sem invite_status, mas handler nao propagou
    expect(store.get("users/ghost-fail")?.invite_status).toBeUndefined();
    expect(store.has("app_invite_redemptions/ghost-fail")).toBe(false);
  });
});
