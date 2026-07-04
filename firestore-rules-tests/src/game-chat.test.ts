import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
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

const GAME_ID_CONFIRMED = "game-chat-confirmed";
const GAME_ID_NOT_CONFIRMED = "game-chat-not-confirmed";
const GAME_ID_ARCHIVED = "game-chat-archived";
const GAME_ID_GROUP_ONLY = "game-chat-group-only";
const UID_OUTSIDER = "uid-chat-outsider";
const UID_GROUP_ADMIN = "uid-chat-group-admin";
const GROUP_ID = "group-chat-test";

const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h atrás
const archivedDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8d atrás

const baseMessage = {
  sender_name: "Player A",
  sender_photo_url: null,
  text: "Alguém leva bola?",
  deleted_by: null,
  deleted_at: null,
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}`, {
    owner_id: UID_PLAYER_B,
    status: "SCHEDULED",
    visibility: "PUBLIC",
    date_time: recentDate,
  });
  await seedDoc(testEnv, `confirmations/${GAME_ID_CONFIRMED}_${UID_PLAYER_A}`, {
    game_id: GAME_ID_CONFIRMED,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });

  await seedDoc(testEnv, `games/${GAME_ID_NOT_CONFIRMED}`, {
    owner_id: UID_PLAYER_B,
    status: "SCHEDULED",
    visibility: "PUBLIC",
    date_time: recentDate,
  });

  await seedDoc(testEnv, `games/${GAME_ID_ARCHIVED}`, {
    owner_id: UID_PLAYER_B,
    status: "FINISHED",
    visibility: "PUBLIC",
    date_time: archivedDate,
  });
  await seedDoc(testEnv, `confirmations/${GAME_ID_ARCHIVED}_${UID_PLAYER_A}`, {
    game_id: GAME_ID_ARCHIVED,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });

  await seedDoc(testEnv, `games/${GAME_ID_GROUP_ONLY}`, {
    owner_id: UID_PLAYER_B,
    status: "SCHEDULED",
    visibility: "GROUP_ONLY",
    group_id: GROUP_ID,
    date_time: recentDate,
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    owner_id: UID_PLAYER_B,
    status: "ACTIVE",
    name: "Chat Test Group",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_GROUP_ADMIN}`, {
    user_id: UID_GROUP_ADMIN,
    role: "ADMIN",
    status: "ACTIVE",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("games/{gameId}/chat", () => {
  it("jogador confirmado pode ler mensagens do chat", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).collection(`games/${GAME_ID_CONFIRMED}/chat`).get()
    );
  });

  it("usuário não-autenticado não pode ler", async () => {
    await assertFails(
      testEnv.unauthenticatedContext().firestore().collection(`games/${GAME_ID_CONFIRMED}/chat`).get()
    );
  });

  it("outsider não pode ler chat de jogo GROUP_ONLY", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).collection(`games/${GAME_ID_GROUP_ONLY}/chat`).get()
    );
  });

  it("membro do grupo pode ler chat de GROUP_ONLY", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).collection(`games/${GAME_ID_GROUP_ONLY}/chat`).get()
    );
  });

  it("jogador confirmado pode enviar mensagem", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-1`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("dono do jogo pode enviar mensagem mesmo sem confirmação", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-owner`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_B,
        sender_name: "Player B (Owner)",
        created_at: serverTimestamp(),
      })
    );
  });

  it("não-confirmado não pode enviar mensagem", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_NOT_CONFIRMED}/chat/msg-2`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("admin do grupo dono pode enviar mensagem em GROUP_ONLY", async () => {
    await assertSucceeds(
      asUser(testEnv, UID_GROUP_ADMIN).doc(`games/${GAME_ID_GROUP_ONLY}/chat/msg-admin`).set({
        ...baseMessage,
        sender_id: UID_GROUP_ADMIN,
        sender_name: "Group Admin",
        created_at: serverTimestamp(),
      })
    );
  });

  it("não pode forjar autoria (sender_id != userId)", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-forge`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_B,
        created_at: serverTimestamp(),
      })
    );
  });

  it("rejeita texto vazio", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-empty`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        text: "",
        created_at: serverTimestamp(),
      })
    );
  });

  it("rejeita texto > 500 chars", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-long`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        text: "x".repeat(501),
        created_at: serverTimestamp(),
      })
    );
  });

  it("rejeita backdate (created_at != request.time)", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-backdate`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      })
    );
  });

  it("rejeita criar mensagem em jogo arquivado (date_time + 7d < now)", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_ARCHIVED}/chat/msg-archived`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("autor pode soft-deletar própria mensagem", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/chat/msg-delete-self`, {
      ...baseMessage,
      sender_id: UID_PLAYER_A,
      created_at: recentDate,
    });
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-delete-self`).update({
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
      })
    );
  });

  it("dono do jogo pode soft-deletar mensagem de outro", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/chat/msg-delete-owner`, {
      ...baseMessage,
      sender_id: UID_PLAYER_A,
      created_at: recentDate,
    });
    await assertSucceeds(
      asPlayerB(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-delete-owner`).update({
        deleted_by: UID_PLAYER_B,
        deleted_at: serverTimestamp(),
      })
    );
  });

  it("não-autor não pode soft-deletar mensagem de terceiro", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/chat/msg-delete-foreign`, {
      ...baseMessage,
      sender_id: UID_PLAYER_B,
      sender_name: "Player B",
      created_at: recentDate,
    });
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-delete-foreign`).update({
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
      })
    );
  });

  it("soft-delete só pode alterar deleted_by e deleted_at", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/chat/msg-only-delete-fields`, {
      ...baseMessage,
      sender_id: UID_PLAYER_A,
      created_at: recentDate,
    });
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-only-delete-fields`).update({
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
        text: "editado",
      })
    );
  });

  it("hard delete é bloqueado (preserva auditoria)", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/chat/msg-hard-delete`, {
      ...baseMessage,
      sender_id: UID_PLAYER_A,
      created_at: recentDate,
    });
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-hard-delete`).delete()
    );
  });

  it("admin pode criar mensagem (bypass)", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc(`games/${GAME_ID_CONFIRMED}/chat/msg-admin`).set({
        ...baseMessage,
        sender_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });
});
