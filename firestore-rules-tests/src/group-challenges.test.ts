import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const CHALLENGER_GROUP = "challenge-group-a";
const CHALLENGED_GROUP = "challenge-group-b";
const CHALLENGE_ID = "friendly-challenge-001";

const validChallenge = {
  challenger_group_id: CHALLENGER_GROUP,
  challenger_group_name: "Grupo A",
  challenged_group_id: CHALLENGED_GROUP,
  challenged_group_name: "Grupo B",
  created_by: UID_PLAYER_A,
  status: "PENDING",
  goal: "Marcar 3 gols ate domingo",
  target_count: 3,
  current_progress: 0,
  deadline: "2026-07-05",
  proposed_date: "",
  created_at: new Date(),
  updated_at: new Date(),
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `groups/${CHALLENGER_GROUP}`, {
    name: "Grupo A",
    owner_id: UID_PLAYER_A,
    is_public: true,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${CHALLENGER_GROUP}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "OWNER",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `groups/${CHALLENGED_GROUP}`, {
    name: "Grupo B",
    owner_id: UID_PLAYER_B,
    is_public: true,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${CHALLENGED_GROUP}/members/${UID_PLAYER_B}`, {
    user_id: UID_PLAYER_B,
    role: "OWNER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${CHALLENGED_GROUP}/members/${UID_PLAYER_C}`, {
    user_id: UID_PLAYER_C,
    role: "MEMBER",
    status: "ACTIVE",
  });

  await seedDoc(testEnv, `group-challenges/${CHALLENGE_ID}`, validChallenge);
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("group-challenges", () => {
  it("membro do grupo desafiante pode criar desafio com meta, alvo e prazo", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("group-challenges/challenge-valid-create").set({
        ...validChallenge,
        goal: "Fazer 5 assistencias no mes",
        target_count: 5,
      })
    );
  });

  it("nao permite criar desafio em nome de outro usuario", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("group-challenges/challenge-fake-author").set({
        ...validChallenge,
        created_by: UID_PLAYER_B,
      })
    );
  });

  it("nao-membro nao pode criar desafio para grupo alheio", async () => {
    await assertFails(
      asPlayerC(testEnv).doc("group-challenges/challenge-non-member").set({
        ...validChallenge,
        created_by: UID_PLAYER_C,
      })
    );
  });

  it("anonimo nao pode criar desafio", async () => {
    await assertFails(asAnon(testEnv).doc("group-challenges/challenge-anon").set(validChallenge));
  });

  it("membro do grupo desafiado pode aceitar desafio", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`group-challenges/${CHALLENGE_ID}`).update({
        status: "ACCEPTED",
        responded_by: UID_PLAYER_B,
        responded_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("membro simples do grupo desafiado nao pode aceitar desafio", async () => {
    await assertFails(
      asPlayerC(testEnv).doc(`group-challenges/${CHALLENGE_ID}`).update({
        status: "ACCEPTED",
        responded_by: UID_PLAYER_C,
        responded_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("membro participante pode atualizar progresso dentro do alvo", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`group-challenges/${CHALLENGE_ID}`).update({
        current_progress: 2,
        updated_at: new Date(),
      })
    );
  });

  it("nao permite progresso maior que o alvo", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`group-challenges/${CHALLENGE_ID}`).update({
        current_progress: 4,
        updated_at: new Date(),
      })
    );
  });

  it("nao permite alterar meta ou grupos apos criacao", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`group-challenges/${CHALLENGE_ID}`).update({
        goal: "Trocar a meta depois",
        updated_at: new Date(),
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`group-challenges/${CHALLENGE_ID}`).update({
        challenged_group_id: CHALLENGER_GROUP,
        updated_at: new Date(),
      })
    );
  });
});
