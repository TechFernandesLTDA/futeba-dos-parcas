process.env.FUNCTIONS_EMULATOR = "true";

const store = new Map<string, Record<string, unknown>>();

function snap(path: string) {
  const data = store.get(path);
  return {
    exists: data !== undefined,
    id: path.split("/").pop(),
    data: () => data,
    ref: docRef(path),
  };
}

function applySet(path: string, data: Record<string, unknown>, merge = false) {
  store.set(path, merge ? {...(store.get(path) || {}), ...data} : data);
}

function applyUpdate(path: string, data: Record<string, unknown>) {
  const current = store.get(path) || {};
  const next = {...current};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "__delete" in value) {
      delete next[key];
    } else if (value && typeof value === "object" && "__increment" in value) {
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
    set: jest.fn(async (data: Record<string, unknown>, options?: {merge?: boolean}) =>
      applySet(path, data, options?.merge)),
    update: jest.fn(async (data: Record<string, unknown>) => applyUpdate(path, data)),
    create: jest.fn(async (data: Record<string, unknown>) => {
      if (store.has(path)) {
        const err = new Error("already exists") as Error & {code: number};
        err.code = 6;
        throw err;
      }
      applySet(path, data);
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
      options?: {merge?: boolean}
    ) => staged.push(() => applySet(ref.path, data, options?.merge)),
    update: (ref: {path: string}, data: Record<string, unknown>) =>
      staged.push(() => applyUpdate(ref.path, data)),
  });
  staged.forEach((apply) => apply());
  return result;
}

const firestore = {
  doc: jest.fn((path: string) => docRef(path)),
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
    delete: jest.fn(() => ({__delete: true})),
  },
  Timestamp: {
    fromMillis: (ms: number) => ({toMillis: () => ms}),
  },
}));

const firestoreHandlers: Record<string, Array<(event: unknown) => Promise<void>>> = {};
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((config: {document: string}, handler: (event: unknown) => Promise<void>) => {
    firestoreHandlers[config.document] = firestoreHandlers[config.document] || [];
    firestoreHandlers[config.document].push(handler);
    return handler;
  }),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../../src/constants", () => ({
  FUNCTION_REGION: "southamerica-east1",
}));

function futureExpiry() {
  return {toMillis: () => Date.now() + 5 * 60 * 1000};
}

function buildEvent(
  code: string,
  beforeData: Record<string, unknown>,
  afterData: Record<string, unknown>,
) {
  const invitePath = `invites/${code}`;
  return {
    params: {code},
    data: {
      before: {
        data: () => beforeData,
        ref: docRef(invitePath),
      },
      after: {
        data: () => afterData,
        ref: docRef(invitePath),
      },
    },
  };
}

function seedRedeemedInvite(
  code: string,
  groupId: string,
  userId: string,
  overrides?: {blocked?: boolean; groupStatus?: string; memberExists?: boolean},
) {
  const beforeData: Record<string, unknown> = {
    group_id: groupId,
    group_name: "Test Group",
    used: false,
    used_by: null,
    expires_at: futureExpiry(),
  };
  const afterData: Record<string, unknown> = {
    ...beforeData,
    used: true,
    used_by: userId,
    used_at: {__serverTimestamp: true},
  };

  store.set(`invites/${code}`, afterData);
  store.set(`groups/${groupId}`, {
    name: "Test Group",
    status: overrides?.groupStatus ?? "ACTIVE",
    is_public: true,
    photo_url: null,
    member_count: 0,
  });
  store.set(`users/${userId}`, {name: "Joiner", photo_url: null});
  if (overrides?.blocked) {
    store.set(`groups/${groupId}/blocked_players/${userId}`, {blocked: true});
  }
  if (overrides?.memberExists) {
    store.set(`groups/${groupId}/members/${userId}`, {
      user_id: userId,
      role: "MEMBER",
      status: "ACTIVE",
    });
  }

  return buildEvent(code, beforeData, afterData);
}

describe("onInviteRedeemed (#3936)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    Object.keys(firestoreHandlers).forEach((key) => delete firestoreHandlers[key]);
    jest.isolateModules(() => {
      require("../../src/groups/invite-redeemed");
    });
  });

  it("usuário bloqueado reverte o convite para used:false dentro da transação", async () => {
    const code = "BLCK01";
    const groupId = "grp-blocked";
    const userId = "usr-blocked";
    const event = seedRedeemedInvite(code, groupId, userId, {blocked: true});

    await firestoreHandlers["invites/{code}"][0](event);

    const invite = store.get(`invites/${code}`);
    expect(invite?.used).toBe(false);
    expect(invite?.used_by).toBeUndefined();
    expect(invite?.used_at).toBeUndefined();
    expect(invite?.last_reject_reason).toBe("BLOCKED");
    expect(store.has(`groups/${groupId}/members/${userId}`)).toBe(false);
  });

  it("grupo inativo reverte o convite para used:false (pre-transação)", async () => {
    const code = "INACT1";
    const groupId = "grp-inactive";
    const userId = "usr-inactive";
    const event = seedRedeemedInvite(code, groupId, userId, {
      groupStatus: "SUSPENDED",
    });

    await firestoreHandlers["invites/{code}"][0](event);

    const invite = store.get(`invites/${code}`);
    expect(invite?.used).toBe(false);
    expect(invite?.used_by).toBeUndefined();
    expect(invite?.last_reject_reason).toBe("GROUP_INACTIVE");
    expect(store.has(`groups/${groupId}/members/${userId}`)).toBe(false);
  });

  it("grupo inativo detectado dentro da transação reverte o convite", async () => {
    const code = "INACT2";
    const groupId = "grp-inact-tx";
    const userId = "usr-inact-tx";
    const event = seedRedeemedInvite(code, groupId, userId);

    firestore.runTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const result = await callback({
        get: async (ref: {path: string}) => {
          if (ref.path === `groups/${groupId}`) {
            return {
              exists: true,
              data: () => ({status: "SUSPENDED", name: "Test Group"}),
              ref: docRef(ref.path),
            };
          }
          return snap(ref.path);
        },
        set: (ref: {path: string}, data: Record<string, unknown>) =>
          applySet(ref.path, data),
        update: (ref: {path: string}, data: Record<string, unknown>) =>
          applyUpdate(ref.path, data),
      });
      return result;
    });

    await firestoreHandlers["invites/{code}"][0](event);

    const invite = store.get(`invites/${code}`);
    expect(invite?.used).toBe(false);
    expect(invite?.last_reject_reason).toBe("GROUP_INACTIVE");
  });

  it("idempotência: member já existe não reverte nem duplica", async () => {
    const code = "IDEMP1";
    const groupId = "grp-idemp";
    const userId = "usr-idemp";
    const event = seedRedeemedInvite(code, groupId, userId, {
      memberExists: true,
    });

    await firestoreHandlers["invites/{code}"][0](event);

    const invite = store.get(`invites/${code}`);
    expect(invite?.used).toBe(true);
    expect(invite?.last_reject_reason).toBeUndefined();
  });

  it("fluxo positivo cria membership ACTIVE", async () => {
    const code = "SUCC01";
    const groupId = "grp-success";
    const userId = "usr-success";
    const event = seedRedeemedInvite(code, groupId, userId);

    await firestoreHandlers["invites/{code}"][0](event);

    const member = store.get(`groups/${groupId}/members/${userId}`);
    expect(member).toMatchObject({
      user_id: userId,
      role: "MEMBER",
      status: "ACTIVE",
      joined_via_invite: code,
    });
    expect(store.has(`users/${userId}/groups/${groupId}`)).toBe(true);
    expect(store.get(`invites/${code}`)?.used).toBe(true);
  });

  it("falha transitória propaga para retry do runtime (retry:true)", async () => {
    const code = "TRANS01";
    const groupId = "grp-transient";
    const userId = "usr-transient";
    const event = seedRedeemedInvite(code, groupId, userId);

    firestore.runTransaction.mockImplementationOnce(async () => {
      throw new Error("UNAVAILABLE");
    });

    await expect(
      firestoreHandlers["invites/{code}"][0](event),
    ).rejects.toThrow("UNAVAILABLE");

    expect(store.has(`groups/${groupId}/members/${userId}`)).toBe(false);

    // Retry: segunda invocação com novo convite succeede.
    const event2 = seedRedeemedInvite("TRANS02", groupId, userId);
    await firestoreHandlers["invites/{code}"][0](event2);

    expect(store.get(`groups/${groupId}/members/${userId}`)).toMatchObject({
      status: "ACTIVE",
    });
  });

  it("grupo removido durante a transação reverte o convite", async () => {
    const code = "RACE01";
    const groupId = "grp-race";
    const userId = "usr-race";
    const event = seedRedeemedInvite(code, groupId, userId);

    firestore.runTransaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      const result = await callback({
        get: async (ref: {path: string}) => {
          if (ref.path === `groups/${groupId}`) {
            return {exists: false, data: () => undefined, ref: docRef(ref.path)};
          }
          return snap(ref.path);
        },
        set: (ref: {path: string}, data: Record<string, unknown>) =>
          applySet(ref.path, data),
        update: (ref: {path: string}, data: Record<string, unknown>) =>
          applyUpdate(ref.path, data),
      });
      return result;
    });

    await firestoreHandlers["invites/{code}"][0](event);

    const invite = store.get(`invites/${code}`);
    expect(invite?.used).toBe(false);
    expect(invite?.last_reject_reason).toBe("GROUP_NOT_FOUND");
  });
});
