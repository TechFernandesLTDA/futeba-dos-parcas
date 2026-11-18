/**
 * Convites de grupo e de apadrinhamento (UC1).
 * - generateGroupInviteCode: quem pode gerar convite (dono/ADMIN ativo), colisão de código.
 * - onInviteRedeemed: resgate, convite expirado, reuso, grupo inativo, bloqueado, outro grupo.
 * - validateInviteCode: código inválido, inexistente e auto-convite.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/https", () => require("./_fake-runtime").httpsModule);
jest.mock("firebase-functions/v2/firestore", () => require("./_fake-runtime").triggersModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("firebase-admin", () => require("./_fake-runtime").adminModule(() => require("./_fake-firestore").db()));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/middleware/rate-limiter");
jest.mock("../../src/auth/anti-abuse", () => ({
  rateLimitForRequest: jest.fn(async () => ({allowed: true, remaining: 10, resetAt: new Date()})),
}));
jest.mock("../../src/auth/invite-code", () => {
  const actual = jest.requireActual("../../src/auth/invite-code");
  return {...actual, generateInviteCode: jest.fn(actual.generateInviteCode)};
});

import {checkRateLimit} from "../../src/middleware/rate-limiter";
import {generateInviteCode} from "../../src/auth/invite-code";
import {resetFakeDb, seed, read, pathsWithPrefix, db} from "./_fake-firestore";

const {generateGroupInviteCode} = require("../../src/groups/generate-invite-code");
const {onInviteRedeemed} = require("../../src/groups/invite-redeemed");
const {validateInviteCode} = require("../../src/auth/invite-code");

const RL_OK = {allowed: true, remaining: 10, resetAt: new Date(Date.now() + 60_000)};
const RL_BLOCKED = {allowed: false, remaining: 0, resetAt: new Date(Date.now() + 60_000)};
const DAY_MS = 24 * 60 * 60 * 1000;

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => undefined,
    (e: {code?: string}) => e
  );
  expect(err).toBeDefined();
  expect((err as {code: string}).code).toBe(code);
}

function seedGroupWithMembers() {
  seed("groups/g1", {name: "Pelada Sul", owner_id: "owner-1", status: "ACTIVE"});
  seed("groups/g1/members/owner-1", {user_id: "owner-1", role: "OWNER", status: "ACTIVE"});
  seed("groups/g1/members/admin-1", {user_id: "admin-1", role: "ADMIN", status: "ACTIVE"});
  seed("groups/g1/members/member-1", {user_id: "member-1", role: "MEMBER", status: "ACTIVE"});
  seed("groups/g2/members/admin-g2", {user_id: "admin-g2", role: "ADMIN", status: "ACTIVE"});
}

const callGenerate = (uid: string | null, data: Record<string, unknown> = {}) =>
  generateGroupInviteCode({
    auth: uid ? {uid, token: {name: "Organizador Teste"}} : undefined,
    data: {groupId: "g1", groupName: "Pelada Sul", ...data},
  }) as Promise<{code: string}>;

describe("generateGroupInviteCode - quem pode convidar (UC1/UC4)", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
    seedGroupWithMembers();
  });

  it("dono ativo gera código de 6 caracteres com validade de 7 dias", async () => {
    const before = Date.now();
    const result = await callGenerate("owner-1");

    expect(result.code).toMatch(/^[A-Z0-9]{6}$/);
    const invite = read(`invites/${result.code}`);
    expect(invite).toMatchObject({
      group_id: "g1",
      group_name: "Pelada Sul",
      inviter_id: "owner-1",
      used: false,
    });
    const expires = (invite?.expires_at as {toMillis: () => number}).toMillis();
    expect(expires).toBeGreaterThanOrEqual(before + 7 * DAY_MS - 1000);
    expect(expires).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS + 1000);
  });

  it("ADMIN ativo gera convite", async () => {
    const result = await callGenerate("admin-1");
    expect(read(`invites/${result.code}`)).toMatchObject({inviter_id: "admin-1"});
  });

  it("MEMBER comum não gera convite", async () => {
    await expectCode(callGenerate("member-1"), "permission-denied");
    expect(pathsWithPrefix("invites/")).toHaveLength(0);
  });

  it("visitante sem vínculo não gera convite", async () => {
    await expectCode(callGenerate("visitor-1"), "permission-denied");
  });

  it("ADMIN de outro grupo não gera convite para g1", async () => {
    await expectCode(callGenerate("admin-g2"), "permission-denied");
  });

  it("sem autenticação devolve unauthenticated", async () => {
    await expectCode(callGenerate(null), "unauthenticated");
  });

  it("nome de grupo vazio é invalid-argument", async () => {
    await expectCode(callGenerate("owner-1", {groupName: "   "}), "invalid-argument");
  });

  it("rate limit estourado devolve resource-exhausted", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue(RL_BLOCKED);
    await expectCode(callGenerate("owner-1"), "resource-exhausted");
  });

  it("colisão de código é contornada gerando outro código", async () => {
    seed("invites/AAAAAA", {used: false});
    (generateInviteCode as jest.Mock)
      .mockReturnValueOnce("AAAAAA")
      .mockReturnValueOnce("BBBBBB");

    const result = await callGenerate("owner-1");

    expect(result.code).toBe("BBBBBB");
    expect(read("invites/AAAAAA")).toMatchObject({used: false});
  });

  it("após 8 colisões seguidas devolve resource-exhausted sem criar convite", async () => {
    seed("invites/AAAAAA", {used: false});
    (generateInviteCode as jest.Mock).mockReturnValue("AAAAAA");

    await expectCode(callGenerate("owner-1"), "resource-exhausted");
    expect(pathsWithPrefix("invites/")).toEqual(["invites/AAAAAA"]);
  });
});

describe("onInviteRedeemed - resgate do convite de grupo (UC1)", () => {
  const CODE = "INV123";

  function redeem(before: Record<string, unknown>, after: Record<string, unknown>) {
    const ref = db().doc(`invites/${CODE}`);
    return onInviteRedeemed({
      data: {
        before: {data: () => ({...before})},
        after: {data: () => ({...after}), ref},
      },
      params: {code: CODE},
    });
  }

  const baseInvite = (overrides: Record<string, unknown> = {}) => ({
    group_id: "g1",
    group_name: "Pelada Sul",
    inviter_id: "owner-1",
    used: false,
    expires_at: {toMillis: () => Date.now() + DAY_MS},
    ...overrides,
  });

  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seedGroupWithMembers();
    seed("users/joiner-1", {name: "Joiner"});
    seed(`invites/${CODE}`, baseInvite());
  });

  it("resgate válido cria membro ACTIVE com papel MEMBER", async () => {
    await redeem(baseInvite(), baseInvite({used: true, used_by: "joiner-1", used_at: new Date()}));

    expect(read("groups/g1/members/joiner-1")).toMatchObject({
      user_id: "joiner-1",
      role: "MEMBER",
      status: "ACTIVE",
      joined_via_invite: CODE,
    });
    expect(read("users/joiner-1/groups/g1")).toMatchObject({group_id: "g1", role: "MEMBER"});
  });

  it("convite expirado não cria membership", async () => {
    const expired = baseInvite({expires_at: {toMillis: () => Date.now() - 1000}});
    await redeem(expired, {...expired, used: true, used_by: "joiner-1"});

    expect(read("groups/g1/members/joiner-1")).toBeUndefined();
  });

  it("reuso: convite já usado (used true -> true) não dispara nova redenção", async () => {
    const used = baseInvite({used: true, used_by: "joiner-1"});
    await redeem(used, {...used});

    expect(read("groups/g1/members/joiner-1")).toBeUndefined();
  });

  it("convite que troca de grupo durante a redenção é abortado", async () => {
    await redeem(
      baseInvite(),
      baseInvite({group_id: "g2", used: true, used_by: "joiner-1"})
    );
    expect(read("groups/g2/members/joiner-1")).toBeUndefined();
    expect(read("groups/g1/members/joiner-1")).toBeUndefined();
  });

  it("grupo inativo devolve o convite (used volta para false) com motivo GROUP_INACTIVE", async () => {
    seed("groups/g1", {name: "Pelada Sul", owner_id: "owner-1", status: "DELETING"});
    await redeem(baseInvite(), baseInvite({used: true, used_by: "joiner-1"}));

    expect(read("groups/g1/members/joiner-1")).toBeUndefined();
    expect(read(`invites/${CODE}`)).toMatchObject({used: false, last_reject_reason: "GROUP_INACTIVE"});
  });

  it("grupo inexistente devolve o convite com motivo GROUP_NOT_FOUND", async () => {
    resetFakeDb();
    seed(`invites/${CODE}`, baseInvite());
    seed("users/joiner-1", {name: "Joiner"});
    await redeem(baseInvite(), baseInvite({used: true, used_by: "joiner-1"}));

    expect(read(`invites/${CODE}`)).toMatchObject({used: false, last_reject_reason: "GROUP_NOT_FOUND"});
  });

  it("usuário bloqueado no grupo não entra e o convite volta a ficar disponível", async () => {
    seed("groups/g1/blocked_players/joiner-1", {user_id: "joiner-1"});
    await redeem(baseInvite(), baseInvite({used: true, used_by: "joiner-1"}));

    expect(read("groups/g1/members/joiner-1")).toBeUndefined();
    expect(read(`invites/${CODE}`)).toMatchObject({used: false, last_reject_reason: "BLOCKED"});
  });
});

describe("validateInviteCode - apadrinhamento (UC1)", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seed("invite_codes/ABC123", {user_id: "inviter-1", active: true});
    seed("users/inviter-1", {name: "Quem Convidou", invite_code: "ABC123"});
  });

  it("código válido devolve o convidante e a recompensa", async () => {
    const result = await validateInviteCode({
      auth: {uid: "newbie-1", token: {}},
      data: {inviteCode: "abc123"},
    });

    expect(result).toMatchObject({valid: true, inviteCode: "ABC123", inviterName: "Quem Convidou"});
    expect(read("pending_app_invites/newbie-1")).toMatchObject({inviter_id: "inviter-1"});
  });

  it("código inexistente devolve valid false", async () => {
    const result = await validateInviteCode({
      auth: {uid: "newbie-1", token: {}},
      data: {inviteCode: "ZZZZZZ"},
    });
    expect(result).toEqual({valid: false});
  });

  it("o próprio convidante não pode usar o próprio código", async () => {
    const result = await validateInviteCode({
      auth: {uid: "inviter-1", token: {}},
      data: {inviteCode: "ABC123"},
    });
    expect(result).toEqual({valid: false});
    expect(read("pending_app_invites/inviter-1")).toBeUndefined();
  });
});
