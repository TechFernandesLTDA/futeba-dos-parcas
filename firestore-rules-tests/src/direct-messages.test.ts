import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asPlayerA,
  asPlayerB,
  asUser,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const UID_OUTSIDER = "uid-dm-outsider";
const CHAT_ID = [UID_PLAYER_A, UID_PLAYER_B].sort().join("_");

const chatDoc = {
  participants: [UID_PLAYER_A, UID_PLAYER_B].sort(),
  participant_names: {
    [UID_PLAYER_A]: "Player A",
    [UID_PLAYER_B]: "Player B",
  },
  participant_photos: {
    [UID_PLAYER_A]: null,
    [UID_PLAYER_B]: null,
  },
  created_at: new Date(),
  created_by: UID_PLAYER_A,
  last_message: null,
  last_message_at: null,
  last_sender_id: null,
  unread_count: {
    [UID_PLAYER_A]: 0,
    [UID_PLAYER_B]: 0,
  },
};

function validMessage(overrides: Record<string, unknown> = {}) {
  return {
    sender_id: UID_PLAYER_A,
    sender_name: "Player A",
    sender_photo_url: null,
    text: "Fala, bora jogar de novo?",
    created_at: serverTimestamp(),
    deleted_by: null,
    deleted_at: null,
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `chats/${CHAT_ID}`, chatDoc);
  await seedDoc(testEnv, `chats/${CHAT_ID}/messages/msg-a`, {
    ...validMessage({created_at: new Date()}),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("direct messages", () => {
  it("bloqueia criacao client-side do chat doc", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("chats/client-created").set(chatDoc)
    );
  });

  it("participantes leem chat e outsider nao le", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`chats/${CHAT_ID}`).get());
    await assertSucceeds(asPlayerB(testEnv).doc(`chats/${CHAT_ID}`).get());
    await assertFails(asUser(testEnv, UID_OUTSIDER).doc(`chats/${CHAT_ID}`).get());
  });

  it("participante nao cria mensagem diretamente; envio passa por Cloud Function", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}/messages/msg-valid`).set(validMessage())
    );
  });

  it("bloqueia mensagem de outsider, autoria forjada, texto longo e backdate", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc(`chats/${CHAT_ID}/messages/msg-outsider`).set(validMessage({
        sender_id: UID_OUTSIDER,
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}/messages/msg-forged`).set(validMessage({
        sender_id: UID_PLAYER_B,
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}/messages/msg-long`).set(validMessage({
        text: "x".repeat(1001),
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}/messages/msg-backdate`).set(validMessage({
        created_at: new Date(Date.now() - 60_000),
      }))
    );
  });

  it("autor pode soft-delete e nao pode hard-delete", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}/messages/msg-a`).update({
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}/messages/msg-a`).delete()
    );
  });

  it("participante nao pode atualizar metadata da conversa diretamente", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}`).update({
        last_message: "Fala, bora jogar de novo?",
        last_message_at: serverTimestamp(),
        last_sender_id: UID_PLAYER_A,
        [`unread_count.${UID_PLAYER_B}`]: 1,
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`chats/${CHAT_ID}`).update({
        participants: [UID_PLAYER_A],
      })
    );
  });

  it("participante zera somente o proprio contador de nao lidas", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`chats/${CHAT_ID}`).update({
        [`unread_count.${UID_PLAYER_B}`]: 0,
      })
    );
    await assertFails(
      asPlayerB(testEnv).doc(`chats/${CHAT_ID}`).update({
        [`unread_count.${UID_PLAYER_A}`]: 2,
      })
    );
  });

  it("usuario gerencia proprio bloqueio social", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`users/${UID_PLAYER_A}/blocked/${UID_PLAYER_B}`).set({
        target_user_id: UID_PLAYER_B,
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asPlayerB(testEnv).doc(`users/${UID_PLAYER_A}/blocked/${UID_PLAYER_B}`).set({
        target_user_id: UID_PLAYER_B,
        created_at: serverTimestamp(),
      })
    );
  });
});
