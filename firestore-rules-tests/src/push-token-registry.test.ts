import {afterAll, beforeAll, describe, it} from "vitest";
import {assertFails} from "@firebase/rules-unit-testing";
import type {RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {asAdmin, asPlayerA, initTestEnv} from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("registro privado de push", () => {
  for (const collection of ["push_tokens", "push_token_devices"]) {
    it(`nega leitura e escrita client-side em ${collection}`, async () => {
      for (const database of [asPlayerA(testEnv), asAdmin(testEnv)]) {
        const reference = database.doc(`${collection}/private-id`);
        await assertFails(reference.get());
        await assertFails(reference.set({userId: "uid", token: "secret"}));
        await assertFails(reference.update({sequence: 2}));
        await assertFails(reference.delete());
      }
    });
  }
});
