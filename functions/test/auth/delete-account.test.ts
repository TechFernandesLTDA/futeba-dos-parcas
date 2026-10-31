/**
 * #4391 — callable deleteAccount.
 *
 * Usa o secureCallable REAL (só o onCall é identidade), então App Check,
 * login obrigatório e rate limit passam pelo caminho de produção. O Firestore
 * é um fake em memória; o Auth, o rate limiter e o soft delete de grupo são
 * mocks observáveis. A cascata LGPD em si (onUserDeleted) é coberta em
 * account-cleanup-writer-shapes.test.ts.
 */

type Data = Record<string, unknown>;

const state = new Map<string, Data>();
const addedDocs: Array<{collection: string; data: Data}> = [];

const mockDeleteUser = jest.fn();
const mockCheckRateLimit = jest.fn();
const mockSoftDeleteGroupCascade = jest.fn();

const idOf = (path: string): string => path.split("/").pop() ?? "";
const parentOf = (path: string): string => path.split("/").slice(0, -1).join("/");

interface FakeSnap {
  id: string;
  ref: {id: string; path: string};
  exists: boolean;
  data: () => Data | undefined;
}

function makeSnap(path: string): FakeSnap {
  return {
    id: idOf(path),
    ref: {id: idOf(path), path},
    exists: state.has(path),
    data: () => state.get(path),
  };
}

function makeQuery(
  collectionPath: string,
  filters: Array<{field: string; value: unknown}> = [],
  limitValue?: number,
  afterPath?: string,
): Record<string, unknown> {
  return {
    where: (field: string, op: string, value: unknown) => {
      if (op !== "==") throw new Error(`operador não suportado no fake: ${op}`);
      return makeQuery(collectionPath, [...filters, {field, value}], limitValue, afterPath);
    },
    limit: (value: number) => makeQuery(collectionPath, filters, value, afterPath),
    startAfter: (snap: FakeSnap) =>
      makeQuery(collectionPath, filters, limitValue, snap.ref.path),
    get: async () => {
      let paths = [...state.keys()]
        .filter((path) => parentOf(path) === collectionPath)
        .filter((path) => filters.every(({field, value}) =>
          (state.get(path) ?? {})[field] === value))
        .sort();
      if (afterPath !== undefined) paths = paths.filter((path) => path > afterPath);
      if (limitValue !== undefined) paths = paths.slice(0, limitValue);
      const docs = paths.map(makeSnap);
      return {docs, size: docs.length, empty: docs.length === 0};
    },
    add: async (data: Data) => {
      addedDocs.push({collection: collectionPath, data});
      return {id: `auto-${addedDocs.length}`};
    },
  };
}

const fakeDb = {
  collection: (path: string) => makeQuery(path),
  doc: (path: string) => ({id: idOf(path), path, get: async () => makeSnap(path)}),
};

jest.mock("firebase-functions", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
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
  firestore: jest.fn(() => fakeDb),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {serverTimestamp: () => "SERVER_TIMESTAMP"},
}));

jest.mock("../../src/_db", () => ({db: () => fakeDb}));
jest.mock("../../src/utils/firebase-lazy", () => ({
  getAuth: () => ({deleteUser: mockDeleteUser}),
}));
jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));
jest.mock("../../src/auth/anti-abuse", () => ({
  clientIp: jest.fn(() => "203.0.113.1"),
  rateLimitForRequest: jest.fn(),
}));
jest.mock("../../src/utils/soft-delete-helper", () => ({
  softDeleteGroupCascade: (...args: unknown[]) => mockSoftDeleteGroupCascade(...args),
}));

import {
  deleteAccount,
  hashUid,
  RECENT_LOGIN_MAX_AGE_SECONDS,
} from "../../src/auth/delete-account";

const UID = "user-to-delete";
const OTHER = "other-user";

type Handler = (request: unknown) => Promise<unknown>;
const callDeleteAccount = deleteAccount as unknown as Handler;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

function makeRequest(options: {
  uid?: string | null;
  authTime?: number;
  appCheck?: boolean;
} = {}): Record<string, unknown> {
  const uid = options.uid === undefined ? UID : options.uid;
  return {
    data: undefined,
    rawRequest: {ip: "203.0.113.1"},
    app: options.appCheck === false ? undefined : {alreadyConsumed: false},
    auth: uid === null ? undefined : {
      uid,
      token: {auth_time: options.authTime ?? nowSeconds() - 60},
    },
  };
}

async function expectHttpsError(
  promise: Promise<unknown>,
  code: string,
): Promise<{code: string; message: string; details?: Record<string, unknown>}> {
  const error = await promise.then(
    () => {
      throw new Error("esperava HttpsError");
    },
    (err: unknown) => err as {code: string; message: string; details?: Record<string, unknown>},
  );
  expect(error.code).toBe(code);
  return error;
}

describe("deleteAccount (#4391)", () => {
  beforeEach(() => {
    state.clear();
    addedDocs.length = 0;
    mockDeleteUser.mockReset().mockResolvedValue(undefined);
    mockCheckRateLimit.mockReset().mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetAt: new Date(Date.now() + 3_600_000),
    });
    mockSoftDeleteGroupCascade.mockReset().mockResolvedValue({
      groupDeleted: true,
      gamesDeleted: 0,
    });
    state.set(`users/${UID}`, {name: "Fulano da Silva"});
  });

  test("exige login: sem auth responde unauthenticated e não exclui nada", async () => {
    await expectHttpsError(callDeleteAccount(makeRequest({uid: null})), "unauthenticated");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("exige App Check (default do secureCallable fora do emulador)", async () => {
    await expectHttpsError(
      callDeleteAccount(makeRequest({appCheck: false})),
      "failed-precondition",
    );
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("rate limit de 3 por hora com prefixo próprio", async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    });
    await expectHttpsError(callDeleteAccount(makeRequest()), "resource-exhausted");
    expect(mockCheckRateLimit).toHaveBeenCalledWith(UID, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      keyPrefix: "delete_account",
    });
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("login antigo: failed-precondition com reason requires-recent-login, conta intacta", async () => {
    const error = await expectHttpsError(
      callDeleteAccount(makeRequest({
        authTime: nowSeconds() - RECENT_LOGIN_MAX_AGE_SECONDS - 5,
      })),
      "failed-precondition",
    );
    expect(error.details).toMatchObject({reason: "requires-recent-login"});
    expect(error.message).toMatch(/entre de novo/);
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(addedDocs).toEqual([]);
  });

  test("token sem auth_time é tratado como login antigo", async () => {
    const request = makeRequest();
    (request.auth as {token: Data}).token = {};
    const error = await expectHttpsError(callDeleteAccount(request), "failed-precondition");
    expect(error.details).toMatchObject({reason: "requires-recent-login"});
  });

  test("dono único de grupo com outros membros ativos: bloqueia antes de qualquer escrita", async () => {
    state.set("groups/g-1", {name: "Pelada de Quinta", owner_id: UID, status: "ACTIVE"});
    state.set(`groups/g-1/members/${UID}`, {user_id: UID, role: "OWNER", status: "ACTIVE"});
    state.set(`groups/g-1/members/${OTHER}`, {user_id: OTHER, role: "ADMIN", status: "ACTIVE"});
    const before = new Map(state);

    const error = await expectHttpsError(callDeleteAccount(makeRequest()), "failed-precondition");

    expect(error.details).toEqual({
      reason: "sole-owner-groups",
      groupCount: 1,
      groups: [{id: "g-1", name: "Pelada de Quinta"}],
    });
    expect(error.message).toContain("Pelada de Quinta");
    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(mockSoftDeleteGroupCascade).not.toHaveBeenCalled();
    expect(addedDocs).toEqual([]);
    expect(new Map(state)).toEqual(before);
  });

  test("membro legado sem status conta como ativo (mesma regra do member-counter)", async () => {
    state.set("groups/g-legacy", {name: "Racha", ownerId: UID});
    state.set(`groups/g-legacy/members/${OTHER}`, {user_id: OTHER});

    const error = await expectHttpsError(callDeleteAccount(makeRequest()), "failed-precondition");
    expect(error.details).toMatchObject({reason: "sole-owner-groups", groupCount: 1});
  });

  test("grupo sem outro membro ativo: soft delete do grupo e depois exclusão do Auth", async () => {
    state.set("groups/g-solo", {name: "Só eu", owner_id: UID, status: "ACTIVE"});
    state.set(`groups/g-solo/members/${UID}`, {user_id: UID, role: "OWNER", status: "ACTIVE"});
    state.set(`groups/g-solo/members/${OTHER}`, {user_id: OTHER, role: "MEMBER", status: "INACTIVE"});
    // Grupo já excluído não entra na decisão.
    state.set("groups/g-gone", {name: "Antigo", owner_id: UID, status: "DELETED"});
    state.set(`groups/g-gone/members/${OTHER}`, {user_id: OTHER, status: "ACTIVE"});

    await expect(callDeleteAccount(makeRequest())).resolves.toEqual({success: true});

    expect(mockSoftDeleteGroupCascade).toHaveBeenCalledTimes(1);
    expect(mockSoftDeleteGroupCascade).toHaveBeenCalledWith(
      "g-solo", UID, expect.stringContaining("LGPD"),
    );
    expect(mockDeleteUser).toHaveBeenCalledWith(UID);
    // Auth POR ÚLTIMO.
    expect(mockSoftDeleteGroupCascade.mock.invocationCallOrder[0])
      .toBeLessThan(mockDeleteUser.mock.invocationCallOrder[0]);
    expect(addedDocs[0].data).toMatchObject({
      counts: {orphan_groups_soft_deleted: 1},
    });
  });

  test("falha no soft delete do grupo: não exclui o Auth (conta intacta para nova tentativa)", async () => {
    state.set("groups/g-solo", {name: "Só eu", owner_id: UID});
    mockSoftDeleteGroupCascade.mockResolvedValueOnce({
      groupDeleted: false,
      gamesDeleted: 0,
      error: "falha",
    });

    await expectHttpsError(callDeleteAccount(makeRequest()), "internal");
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  test("grupo em DELETING (tentativa anterior interrompida) é retomado, não ignorado", async () => {
    // A cascata anterior gravou DELETING e falhou; membros podem continuar ACTIVE
    // ou já INACTIVE. O grupo não pode ficar preso com o dono excluído.
    state.set("groups/g-meio", {name: "Pela metade", owner_id: UID, status: "DELETING"});
    state.set(`groups/g-meio/members/${OTHER}`, {user_id: OTHER, status: "ACTIVE"});

    await expect(callDeleteAccount(makeRequest())).resolves.toEqual({success: true});

    expect(mockSoftDeleteGroupCascade).toHaveBeenCalledWith(
      "g-meio", UID, expect.stringContaining("LGPD"),
    );
    expect(mockSoftDeleteGroupCascade.mock.invocationCallOrder[0])
      .toBeLessThan(mockDeleteUser.mock.invocationCallOrder[0]);
  });

  test("sucesso: exclui o Auth e grava auditoria sem PII (só hash do uid)", async () => {
    await expect(callDeleteAccount(makeRequest())).resolves.toEqual({success: true});

    expect(mockDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockDeleteUser).toHaveBeenCalledWith(UID);
    expect(addedDocs).toHaveLength(1);
    expect(addedDocs[0].collection).toBe("audit_logs");
    expect(addedDocs[0].data).toEqual({
      action: "ACCOUNT_DELETED",
      source: "deleteAccount",
      uid_sha256: hashUid(UID),
      deleted_at: "SERVER_TIMESTAMP",
      already_deleted: false,
      counts: {orphan_groups_soft_deleted: 0},
    });
    const serialized = JSON.stringify(addedDocs);
    expect(serialized).not.toContain(UID);
    expect(serialized).not.toContain("203.0.113.1");
    expect(hashUid(UID)).toMatch(/^[0-9a-f]{64}$/);
  });

  test("idempotente: segunda chamada com o usuário já excluído responde sucesso", async () => {
    await expect(callDeleteAccount(makeRequest())).resolves.toEqual({success: true});
    mockDeleteUser.mockRejectedValueOnce(
      Object.assign(new Error("not found"), {code: "auth/user-not-found"}),
    );

    await expect(callDeleteAccount(makeRequest())).resolves.toEqual({success: true});

    expect(mockDeleteUser).toHaveBeenCalledTimes(2);
    expect(addedDocs[1].data).toMatchObject({already_deleted: true});
  });

  test("erro inesperado do Auth vira internal sem detalhe e sem auditoria de sucesso", async () => {
    mockDeleteUser.mockRejectedValueOnce(
      Object.assign(new Error("boom"), {code: "auth/internal-error"}),
    );

    await expectHttpsError(callDeleteAccount(makeRequest()), "internal");
    expect(addedDocs).toEqual([]);
  });
});
