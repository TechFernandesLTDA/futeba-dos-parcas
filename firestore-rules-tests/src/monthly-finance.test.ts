import {afterAll, beforeAll, describe, it} from "vitest";
import {assertFails, assertSucceeds} from "@firebase/rules-unit-testing";
import type {RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  initTestEnv,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

const GROUP_ID = "group-monthly-finance";
const PERIOD = "2026-07";
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    owner_id: UID_PLAYER_A,
    name: "Mensalistas",
    status: "ACTIVE",
    is_public: false,
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/monthly_finance_config/current`, {
    pricing_mode: "FIXED_MONTHLY",
    fixed_monthly_cost_cents: 10000,
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/monthly_member_roster/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}`, {
    period_key: PERIOD,
    status: "DRAFT",
    total_court_cost_cents: 10000,
  });
  for (const uid of [UID_PLAYER_A, UID_PLAYER_B]) {
    await seedDoc(
      testEnv,
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers/${uid}`,
      {payer_id: uid, user_id: uid, due_cents: 5000, paid_cents: 0}
    );
  }
  await seedDoc(
    testEnv,
    `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/games/game-1`,
    {game_id: "game-1", included: true, court_cost_cents: 10000}
  );
  await seedDoc(
    testEnv,
    `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/settlements/pay-b`,
    {payer_id: UID_PLAYER_B, amount_cents: 5000, status: "ACTIVE"}
  );
  await seedDoc(
    testEnv,
    `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/events/event-1`,
    {actor_uid: UID_PLAYER_A, action: "PERIOD_BUILT"}
  );
});

afterAll(async () => testEnv.cleanup());

describe("monthly finance — leituras por escopo", () => {
  it("membro lê configuração, roster, resumo, jogos e o próprio payer", async () => {
    const db = asPlayerB(testEnv);
    await assertSucceeds(db.doc(
      `groups/${GROUP_ID}/monthly_finance_config/current`
    ).get());
    await assertSucceeds(db.doc(
      `groups/${GROUP_ID}/monthly_member_roster/${UID_PLAYER_B}`
    ).get());
    await assertSucceeds(db.doc(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}`
    ).get());
    await assertSucceeds(db.doc(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/games/game-1`
    ).get());
    await assertSucceeds(db.doc(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers/${UID_PLAYER_B}`
    ).get());
    await assertSucceeds(db.doc(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/settlements/pay-b`
    ).get());
  });

  it("membro não lê roster/payer de terceiro nem eventos gerenciais", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.doc(
      `groups/${GROUP_ID}/monthly_member_roster/${UID_PLAYER_A}`
    ).get());
    await assertFails(db.doc(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers/${UID_PLAYER_A}`
    ).get());
    await assertFails(db.doc(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/events/event-1`
    ).get());
  });

  it("owner e admin global leem pagadores e auditoria", async () => {
    for (const db of [asPlayerA(testEnv), asAdmin(testEnv)]) {
      await assertSucceeds(db.doc(
        `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers/${UID_PLAYER_B}`
      ).get());
      await assertSucceeds(db.doc(
        `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/events/event-1`
      ).get());
      await assertSucceeds(db.collection(
        `groups/${GROUP_ID}/monthly_member_roster`
      ).get());
      await assertSucceeds(db.collection(
        `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers`
      ).get());
      await assertSucceeds(db.collection(
        `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/settlements`
      ).get());
    }
  });

  it("membro comum não pode listar dados financeiros individuais", async () => {
    const db = asPlayerB(testEnv);
    await assertFails(db.collection(
      `groups/${GROUP_ID}/monthly_member_roster`
    ).get());
    await assertFails(db.collection(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers`
    ).get());
    await assertFails(db.collection(
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/settlements`
    ).get());
  });

  it("não-membro não lê nenhum subpath do domínio financeiro", async () => {
    const db = asPlayerC(testEnv);
    for (const path of [
      `groups/${GROUP_ID}/monthly_finance_config/current`,
      `groups/${GROUP_ID}/monthly_member_roster/${UID_PLAYER_B}`,
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}`,
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/games/game-1`,
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/payers/${UID_PLAYER_B}`,
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/settlements/pay-b`,
      `groups/${GROUP_ID}/monthly_finance_periods/${PERIOD}/events/event-1`,
    ]) {
      await assertFails(db.doc(path).get());
    }
  });
});

describe("monthly finance — writes somente Admin SDK", () => {
  it("owner e admin global não gravam documentos mensais diretamente", async () => {
    for (const db of [asPlayerA(testEnv), asAdmin(testEnv)]) {
      await assertFails(db.doc(
        `groups/${GROUP_ID}/monthly_finance_periods/2026-08`
      ).set({period_key: "2026-08", status: "DRAFT"}));
      await assertFails(db.doc(
        `groups/${GROUP_ID}/monthly_member_roster/${UID_PLAYER_A}`
      ).set({user_id: UID_PLAYER_A, status: "ACTIVE"}));
    }
  });
});
