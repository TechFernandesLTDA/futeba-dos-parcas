/**
 * Permissões — caixa do grupo (cashbox, cashbox_summary, monthly_finance_config, monthly_member_roster).
 *
 * Fonte das regras: firestore.rules
 *   - cashbox e cashbox_summary: linhas 2667-2683
 *   - monthly_finance_config e monthly_member_roster: linhas 2691-2716
 *
 * Regra de negócio (UC5): o ledger é server-authoritative. Os clientes, inclusive
 * ADMIN e dono, NÃO gravam lançamentos pelas rules; a escrita passa pela callable
 * createCashboxEntry / voidCashboxEntry. Por isso, aqui a escrita de ADMIN e dono
 * é testada como negada (teste de rules). O caminho positivo da escrita fica na
 * camada Functions, não aqui.
 *
 * Leitura: membro ativo e dono (inclusive dono legado sem doc de membro) leem.
 * Membro inativo, visitante, anônimo e dono de outro grupo não leem.
 */

import { describe, it, beforeAll, beforeEach, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { initTestEnv, seedDocs, asUser } from "./helpers.js";

const UID_DONO = "user-owner";
const UID_ADMIN = "user-admin";
const UID_MEMBRO = "user-member";
const UID_INATIVO = "user-inactive";
const UID_VISITANTE = "user-visitor";
const UID_DONO_LEGADO = "user-owner-legacy";
const UID_OUTRO_DONO = "user-outsider";

const CAIXA = "grp-caixa-01";
const CAIXA_LEGADO = "grp-caixa-02";
const CAIXA_OUTRO = "grp-caixa-03";

let testEnv: RulesTestEnvironment;

const membro = () => asUser(testEnv, UID_MEMBRO);
const admin = () => asUser(testEnv, UID_ADMIN);
const dono = () => asUser(testEnv, UID_DONO);
const visitante = () => asUser(testEnv, UID_VISITANTE);
const lancamento = () => ({
  amount: 100,
  type: "INCOME",
  description: "Mensalidade de teste",
  created_at: new Date(),
});

async function seedBase() {
  await seedDocs(testEnv, [
    {
      path: `groups/${CAIXA}`,
      data: { name: "Caixa Teste", owner_id: UID_DONO, is_public: false, status: "ACTIVE", member_count: 3, created_at: new Date() },
    },
    { path: `groups/${CAIXA}/members/${UID_DONO}`, data: { user_id: UID_DONO, role: "OWNER", status: "ACTIVE" } },
    { path: `groups/${CAIXA}/members/${UID_ADMIN}`, data: { user_id: UID_ADMIN, role: "ADMIN", status: "ACTIVE" } },
    { path: `groups/${CAIXA}/members/${UID_MEMBRO}`, data: { user_id: UID_MEMBRO, role: "MEMBER", status: "ACTIVE" } },
    { path: `groups/${CAIXA}/members/${UID_INATIVO}`, data: { user_id: UID_INATIVO, role: "MEMBER", status: "INACTIVE" } },
    { path: `groups/${CAIXA}/cashbox/lanc-1`, data: lancamento() },
    { path: `groups/${CAIXA}/cashbox_summary/atual`, data: { balance: 100, updated_at: new Date() } },
    { path: `groups/${CAIXA}/monthly_finance_config/padrao`, data: { enabled: true } },
    {
      path: `groups/${CAIXA}/monthly_member_roster/${UID_MEMBRO}`,
      data: { user_id: UID_MEMBRO, amount_cents: 5000 },
    },
    // Dono legado: grupo sem doc de membro para o dono
    {
      path: `groups/${CAIXA_LEGADO}`,
      data: { name: "Grupo Legado", owner_id: UID_DONO_LEGADO, is_public: false, status: "ACTIVE", member_count: 1, created_at: new Date() },
    },
    { path: `groups/${CAIXA_LEGADO}/cashbox/lanc-legado`, data: lancamento() },
    {
      path: `groups/${CAIXA_OUTRO}`,
      data: { name: "Outro Caixa", owner_id: UID_OUTRO_DONO, is_public: false, status: "ACTIVE", member_count: 1, created_at: new Date() },
    },
    { path: `groups/${CAIXA_OUTRO}/members/${UID_OUTRO_DONO}`, data: { user_id: UID_OUTRO_DONO, role: "OWNER", status: "ACTIVE" } },
  ]);
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBase();
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ============================================================
// LEITURA DO CAIXA
// ============================================================

describe("caixa — leitura", () => {
  it("membro ativo lê lançamentos e o resumo do caixa", async () => {
    await assertSucceeds(membro().doc(`groups/${CAIXA}/cashbox/lanc-1`).get());
    await assertSucceeds(membro().doc(`groups/${CAIXA}/cashbox_summary/atual`).get());
  });

  it("dono legado, sem doc de membro, lê o caixa do próprio grupo", async () => {
    await assertSucceeds(asUser(testEnv, UID_DONO_LEGADO).doc(`groups/${CAIXA_LEGADO}/cashbox/lanc-legado`).get());
  });

  it("administrador do grupo lê o resumo do caixa", async () => {
    await assertSucceeds(admin().doc(`groups/${CAIXA}/cashbox_summary/atual`).get());
  });

  it("membro com status INACTIVE NÃO lê o caixa", async () => {
    await assertFails(asUser(testEnv, UID_INATIVO).doc(`groups/${CAIXA}/cashbox/lanc-1`).get());
  });

  it("visitante sem vínculo e anônimo NÃO leem o caixa", async () => {
    await assertFails(visitante().doc(`groups/${CAIXA}/cashbox/lanc-1`).get());
    await assertFails(testEnv.unauthenticatedContext().firestore().doc(`groups/${CAIXA}/cashbox/lanc-1`).get());
  });

  it("dono de outro grupo NÃO lê o caixa deste grupo", async () => {
    await assertFails(asUser(testEnv, UID_OUTRO_DONO).doc(`groups/${CAIXA}/cashbox/lanc-1`).get());
  });
});

// ============================================================
// ESCRITA DO CAIXA (sempre pela callable, nunca pelo cliente)
// ============================================================

describe("caixa — escrita direta é negada a todos os papéis", () => {
  it("dono, administrador, membro e visitante NÃO criam lançamento direto", async () => {
    await assertFails(dono().doc(`groups/${CAIXA}/cashbox/novo-dono`).set(lancamento()));
    await assertFails(admin().doc(`groups/${CAIXA}/cashbox/novo-admin`).set(lancamento()));
    await assertFails(membro().doc(`groups/${CAIXA}/cashbox/novo-membro`).set(lancamento()));
    await assertFails(visitante().doc(`groups/${CAIXA}/cashbox/novo-visitante`).set(lancamento()));
  });

  it("dono NÃO altera nem apaga lançamento existente", async () => {
    await assertFails(dono().doc(`groups/${CAIXA}/cashbox/lanc-1`).update({ amount: 999 }));
    await assertFails(dono().doc(`groups/${CAIXA}/cashbox/lanc-1`).delete());
  });

  it("dono NÃO grava o resumo do caixa, que é derivado no servidor", async () => {
    await assertFails(dono().doc(`groups/${CAIXA}/cashbox_summary/atual`).update({ balance: 0 }));
  });
});

// ============================================================
// MENSALISTAS: CONFIGURAÇÃO E ROSTER
// ============================================================

describe("caixa — mensalistas", () => {
  it("membro lê a configuração mensal e visitante NÃO lê", async () => {
    await assertSucceeds(membro().doc(`groups/${CAIXA}/monthly_finance_config/padrao`).get());
    await assertFails(visitante().doc(`groups/${CAIXA}/monthly_finance_config/padrao`).get());
  });

  it("roster: o próprio pagador e o administrador leem; membro com status INACTIVE NÃO lê", async () => {
    await assertSucceeds(membro().doc(`groups/${CAIXA}/monthly_member_roster/${UID_MEMBRO}`).get());
    await assertSucceeds(admin().doc(`groups/${CAIXA}/monthly_member_roster/${UID_MEMBRO}`).get());
    await assertFails(
      asUser(testEnv, UID_INATIVO).doc(`groups/${CAIXA}/monthly_member_roster/${UID_MEMBRO}`).get()
    );
  });

  it("configuração e roster não são gravados pelo cliente, nem pelo dono", async () => {
    await assertFails(dono().doc(`groups/${CAIXA}/monthly_finance_config/padrao`).update({ enabled: false }));
    await assertFails(dono().doc(`groups/${CAIXA}/monthly_member_roster/${UID_MEMBRO}`).update({ amount_cents: 1 }));
  });
});
