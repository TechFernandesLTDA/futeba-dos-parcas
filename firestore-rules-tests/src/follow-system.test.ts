import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `users/${UID_PLAYER_A}`, {
    name: "Player A",
    email: "a@example.com",
    role: "PLAYER",
    is_searchable: true,
    followers_count: 1,
    following_count: 1,
  });
  await seedDoc(testEnv, `users/${UID_PLAYER_B}`, {
    name: "Player B",
    email: "b@example.com",
    role: "PLAYER",
    is_searchable: true,
    followers_count: 1,
    following_count: 1,
  });
  await seedDoc(testEnv, `users/${UID_PLAYER_A}/following/${UID_PLAYER_B}`, {
    target_user_id: UID_PLAYER_B,
    since: new Date(),
  });
  await seedDoc(testEnv, `users/${UID_PLAYER_B}/followers/${UID_PLAYER_A}`, {
    follower_user_id: UID_PLAYER_A,
    since: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("follow system rules", () => {
  it("owner do grafo pode ler apenas os próprios docs de following/followers", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_A}/following/${UID_PLAYER_B}`).get()
    );
    await assertSucceeds(
      asPlayerB(testEnv).doc(`users/${UID_PLAYER_B}/followers/${UID_PLAYER_A}`).get()
    );
  });

  it("outro usuario autenticado nao pode mapear o grafo social alheio", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`users/${UID_PLAYER_A}/following/${UID_PLAYER_B}`).get()
    );
    await assertFails(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_B}/followers/${UID_PLAYER_A}`).get()
    );
  });

  it("admin ainda pode ler o grafo social quando necessário", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc(`users/${UID_PLAYER_A}/following/${UID_PLAYER_B}`).get()
    );
  });

  it("anonimo nao pode ler grafo social", async () => {
    await assertFails(
      asAnon(testEnv).doc(`users/${UID_PLAYER_A}/following/${UID_PLAYER_B}`).get()
    );
  });

  it("cliente nao pode criar seguir direto", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_A}/following/direct-write`).set({
        target_user_id: "direct-write",
        since: serverTimestamp(),
      })
    );
  });

  it("cliente nao pode deletar seguir direto", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_A}/following/${UID_PLAYER_B}`).delete()
    );
  });

  it("cliente nao pode alterar contadores sociais diretamente", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_A}`).update({
        following_count: 99,
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_B}`).update({
        followers_count: 99,
      })
    );
  });
});
