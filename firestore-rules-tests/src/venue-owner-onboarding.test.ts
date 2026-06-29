import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  UID_PLAYER_A,
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDocs,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDocs(testEnv, [
    {
      path: `venue_owner_onboarding/${UID_PLAYER_A}`,
      data: {
        owner_uid: UID_PLAYER_A,
        status: "IN_REVIEW",
        contact_name: "Jogador Dono",
        contact_email: "dono@test.com",
        created_at: new Date(),
      },
    },
    {
      path: `venue_owner_onboarding/${UID_PLAYER_A}/events/event-1`,
      data: {
        owner_uid: UID_PLAYER_A,
        type: "VENUE_OWNER_ONBOARDING_SUBMITTED",
        created_at: new Date(),
      },
    },
  ]);
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("venue_owner_onboarding — leitura", () => {
  it("owner pode ler a propria solicitacao e eventos", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`venue_owner_onboarding/${UID_PLAYER_A}`).get());
    await assertSucceeds(db.doc(`venue_owner_onboarding/${UID_PLAYER_A}/events/event-1`).get());
  });

  it("admin pode ler solicitacao e eventos", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(db.doc(`venue_owner_onboarding/${UID_PLAYER_A}`).get());
    await assertSucceeds(db.doc(`venue_owner_onboarding/${UID_PLAYER_A}/events/event-1`).get());
  });

  it("terceiros e anonimos nao podem ler", async () => {
    await assertFails(asPlayerB(testEnv).doc(`venue_owner_onboarding/${UID_PLAYER_A}`).get());
    await assertFails(asAnon(testEnv).doc(`venue_owner_onboarding/${UID_PLAYER_A}`).get());
  });
});

describe("venue_owner_onboarding — escrita direta negada", () => {
  it("owner, terceiros e admin nao escrevem direto pelo cliente", async () => {
    await assertFails(asPlayerA(testEnv).doc(`venue_owner_onboarding/${UID_PLAYER_A}`).update({status: "APPROVED"}));
    await assertFails(asPlayerB(testEnv).doc("venue_owner_onboarding/uid-player-b-001").set({status: "IN_REVIEW"}));
    await assertFails(asAdmin(testEnv).doc(`venue_owner_onboarding/${UID_PLAYER_A}`).update({status: "APPROVED"}));
  });

  it("eventos tambem sao somente Admin SDK/Cloud Functions", async () => {
    await assertFails(asPlayerA(testEnv).doc(`venue_owner_onboarding/${UID_PLAYER_A}/events/hack`).set({type: "HACK"}));
    await assertFails(asAdmin(testEnv).doc(`venue_owner_onboarding/${UID_PLAYER_A}/events/admin-hack`).set({type: "HACK"}));
  });
});
