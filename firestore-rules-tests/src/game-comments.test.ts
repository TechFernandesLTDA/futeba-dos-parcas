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

const GAME_ID_CONFIRMED = "game-comments-confirmed";
const GAME_ID_NOT_CONFIRMED = "game-comments-not-confirmed";
const GAME_ID_GROUP_ONLY = "game-comments-group-only";
const UID_OUTSIDER = "uid-comments-outsider";
const UID_GROUP_ADMIN = "uid-comments-group-admin";
const GROUP_ID = "group-comments-test";

const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);

const baseComment = {
  author_name: "Player A",
  author_photo_url: null,
  text: "Aquele lance foi falta demais.",
  parent_id: null,
  edited_at: null,
  deleted_by: null,
  deleted_at: null,
  reactions: {},
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}`, {
    owner_id: UID_PLAYER_B,
    status: "FINISHED",
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
    status: "FINISHED",
    visibility: "PUBLIC",
    date_time: recentDate,
  });

  await seedDoc(testEnv, `games/${GAME_ID_GROUP_ONLY}`, {
    owner_id: UID_PLAYER_B,
    status: "FINISHED",
    visibility: "GROUP_ONLY",
    group_id: GROUP_ID,
    date_time: recentDate,
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    owner_id: UID_PLAYER_B,
    status: "ACTIVE",
    name: "Comments Test Group",
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

  await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`, {
    ...baseComment,
    author_id: UID_PLAYER_A,
    created_at: recentDate,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("games/{gameId}/comments", () => {
  it("jogador confirmado pode ler comentarios", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).collection(`games/${GAME_ID_CONFIRMED}/comments`).get()
    );
  });

  it("anonimo nao pode ler comentarios", async () => {
    await assertFails(
      testEnv.unauthenticatedContext().firestore().collection(`games/${GAME_ID_CONFIRMED}/comments`).get()
    );
  });

  it("outsider nao pode ler comentarios de jogo GROUP_ONLY", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).collection(`games/${GAME_ID_GROUP_ONLY}/comments`).get()
    );
  });

  it("jogador confirmado pode criar comentario raiz", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-root`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("jogador confirmado pode criar resposta com parent_id", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-reply`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        parent_id: "comment-by-player-a",
        created_at: serverTimestamp(),
      })
    );
  });

  it("dono do jogo pode comentar mesmo sem confirmacao", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-owner`).set({
        ...baseComment,
        author_id: UID_PLAYER_B,
        author_name: "Player B",
        created_at: serverTimestamp(),
      })
    );
  });

  it("admin do grupo dono pode comentar em GROUP_ONLY", async () => {
    await assertSucceeds(
      asUser(testEnv, UID_GROUP_ADMIN).doc(`games/${GAME_ID_GROUP_ONLY}/comments/comment-admin`).set({
        ...baseComment,
        author_id: UID_GROUP_ADMIN,
        author_name: "Group Admin",
        created_at: serverTimestamp(),
      })
    );
  });

  it("nao-confirmado nao pode comentar", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_NOT_CONFIRMED}/comments/comment-denied`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });

  it("nao pode forjar autoria", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-forge`).set({
        ...baseComment,
        author_id: UID_PLAYER_B,
        created_at: serverTimestamp(),
      })
    );
  });

  it("rejeita texto vazio, longo e campo extra", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-empty`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        text: "",
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-long`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        text: "x".repeat(501),
        created_at: serverTimestamp(),
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-extra`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
        injected: true,
      })
    );
  });

  it("rejeita backdate", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-backdate`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      })
    );
  });

  it("autor pode editar o proprio comentario", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        text: "Foi falta e cartão.",
        edited_at: serverTimestamp(),
      })
    );
  });

  it("jogador confirmado pode reagir ao comentario", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        "reactions.🔥": [UID_PLAYER_A],
      })
    );
  });

  it("outsider nao pode reagir ao comentario", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        "reactions.🔥": [UID_OUTSIDER],
      })
    );
  });

  it("reacao nao pode misturar edicao de texto", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        "reactions.🔥": [UID_PLAYER_A],
        text: "tentativa misturada",
      })
    );
  });

  it("nao-autor nao pode editar comentario de terceiro", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        text: "Nao foi nada.",
        edited_at: serverTimestamp(),
      })
    );
  });

  it("edicao nao pode misturar soft-delete", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        text: "Editado",
        edited_at: serverTimestamp(),
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
      })
    );
  });

  it("autor e dono podem soft-deletar comentario", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/comments/comment-delete-owner`, {
      ...baseComment,
      author_id: UID_PLAYER_A,
      created_at: recentDate,
    });

    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).update({
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
      })
    );
    await assertSucceeds(
      asPlayerB(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-delete-owner`).update({
        deleted_by: UID_PLAYER_B,
        deleted_at: serverTimestamp(),
      })
    );
  });

  it("terceiro nao pode soft-deletar comentario", async () => {
    await seedDoc(testEnv, `games/${GAME_ID_CONFIRMED}/comments/comment-delete-denied`, {
      ...baseComment,
      author_id: UID_PLAYER_B,
      author_name: "Player B",
      created_at: recentDate,
    });
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-delete-denied`).update({
        deleted_by: UID_PLAYER_A,
        deleted_at: serverTimestamp(),
      })
    );
  });

  it("hard delete e bloqueado", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-by-player-a`).delete()
    );
  });

  it("admin global pode criar comentario", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc(`games/${GAME_ID_CONFIRMED}/comments/comment-global-admin`).set({
        ...baseComment,
        author_id: UID_PLAYER_A,
        created_at: serverTimestamp(),
      })
    );
  });
});
