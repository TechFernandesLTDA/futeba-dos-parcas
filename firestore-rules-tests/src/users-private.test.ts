import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asUser,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const UID_OWNER = UID_PLAYER_A;
const UID_OTHER = UID_PLAYER_B;

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `users_private/${UID_OWNER}`, {
    phoneVerifiedAt: new Date(),
    cpfVerifiedAt: new Date(),
    phone: "11999999999",
    cpf: "12345678901",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("users_private — leitura", () => {
  it("owner pode ler seu proprio documento", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`users_private/${UID_OWNER}`).get());
  });

  it("admin pode ler documento de outro usuario", async () => {
    await assertSucceeds(asAdmin(testEnv).doc(`users_private/${UID_OWNER}`).get());
  });

  it("outro usuario nao pode ler users_private de terceiros", async () => {
    await assertFails(asUser(testEnv, UID_OTHER).doc(`users_private/${UID_OWNER}`).get());
  });
});

describe("users_private — escrita", () => {
  it("owner nao pode criar documento users_private por client", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`users_private/${UID_OWNER}`).set({
        phoneVerifiedAt: new Date(),
        cpfVerifiedAt: new Date(),
      })
    );
  });

  it("admin nao pode escrever em users_private", async () => {
    await assertFails(
      asAdmin(testEnv).doc(`users_private/${UID_OWNER}`).update({
        phoneVerifiedAt: new Date(),
      })
    );
  });

  it("qualquer usuario nao pode escrever users_private de terceiros", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`users_private/${UID_OWNER}`).set({
        phoneVerifiedAt: new Date(),
      })
    );
  });
});
