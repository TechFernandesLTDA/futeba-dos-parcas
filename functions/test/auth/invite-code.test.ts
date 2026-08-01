process.env.FUNCTIONS_EMULATOR = "true";

const store = new Map<string, Record<string, unknown>>();
const setCalls: Array<{path: string; data: Record<string, unknown>}> = [];
const updateCalls: Array<{path: string; data: Record<string, unknown>}> = [];
const mockRandomInt = jest.fn(() => 0);
const mockCheckRateLimit = jest.fn().mockResolvedValue({allowed: true});
const mockCheckRateLimitByIp = jest.fn().mockResolvedValue({allowed: true});
const mockRateLimitForRequest = jest.fn().mockResolvedValue({allowed: true});
let failNextTransactionCommit = false;

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

async function runStagedTransaction(callback: (tx: unknown) => Promise<unknown>) {
    const staged: Array<() => void> = [];
    const result = await callback({
      get: async (ref: {path: string}) => snap(ref.path),
      set: (
        ref: {path: string},
        data: Record<string, unknown>,
        options?: {merge?: boolean},
      ) => staged.push(() => applySet(ref.path, data, options?.merge)),
      update: (ref: {path: string}, data: Record<string, unknown>) =>
        staged.push(() => applyUpdate(ref.path, data)),
    });
    if (failNextTransactionCommit) {
      failNextTransactionCommit = false;
      throw new Error("transaction commit unavailable");
    }
    staged.forEach((apply) => apply());
    return result;
}

const firestore = {
  collection: jest.fn(collectionRef),
  runTransaction: jest.fn(runStagedTransaction),
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
  rateLimitForRequest: mockRateLimitForRequest,
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
    mockRateLimitForRequest.mockResolvedValue({allowed: true});
    failNextTransactionCommit = false;
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

  it("generateMyInviteCode exige autenticação", async () => {
    await expect(callableHandlers.generateMyInviteCode({
      auth: null,
      data: {},
    })).rejects.toMatchObject({
      code: "unauthenticated",
      message: "Você precisa estar logado.",
    });
  });

  it("claim legado sem owner é atômico e colisão de owner é bloqueada", async () => {
    store.set("users/legacy-owner", {
      invite_code: "LEGACY",
      name: "Owner Legado",
    });
    store.set("invite_codes/LEGACY", {active: true});
    await callableHandlers.generateMyInviteCode({
      auth: {uid: "legacy-owner", token: {}},
      data: {},
    });
    expect(store.get("invite_codes/LEGACY")).toMatchObject({
      user_id: "legacy-owner",
    });

    store.set("users/collision-owner", {invite_code: "LEGACY"});
    await expect(callableHandlers.generateMyInviteCode({
      auth: {uid: "collision-owner", token: {}},
      data: {},
    })).rejects.toThrow("outra identidade");
    expect(store.get("invite_codes/LEGACY")).toMatchObject({
      user_id: "legacy-owner",
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
    mockRateLimitForRequest.mockResolvedValueOnce({allowed: false});
    await expect(callableHandlers.validateInviteCode({
      data: {inviteCode: "ABC123"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    })).rejects.toMatchObject({code: "resource-exhausted"});

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

  it("validateInviteCode aplica rate limit via rateLimitForRequest (sem bucket global)", async () => {
    await callableHandlers.validateInviteCode({
      data: {inviteCode: "ABC123"},
      rawRequest: {headers: {}},
      app: {appId: "app-xyz"},
    });

    expect(mockRateLimitForRequest).toHaveBeenCalledTimes(1);
    expect(mockRateLimitForRequest).toHaveBeenCalledWith(
      expect.objectContaining({app: {appId: "app-xyz"}}),
      expect.objectContaining({
        keyPrefix: "validate_invite_code",
        maxRequests: 30,
        windowMs: 60 * 1000,
      }),
    );
    expect(mockCheckRateLimitByIp).not.toHaveBeenCalled();
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

  it("validateInviteCode autenticado registra convite pendente para o cadastro Google", async () => {
    store.set("users/inviter-google", {
      invite_code: "GGL123",
      name: "Gabi Padrinha",
      experience_points: 100,
      level: 1,
    });

    const result = await callableHandlers.validateInviteCode({
      auth: {uid: "new-google-user"},
      data: {inviteCode: "ggl-123"},
      rawRequest: {headers: {}, ip: "127.0.0.1"},
    }) as {valid: boolean; inviteCode: string; inviterName: string; xpReward: number};

    expect(result).toMatchObject({
      valid: true,
      inviteCode: "GGL123",
      inviterName: "Gabi Padrinha",
      xpReward: 50,
    });
    expect(store.get("pending_app_invites/new-google-user")).toMatchObject({
      invite_code: "GGL123",
      inviter_id: "inviter-google",
      inviter_name: "Gabi Padrinha",
      source: "validateInviteCode",
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

  it("onUserCreatedProcessInvite recupera convite pendente quando perfil nasce sem codigo", async () => {
    store.set("users/inviter-pending", {
      invite_code: "PEND123",
      name: "Paulo Padrinho",
      invite_count: 0,
      experience_points: 40,
      level: 0,
    });
    store.set("pending_app_invites/google-user", {
      invite_code: "PEND123",
      inviter_id: "inviter-pending",
      inviter_name: "Paulo Padrinho",
      expires_at: Date.now() + 60_000,
    });
    store.set("users/google-user", {
      email: "google@test.com",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "google-user"},
      data: {data: () => store.get("users/google-user")},
    });

    expect(store.get("users/inviter-pending")).toMatchObject({
      invite_count: 1,
      experience_points: 90,
      level: 0,
    });
    expect(store.get("users/google-user")).toMatchObject({
      invited_by: "inviter-pending",
      invited_by_code: "PEND123",
      invite_source: "pending_validation",
    });
    expect(store.get("app_invite_redemptions/google-user")).toMatchObject({
      invite_code: "PEND123",
      inviter_id: "inviter-pending",
      invited_user_id: "google-user",
      xp_awarded: 50,
    });
    expect(store.get("xp_logs/app_invite_inviter-pending_google-user")).toMatchObject({
      user_id: "inviter-pending",
      source: "app_invite_accepted",
      xp_earned: 50,
      xp_before: 40,
      xp_after: 90,
    });
  });

  it("onUserCreatedProcessInvite aceita convite pendente com formatos Firestore de expires_at", async () => {
    store.set("users/inviter-formats", {
      invite_code: "FORM123",
      name: "Fernanda Formatos",
      invite_count: 0,
      experience_points: 10,
      level: 0,
    });

    const pendingCases = [
      {
        userId: "date-user",
        expiresAt: new Date(Date.now() + 60_000),
      },
      {
        userId: "to-millis-user",
        expiresAt: {toMillis: () => Date.now() + 60_000},
        inviterId: "inviter-formats",
        inviterName: "Fernanda Formatos",
      },
      {
        userId: "to-date-user",
        expiresAt: {toDate: () => new Date(Date.now() + 60_000)},
        inviterId: "inviter-formats",
      },
      {
        userId: "no-expiry-user",
        expiresAt: {},
      },
    ];

    for (const pendingCase of pendingCases) {
      store.set(`pending_app_invites/${pendingCase.userId}`, {
        invite_code: "FORM123",
        inviter_id: pendingCase.inviterId,
        inviter_name: pendingCase.inviterName,
        expires_at: pendingCase.expiresAt,
      });
      store.set(`users/${pendingCase.userId}`, {
        email: `${pendingCase.userId}@test.com`,
      });

      await firestoreHandlers["users/{userId}"][1]({
        params: {userId: pendingCase.userId},
        data: {data: () => store.get(`users/${pendingCase.userId}`)},
      });

      expect(store.get(`users/${pendingCase.userId}`)).toMatchObject({
        invited_by: "inviter-formats",
        invited_by_code: "FORM123",
        invite_source: "pending_validation",
      });
    }

    expect(store.get("users/inviter-formats")).toMatchObject({
      invite_count: 4,
      experience_points: 210,
      level: 1,
    });
  });

  it("onUserCreatedProcessInvite ignora convite pendente expirado ou sem codigo", async () => {
    store.set("users/inviter-stale", {
      invite_code: "STALE1",
      name: "Silvia Stale",
      invite_count: 0,
      experience_points: 25,
      level: 0,
    });
    store.set("pending_app_invites/expired-user", {
      invite_code: "STALE1",
      inviter_id: "inviter-stale",
      expires_at: {toMillis: () => Date.now() - 1_000},
    });
    store.set("pending_app_invites/missing-code-user", {
      expires_at: undefined,
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "expired-user"},
      data: {data: () => ({email: "expired@test.com"})},
    });
    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "missing-code-user"},
      data: {data: () => ({email: "missing-code@test.com"})},
    });

    expect(store.get("users/inviter-stale")).toMatchObject({
      invite_count: 0,
      experience_points: 25,
    });
    expect(store.has("app_invite_redemptions/expired-user")).toBe(false);
    expect(store.has("app_invite_redemptions/missing-code-user")).toBe(false);
  });

  it("onUserCreatedProcessInvite bloqueia convite pendente com dono divergente", async () => {
    store.set("users/inviter-real", {
      invite_code: "REAL12",
      name: "Rita Real",
      invite_count: 0,
      experience_points: 30,
      level: 0,
    });
    store.set("pending_app_invites/mismatch-user", {
      invite_code: "REAL12",
      inviter_id: "other-inviter",
      inviter_name: "Outro Dono",
      expires_at: {toDate: () => new Date(Date.now() + 60_000)},
    });
    store.set("users/mismatch-user", {
      email: "mismatch@test.com",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "mismatch-user"},
      data: {data: () => store.get("users/mismatch-user")},
    });

    expect(store.get("users/inviter-real")).toMatchObject({
      invite_count: 0,
      experience_points: 30,
    });
    expect(store.get("users/mismatch-user")).not.toMatchObject({
      invited_by: "inviter-real",
    });
    expect(store.has("app_invite_redemptions/mismatch-user")).toBe(false);
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

  it("onUserCreatedProcessInvite nao processa invite_codes com dono ausente", async () => {
    store.set("invite_codes/ORPHAN", {
      user_id: "missing-inviter",
      inviter_name: "Dono Ausente",
      active: true,
    });
    store.set("users/orphan-user", {
      email: "orphan@test.com",
      invited_by_code: "ORPHAN",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "orphan-user"},
      data: {data: () => store.get("users/orphan-user")},
    });

    expect(store.get("users/orphan-user")).not.toMatchObject({
      invited_by: "missing-inviter",
    });
    expect(store.has("app_invite_redemptions/orphan-user")).toBe(false);
    expect(store.has("xp_logs/app_invite_missing-inviter_orphan-user")).toBe(false);
  });

  it("onUserCreatedProcessInvite nao processa quando codigo nao pertence mais ao dono", async () => {
    store.set("invite_codes/STALE2", {
      user_id: "inviter-stale-owner",
      inviter_name: "Dono Antigo",
      active: true,
    });
    store.set("users/inviter-stale-owner", {
      invite_code: "FRESH2",
      name: "Dono Atualizado",
      invite_count: 0,
      experience_points: 10,
    });
    store.set("users/stale-code-user", {
      email: "stale-code@test.com",
      invited_by_code: "STALE2",
    });

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "stale-code-user"},
      data: {data: () => store.get("users/stale-code-user")},
    });

    expect(store.get("users/inviter-stale-owner")).toMatchObject({
      invite_count: 0,
      experience_points: 10,
    });
    expect(store.get("users/stale-code-user")).not.toMatchObject({
      invited_by: "inviter-stale-owner",
    });
    expect(store.has("app_invite_redemptions/stale-code-user")).toBe(false);
    expect(store.has("xp_logs/app_invite_inviter-stale-owner_stale-code-user")).toBe(false);
  });

  it("onUserCreatedProcessInvite nao processa se o padrinho sumir durante a transacao", async () => {
    store.set("users/race-missing-inviter", {
      invite_code: "RACE01",
      name: "Padrinho Corrida",
      invite_count: 0,
      experience_points: 10,
    });
    store.set("users/race-missing-user", {
      email: "race-missing@test.com",
      invited_by_code: "RACE01",
    });
    firestore.runTransaction
      .mockImplementationOnce(runStagedTransaction)
      .mockImplementationOnce(async (callback) =>
      callback({
        get: async (ref: {path: string}) => {
          if (ref.path === "users/race-missing-inviter") {
            return {exists: false, data: () => undefined};
          }
          return snap(ref.path);
        },
        set: (ref: {path: string}, data: Record<string, unknown>) =>
          applySet(ref.path, data),
        update: (ref: {path: string}, data: Record<string, unknown>) =>
          applyUpdate(ref.path, data),
      }));

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "race-missing-user"},
      data: {data: () => store.get("users/race-missing-user")},
    });

    expect(store.get("users/race-missing-user")).not.toMatchObject({
      invited_by: "race-missing-inviter",
    });
    expect(store.has("app_invite_redemptions/race-missing-user")).toBe(false);
  });

  it("onUserCreatedProcessInvite nao processa se o codigo mudar durante a transacao", async () => {
    store.set("users/race-mismatch-inviter", {
      invite_code: "RACE02",
      name: "Padrinho Atualizado",
      invite_count: 0,
      experience_points: 10,
    });
    store.set("users/race-mismatch-user", {
      email: "race-mismatch@test.com",
      invited_by_code: "RACE02",
    });
    firestore.runTransaction
      .mockImplementationOnce(runStagedTransaction)
      .mockImplementationOnce(async (callback) =>
      callback({
        get: async (ref: {path: string}) => {
          if (ref.path === "users/race-mismatch-inviter") {
            return {
              exists: true,
              data: () => ({
                invite_code: "NEW002",
                name: "Padrinho Atualizado",
                invite_count: 0,
                experience_points: 10,
              }),
            };
          }
          return snap(ref.path);
        },
        set: (ref: {path: string}, data: Record<string, unknown>) =>
          applySet(ref.path, data),
        update: (ref: {path: string}, data: Record<string, unknown>) =>
          applyUpdate(ref.path, data),
      }));

    await firestoreHandlers["users/{userId}"][1]({
      params: {userId: "race-mismatch-user"},
      data: {data: () => store.get("users/race-mismatch-user")},
    });

    expect(store.get("users/race-mismatch-inviter")).toMatchObject({
      invite_count: 0,
      experience_points: 10,
    });
    expect(store.get("users/race-mismatch-user")).not.toMatchObject({
      invited_by: "race-mismatch-inviter",
    });
    expect(store.has("app_invite_redemptions/race-mismatch-user")).toBe(false);
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

  it("trigger substitui invite_code injetado sem lock ou pertencente a outro uid", async () => {
    store.set("users/injected-free", {
      name: "Injetado Livre",
      invite_code: "HACKED",
    });
    await firestoreHandlers["users/{userId}"][0]({
      params: {userId: "injected-free"},
      data: {data: () => store.get("users/injected-free")},
    });
    expect(store.get("users/injected-free")).toMatchObject({
      invite_code: "AAAAAA",
    });
    expect(store.has("invite_codes/HACKED")).toBe(false);

    store.clear();
    store.set("invite_codes/TAKEN1", {user_id: "real-owner", active: true});
    store.set("users/injected-taken", {
      name: "Injetado Tomado",
      invite_code: "TAKEN1",
    });
    await firestoreHandlers["users/{userId}"][0]({
      params: {userId: "injected-taken"},
      data: {data: () => store.get("users/injected-taken")},
    });
    expect(store.get("users/injected-taken")).toMatchObject({
      invite_code: "AAAAAA",
    });
    expect(store.get("invite_codes/TAKEN1")).toMatchObject({
      user_id: "real-owner",
    });
  });

  it("não deixa código órfão quando a transação falha e o trigger retenta", async () => {
    store.set("users/member-retry", {name: "Retry"});
    failNextTransactionCommit = true;

    await expect(firestoreHandlers["users/{userId}"][0]({
      params: {userId: "member-retry"},
      data: {data: () => store.get("users/member-retry")},
    })).rejects.toThrow("transaction commit unavailable");
    expect(store.has("invite_codes/AAAAAA")).toBe(false);
    expect(store.get("users/member-retry")?.invite_code).toBeUndefined();

    await firestoreHandlers["users/{userId}"][0]({
      params: {userId: "member-retry"},
      data: {data: () => store.get("users/member-retry")},
    });

    expect(store.get("invite_codes/AAAAAA")).toMatchObject({
      user_id: "member-retry",
    });
    expect(store.get("users/member-retry")).toMatchObject({
      invite_code: "AAAAAA",
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

  it("onUserCreatedProcessInvite propaga falha transitória para retry", async () => {
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
    ).rejects.toThrow("firestore unavailable");

    setSpy.mockRestore();
    // set falhou: doc permanece sem invite_status e o runtime pode retentar.
    expect(store.get("users/ghost-fail")?.invite_status).toBeUndefined();
    expect(store.has("app_invite_redemptions/ghost-fail")).toBe(false);
  });
});
