/**
 * Entrada e saída de grupo (UC2/UC3), vistas pelas Cloud Functions.
 * - onJoinRequestApproved: pedido de entrada aprovado por dono/ADMIN, não por MEMBER.
 * - onMemberWritten: contador member_count por vínculo ativo (criação, saída, reativação).
 *
 * Criação de grupo e saída voluntária não são callables em functions/: são escritas
 * do cliente protegidas pelas Firestore rules, fora do escopo desta camada.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/firestore", () => require("./_fake-runtime").triggersModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/notifications/helpers", () => ({
  NotificationType: {GROUP_JOIN_APPROVED: "GROUP_JOIN_APPROVED"},
  sendNotificationToUser: jest.fn(async () => undefined),
}));

import {resetFakeDb, seed, read, pathsWithPrefix} from "./_fake-firestore";

const {onJoinRequestApproved} = require("../../src/groups/join-requests");
const {onMemberWritten} = require("../../src/groups/member-counter");

const GROUP = "g1";
const USER = "joiner-1";

function seedGroup(overrides: Record<string, unknown> = {}) {
  seed(`groups/${GROUP}`, {
    name: "Pelada Sul",
    owner_id: "owner-1",
    status: "ACTIVE",
    member_count: 3,
    ...overrides,
  });
  seed(`groups/${GROUP}/members/owner-1`, {user_id: "owner-1", role: "OWNER", status: "ACTIVE"});
  seed(`groups/${GROUP}/members/admin-1`, {user_id: "admin-1", role: "ADMIN", status: "ACTIVE"});
  seed(`groups/${GROUP}/members/member-1`, {user_id: "member-1", role: "MEMBER", status: "ACTIVE"});
}

const pending = {user_id: USER, user_name: "Joiner", status: "PENDING"};
const approvedBy = (responder: string | undefined, overrides: Record<string, unknown> = {}) => ({
  ...pending,
  status: "APPROVED",
  responded_by: responder,
  ...overrides,
});

function approve(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  params: {groupId: string; userId: string} = {groupId: GROUP, userId: USER}
) {
  return onJoinRequestApproved({
    data: {
      before: {data: () => ({...before})},
      after: {data: () => ({...after})},
    },
    params,
  });
}

describe("onJoinRequestApproved - aprovação de pedido de entrada (UC3/UC4)", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seedGroup();
    seed(`groups/${GROUP}/join_requests/${USER}`, pending);
  });

  it("aprovação por ADMIN ativo cria membro ACTIVE e soma 1 em member_count", async () => {
    await approve(pending, approvedBy("admin-1"));

    expect(read(`groups/${GROUP}/members/${USER}`)).toMatchObject({
      role: "MEMBER",
      status: "ACTIVE",
      invited_by: "admin-1",
    });
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 4});
    expect(read(`users/${USER}/groups/${GROUP}`)).toMatchObject({role: "MEMBER", member_count: 4});
  });

  it("aprovação pelo dono (owner_id) cria o membro", async () => {
    await approve(pending, approvedBy("owner-1"));
    expect(read(`groups/${GROUP}/members/${USER}`)).toMatchObject({status: "ACTIVE"});
  });

  it("aprovação por MEMBER comum é bloqueada e não cria vínculo", async () => {
    await approve(pending, approvedBy("member-1"));

    expect(read(`groups/${GROUP}/members/${USER}`)).toBeUndefined();
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
  });

  it("aprovação de usuário bloqueado no grupo é abortada", async () => {
    seed(`groups/${GROUP}/blocked_players/${USER}`, {user_id: USER});
    await approve(pending, approvedBy("admin-1"));

    expect(read(`groups/${GROUP}/members/${USER}`)).toBeUndefined();
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
  });

  it("quem já é membro não gera segunda entrada nem nova contagem", async () => {
    seed(`groups/${GROUP}/members/${USER}`, {user_id: USER, role: "MEMBER", status: "ACTIVE"});
    await approve(pending, approvedBy("admin-1"));

    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
  });

  it("retry duplicado da mesma aprovação conta uma única vez", async () => {
    await approve(pending, approvedBy("admin-1"));
    await approve(pending, approvedBy("admin-1"));

    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 4});
  });

  it("só processa a transição PENDING -> APPROVED (rejeição é ignorada)", async () => {
    await approve(pending, {...pending, status: "REJECTED", responded_by: "admin-1"});
    expect(read(`groups/${GROUP}/members/${USER}`)).toBeUndefined();
  });

  it("aprovação sem responded_by não cria membro", async () => {
    await approve(pending, approvedBy(undefined));
    expect(read(`groups/${GROUP}/members/${USER}`)).toBeUndefined();
  });

});

describe("onMemberWritten - contador de membros ativos (UC2/UC3)", () => {
  const MEMBER_PATH = `groups/${GROUP}/members/${USER}`;

  function write(
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown> | undefined,
    eventId = "evt-1"
  ) {
    return onMemberWritten({
      id: eventId,
      params: {groupId: GROUP, memberId: USER},
      data: {
        before: {data: () => (before ? {...before} : undefined)},
        after: {data: () => (after ? {...after} : undefined)},
      },
    });
  }

  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seedGroup({member_count: 3});
  });

  it("criação de membro ACTIVE (grupo recém-criado, dono vira ADMIN) soma 1", async () => {
    seed(MEMBER_PATH, {user_id: USER, role: "MEMBER", status: "ACTIVE"});
    await write(undefined, {user_id: USER, role: "MEMBER", status: "ACTIVE"});

    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 4});
    expect(pathsWithPrefix(`groups/${GROUP}/member_counter_events/`)).toHaveLength(1);
  });

  it("criação já contada pelo pedido de entrada não soma de novo", async () => {
    await write(undefined, {user_id: USER, status: "ACTIVE", _counted_by_join_request: true});
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
  });

  it("saída de membro ativo (ACTIVE -> REMOVED) subtrai 1", async () => {
    await write({user_id: USER, status: "ACTIVE"}, {user_id: USER, status: "REMOVED"});
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 2});
  });

  it("exclusão de membro que estava ativo subtrai 1", async () => {
    await write({user_id: USER, status: "ACTIVE"}, undefined);
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 2});
  });

  it("atualização sem mudança de atividade (ACTIVE -> ACTIVE) não altera a contagem", async () => {
    await write({user_id: USER, status: "ACTIVE", role: "MEMBER"}, {user_id: USER, status: "ACTIVE", role: "ADMIN"});
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
  });

  it("mesmo evento entregue duas vezes conta uma única vez", async () => {
    await write({user_id: USER, status: "ACTIVE"}, {user_id: USER, status: "REMOVED"}, "evt-dup");
    await write({user_id: USER, status: "ACTIVE"}, {user_id: USER, status: "REMOVED"}, "evt-dup");
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 2});
  });

  it("contador nunca fica negativo ao remover membro com contagem zerada", async () => {
    seed(`groups/${GROUP}`, {owner_id: "owner-1", status: "ACTIVE", member_count: 0});
    await write({user_id: USER, status: "ACTIVE"}, {user_id: USER, status: "REMOVED"});
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 0});
  });

});

describe("integração leve: entrada por pedido e contagem", () => {
  it("aprovação do ADMIN seguida da criação do membro conta uma vez só", async () => {
    resetFakeDb();
    jest.clearAllMocks();
    seedGroup({member_count: 3});
    seed(`groups/${GROUP}/join_requests/${USER}`, pending);

    await onJoinRequestApproved({
      data: {
        before: {data: () => ({...pending})},
        after: {data: () => approvedBy("admin-1")},
      },
      params: {groupId: GROUP, userId: USER},
    });
    // O trigger de contagem recebe a criação marcada como _counted_by_join_request.
    await onMemberWritten({
      id: "evt-join-1",
      params: {groupId: GROUP, memberId: USER},
      data: {
        before: {data: () => undefined},
        after: {data: () => read(`groups/${GROUP}/members/${USER}`)},
      },
    });

    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 4});
    expect(read(`groups/${GROUP}/members/${USER}`)).toMatchObject({status: "ACTIVE"});
  });
});

// #4629 item 22: quem saiu do grupo pede de novo e é aprovado.
describe("onJoinRequestApproved - volta de quem saiu do grupo", () => {
  const MEMBER = `groups/${GROUP}/members/${USER}`;

  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    seedGroup({member_count: 3});
    seed(`groups/${GROUP}/join_requests/${USER}`, pending);
  });

  it("ex-membro INACTIVE volta como MEMBER ACTIVE, sem herdar papel nem campos antigos", async () => {
    seed(MEMBER, {user_id: USER, role: "ADMIN", status: "INACTIVE", left_at: "2026-11-01"});

    await approve(pending, approvedBy("admin-1"));

    const member = read(MEMBER) as Record<string, unknown>;
    expect(member).toMatchObject({role: "MEMBER", status: "ACTIVE", invited_by: "admin-1"});
    expect(member.left_at).toBeUndefined();
    expect(member._counted_by_join_request).toBeUndefined();
    // Quem soma é o onMemberWritten (REACTIVATED); a aprovação não mexe no contador.
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
    expect(read(`users/${USER}/groups/${GROUP}`)).toMatchObject({role: "MEMBER"});
  });

  it("aprovação seguida do contador soma 1 uma vez só na volta", async () => {
    const left = {user_id: USER, role: "MEMBER", status: "INACTIVE"};
    seed(MEMBER, left);

    await approve(pending, approvedBy("admin-1"));
    await onMemberWritten({
      id: "evt-volta-1",
      params: {groupId: GROUP, memberId: USER},
      data: {
        before: {data: () => ({...left})},
        after: {data: () => read(MEMBER)},
      },
    });

    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 4});
  });

  it("segunda entrega da aprovação não altera o membro já reativado", async () => {
    seed(MEMBER, {user_id: USER, role: "MEMBER", status: "INACTIVE"});

    await approve(pending, approvedBy("admin-1"));
    const first = read(MEMBER);
    await approve(pending, approvedBy("owner-1"));

    expect(read(MEMBER)).toEqual(first);
  });

  it.each(["REMOVED", "BLOCKED", "BANNED"])("membro %s continua fora mesmo com pedido aprovado", async (status) => {
    seed(MEMBER, {user_id: USER, role: "MEMBER", status});

    await approve(pending, approvedBy("admin-1"));

    expect(read(MEMBER)).toMatchObject({status});
    expect(read(`groups/${GROUP}`)).toMatchObject({member_count: 3});
  });
});
