import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
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

const GROUP_ID = "group-polls-001";
const POLL_ID = "poll-001";
const POLL_ID_UPDATABLE = "poll-updatable-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Grupo Enquetes",
    owner_id: UID_PLAYER_A,
    is_public: false,
    status: "ACTIVE",
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

  await seedDoc(testEnv, `group_polls/${POLL_ID}`, {
    group_id: GROUP_ID,
    question: "Qual horario?",
    options: [
      { id: "option_1", text: "Domingo" },
      { id: "option_2", text: "Quarta" },
    ],
    created_by: UID_PLAYER_A,
    created_by_name: "Player A",
    status: "ACTIVE",
    created_at: new Date(),
    updated_at: new Date(),
  });

  await seedDoc(testEnv, `group_polls/${POLL_ID_UPDATABLE}`, {
    group_id: GROUP_ID,
    question: "Enquete para edição",
    options: [
      { id: "option_1", text: "Opcao 1" },
      { id: "option_2", text: "Opcao 2" },
    ],
    created_by: UID_PLAYER_A,
    created_by_name: "Player A",
    status: "ACTIVE",
    created_at: new Date(),
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("group_polls", () => {
  it("membro pode ler enquete do grupo", async () => {
    await assertSucceeds(asPlayerB(testEnv).doc(`group_polls/${POLL_ID}`).get());
  });

  it("nao-membro nao pode ler enquete privada", async () => {
    await assertFails(asPlayerC(testEnv).doc(`group_polls/${POLL_ID}`).get());
  });

  it("membro pode criar enquete ativa", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc("group_polls/poll-by-b").set({
        group_id: GROUP_ID,
        question: "Onde vamos jogar?",
        options: [
          { id: "option_1", text: "Campo A" },
          { id: "option_2", text: "Campo B" },
        ],
        created_by: UID_PLAYER_B,
        created_by_name: "Player B",
        status: "ACTIVE",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("nao-membro nao pode criar enquete", async () => {
    await assertFails(
      asPlayerC(testEnv).doc("group_polls/poll-by-c").set({
        group_id: GROUP_ID,
        question: "Fraude?",
        options: [
          { id: "option_1", text: "Sim" },
          { id: "option_2", text: "Nao" },
        ],
        created_by: UID_PLAYER_C,
        created_by_name: "Player C",
        status: "ACTIVE",
        created_at: new Date(),
        updated_at: new Date(),
      })
    );
  });

  it("anonimo nao pode criar enquete", async () => {
    await assertFails(
      asAnon(testEnv).doc("group_polls/poll-anon").set({
        group_id: GROUP_ID,
        question: "Anon?",
        options: [
          { id: "option_1", text: "Sim" },
          { id: "option_2", text: "Nao" },
        ],
        created_by: "anon",
        status: "ACTIVE",
      })
    );
  });

  it("criador pode atualizar status da enquete", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`group_polls/${POLL_ID_UPDATABLE}`).update({
        status: "CLOSED",
        updated_at: new Date(),
      })
    );
  });

  it("membro nao pode editar pergunta da enquete", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`group_polls/${POLL_ID_UPDATABLE}`).update({
        question: "Texto alterado indevidamente",
        updated_at: new Date(),
      })
    );
  });

  it("criador pode deletar enquete", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`group_polls/${POLL_ID_UPDATABLE}`).delete()
    );
  });

  it("membro comum nao consegue deletar enquete sem role admin", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`group_polls/${POLL_ID}`).delete()
    );
  });
});

describe("group_poll_votes", () => {
  it("membro pode votar em enquete ativa", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_B}`).set({
        poll_id: POLL_ID,
        group_id: GROUP_ID,
        option_id: "option_1",
        user_id: UID_PLAYER_B,
        updated_at: new Date(),
      })
    );
  });

  it("membro nao pode votar por outro usuario", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_C}`).set({
        poll_id: POLL_ID,
        group_id: GROUP_ID,
        option_id: "option_1",
        user_id: UID_PLAYER_C,
        updated_at: new Date(),
      })
    );
  });

  it("nao-membro nao pode votar", async () => {
    await assertFails(
      asPlayerC(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_C}`).set({
        poll_id: POLL_ID,
        group_id: GROUP_ID,
        option_id: "option_2",
        user_id: UID_PLAYER_C,
        updated_at: new Date(),
      })
    );
  });

  it("membro pode ler proprio voto", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_B}`).get()
    );
  });

  it("admin pode ler voto", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_B}`).get()
    );
  });

  it("membro pode listar votos da enquete", async () => {
    await assertSucceeds(
      asPlayerB(testEnv)
        .collection("group_poll_votes")
        .where("poll_id", "==", POLL_ID)
        .where("group_id", "==", GROUP_ID)
        .get()
    );
  });

  it("nao-membro nao pode listar votos da enquete", async () => {
    await assertFails(
      asPlayerC(testEnv)
        .collection("group_poll_votes")
        .where("poll_id", "==", POLL_ID)
        .get()
    );
  });

  it("membro pode atualizar proprio voto", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_B}`).update({
        option_id: "option_2",
        updated_at: new Date(),
      })
    );
  });

  it("membro nao pode atualizar voto com id divergente", async () => {
    await assertFails(
      asPlayerC(testEnv).doc(`group_poll_votes/${POLL_ID}_${UID_PLAYER_B}`).update({
        option_id: "option_1",
        updated_at: new Date(),
      })
    );
  });
});
