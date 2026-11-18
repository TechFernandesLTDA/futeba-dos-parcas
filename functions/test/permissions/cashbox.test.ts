/**
 * Permissões e regras de negócio do caixa do grupo (UC5).
 * Callables: createCashboxEntry, voidCashboxEntry.
 * Papéis: dono (owner_id), ADMIN ativo, MEMBER, visitante e ADMIN de outro grupo.
 */

jest.mock("firebase-functions/v2", () => require("./_fake-runtime").functionsV2Module);
jest.mock("firebase-functions/v2/https", () => require("./_fake-runtime").httpsModule);
jest.mock("firebase-admin/firestore", () => require("./_fake-firestore"));
jest.mock("../../src/_db", () => ({db: () => require("./_fake-firestore").db()}));
jest.mock("../../src/middleware/rate-limiter");
jest.mock("../../src/middleware/secure-callable-wrapper", () => ({
  secureCallable: (_options: unknown, handler: unknown) => handler,
}));

import {checkRateLimit} from "../../src/middleware/rate-limiter";
import {resetFakeDb, seed, read} from "./_fake-firestore";

const {createCashboxEntry, voidCashboxEntry} = require("../../src/cashbox/callable");

const RL_OK = {allowed: true, remaining: 10, resetAt: new Date(Date.now() + 60_000)};

const REQ_ID = "req-0000000000000001";
const VERIFIED = {verified: true, name: "Renan"};

const callCreate = (uid: string | null, data: Record<string, unknown>, token: Record<string, unknown> = VERIFIED) =>
  createCashboxEntry({
    auth: uid ? {uid, token} : undefined,
    data: {groupId: "g1", type: "INCOME", amount: 10, description: "Mensalidade", requestId: REQ_ID, ...data},
  });

const callVoid = (uid: string | null, data: Record<string, unknown>) =>
  voidCashboxEntry({auth: uid ? {uid, token: VERIFIED} : undefined, data});

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.then(
    () => undefined,
    (e: {code?: string}) => e
  );
  expect(err).toBeDefined();
  expect((err as {code: string}).code).toBe(code);
}

/** Resumo válido: recomputado pelo servidor, R$ 10,00 de saldo (1000 centavos). */
function seedSummary(overrides: Record<string, unknown> = {}) {
  seed("groups/g1/cashbox_summary/current", {
    recomputed_by_server: true,
    truncated: false,
    balance: 10,
    total_income: 10,
    total_expense: 0,
    balance_cents: 1000,
    total_income_cents: 1000,
    total_expense_cents: 0,
    entry_count: 1,
    ledger_version: 7,
    ...overrides,
  });
}

function seedGroup(overrides: Record<string, unknown> = {}) {
  seed("groups/g1", {owner_id: "owner-1", status: "ACTIVE", ...overrides});
}

function seedMember(uid: string, role: string, status = "ACTIVE", groupId = "g1") {
  seed(`groups/${groupId}/members/${uid}`, {user_id: uid, role, status});
}

function seedBaseline() {
  seedGroup();
  seedMember("owner-1", "OWNER");
  seedMember("admin-1", "ADMIN");
  seedMember("member-1", "MEMBER");
  seedSummary();
  seed("users/admin-1", {name: "Admin"});
}

describe("createCashboxEntry - permissões por papel (UC4/UC5)", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
    seedBaseline();
  });

  it("ADMIN ativo verificado registra INCOME e o saldo sobe", async () => {
    const result = await callCreate("admin-1", {amount: 10});

    expect(result).toMatchObject({entryId: REQ_ID, balanceCents: 2000, duplicate: false});
    expect(read(`groups/g1/cashbox/${REQ_ID}`)).toMatchObject({
      type: "INCOME",
      amount_cents: 1000,
      status: "ACTIVE",
      created_by: "admin-1",
    });
    expect(read("groups/g1/cashbox_summary/current")).toMatchObject({balance_cents: 2000, entry_count: 2});
  });

  it("dono do grupo (owner_id) registra EXPENSE válido e o saldo cai", async () => {
    const result = await callCreate("owner-1", {type: "EXPENSE", amount: 4});

    expect(result).toMatchObject({balanceCents: 600, duplicate: false});
    expect(read("groups/g1/cashbox_summary/current")).toMatchObject({balance_cents: 600});
  });

  it("MEMBER comum é bloqueado com permission-denied", async () => {
    await expectCode(callCreate("member-1", {}), "permission-denied");
    expect(read(`groups/g1/cashbox/${REQ_ID}`)).toBeUndefined();
  });

  it("visitante sem vínculo com o grupo é bloqueado", async () => {
    await expectCode(callCreate("visitor-1", {}), "permission-denied");
  });

  it("ADMIN de OUTRO grupo não movimenta o caixa de g1", async () => {
    seed("groups/g2/members/admin-g2", {user_id: "admin-g2", role: "ADMIN", status: "ACTIVE"});
    await expectCode(callCreate("admin-g2", {}), "permission-denied");
  });

  it("ADMIN com vínculo INATIVO não movimenta o caixa", async () => {
    seedMember("admin-2", "ADMIN", "PENDING");
    await expectCode(callCreate("admin-2", {}), "permission-denied");
  });

  it("papel global ADMIN no token sem vínculo no grupo continua bloqueado pela checagem de gestor", async () => {
    await expectCode(
      callCreate("global-admin", {}, {verified: true, admin: true}),
      "permission-denied"
    );
  });

  it("usuário não verificado e fora da carência é barrado antes de qualquer leitura", async () => {
    await expectCode(callCreate("admin-1", {}, {verified: false}), "permission-denied");
    expect(read(`groups/g1/cashbox/${REQ_ID}`)).toBeUndefined();
  });

  it("sem autenticação devolve unauthenticated", async () => {
    await expectCode(callCreate(null, {}), "unauthenticated");
  });

});

describe("createCashboxEntry - validação e estados do grupo", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
    seedBaseline();
  });

  it("grupo inexistente devolve not-found", async () => {
    resetFakeDb();
    seedMember("admin-1", "ADMIN");
    await expectCode(callCreate("admin-1", {}), "not-found");
  });

  it("grupo excluído (deleted_at) não aceita movimentação", async () => {
    seedGroup({deleted_at: new Date()});
    await expectCode(callCreate("admin-1", {}), "failed-precondition");
  });

  it("EXPENSE acima do saldo é recusado", async () => {
    await expectCode(callCreate("admin-1", {type: "EXPENSE", amount: 10.01}), "failed-precondition");
  });

  it("resumo não recomputado pelo servidor exige reconciliação", async () => {
    seedSummary({recomputed_by_server: false});
    await expectCode(callCreate("admin-1", {}), "failed-precondition");
  });

  it("valor zero é inválido", async () => {
    await expectCode(callCreate("admin-1", {amount: 0}), "invalid-argument");
  });

  it("valor acima do teto por lançamento é inválido", async () => {
    await expectCode(callCreate("admin-1", {amount: 100000.01}), "invalid-argument");
  });

  it("receiptUrl não-https é recusado", async () => {
    await expectCode(
      callCreate("admin-1", {receiptUrl: "http://example.test/nota.pdf"}),
      "invalid-argument"
    );
  });

});

describe("createCashboxEntry - idempotência por requestId", () => {
  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
    seedBaseline();
  });

  it("repetir exatamente o mesmo lançamento devolve duplicate sem somar de novo", async () => {
    await callCreate("admin-1", {amount: 10});
    const second = await callCreate("admin-1", {amount: 10});

    expect(second).toMatchObject({duplicate: true, balanceCents: 2000});
    expect(read("groups/g1/cashbox_summary/current")).toMatchObject({balance_cents: 2000});
  });

  it("reutilizar requestId com outro valor é recusado com already-exists", async () => {
    await callCreate("admin-1", {amount: 10});
    await expectCode(callCreate("admin-1", {amount: 11}), "already-exists");
  });
});

describe("voidCashboxEntry - estorno restrito a gestores", () => {
  const ENTRY = "entry-0000000001";

  beforeEach(() => {
    resetFakeDb();
    jest.clearAllMocks();
    (checkRateLimit as jest.Mock).mockResolvedValue(RL_OK);
    seedBaseline();
    seed(`groups/g1/cashbox/${ENTRY}`, {
      type: "INCOME",
      amount: 10,
      amount_cents: 1000,
      status: "ACTIVE",
      category: "OTHER",
    });
  });

  it("ADMIN estorna lançamento ativo e o saldo diminui", async () => {
    const result = await callVoid("admin-1", {groupId: "g1", entryId: ENTRY});

    expect(result).toMatchObject({entryId: ENTRY, duplicate: false});
    expect(read(`groups/g1/cashbox/${ENTRY}`)).toMatchObject({status: "VOIDED"});
    expect(read("groups/g1/cashbox_summary/current")).toMatchObject({balance_cents: 0});
  });

  it("estornar o mesmo lançamento duas vezes não subtrai duas vezes", async () => {
    await callVoid("admin-1", {groupId: "g1", entryId: ENTRY});
    const again = await callVoid("admin-1", {groupId: "g1", entryId: ENTRY});

    expect(again).toMatchObject({duplicate: true});
    expect(read("groups/g1/cashbox_summary/current")).toMatchObject({balance_cents: 0});
  });

  it("MEMBER comum não estorna lançamento", async () => {
    await expectCode(callVoid("member-1", {groupId: "g1", entryId: ENTRY}), "permission-denied");
    expect(read(`groups/g1/cashbox/${ENTRY}`)).toMatchObject({status: "ACTIVE"});
  });

  it("lançamento inexistente devolve not-found", async () => {
    await expectCode(callVoid("admin-1", {groupId: "g1", entryId: "nao-existe"}), "not-found");
  });
});
