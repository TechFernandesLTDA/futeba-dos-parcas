import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  UID_PLAYER_A,
  UID_PLAYER_B,
  asPlayerA,
  initTestEnv,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GAME_ID = "reaction-integrity-game";
const GROUP_ID = "reaction-integrity-group";
const COMMENT_PATH = `games/${GAME_ID}/comments/comment-integrity`;

const foreignReaction = {
  "😂": [UID_PLAYER_B],
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    owner_id: UID_PLAYER_B,
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_PLAYER_A}`, {
    user_id: UID_PLAYER_A,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `games/${GAME_ID}`, {
    owner_id: UID_PLAYER_B,
    group_id: GROUP_ID,
    status: "FINISHED",
    voting_status: "CONCLUDED",
    voting_concluded_at: new Date(Date.now() - 60 * 60 * 1000),
    vote_result_reactions: foreignReaction,
  });
  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_A}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });

  await seedDoc(testEnv, COMMENT_PATH, {
    author_id: UID_PLAYER_B,
    author_name: "Player B",
    author_photo_url: null,
    text: "Comentario protegido",
    parent_id: null,
    created_at: new Date(),
    edited_at: null,
    deleted_by: null,
    deleted_at: null,
    reactions: foreignReaction,
    context: "game",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/wall_posts/post-integrity`, {
    group_id: GROUP_ID,
    author_id: UID_PLAYER_B,
    author_name: "Player B",
    author_photo_url: null,
    text: "Post protegido",
    media_url: null,
    media_path: null,
    media_type: null,
    thumbnail_path: null,
    highlight_ref: null,
    reactions: foreignReaction,
    comments_count: 0,
    pinned: false,
    pinned_by: null,
    pinned_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    edited_at: null,
    deleted_at: null,
    deleted_by: null,
  });
  await seedDoc(testEnv, "game_photos/photo-integrity", {
    game_id: GAME_ID,
    uploaded_by: UID_PLAYER_B,
    reactions: foreignReaction,
  });
  await seedDoc(testEnv, "game_videos/video-integrity", {
    game_id: GAME_ID,
    uploaded_by: UID_PLAYER_B,
    reactions: foreignReaction,
  });
  await seedDoc(testEnv, `post_game_highlights/${GAME_ID}`, {
    game_id: GAME_ID,
    reactions: foreignReaction,
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("reaction map integrity #3593", () => {
  it("permite adicionar, trocar e remover somente a propria reacao", async () => {
    const comment = asPlayerA(testEnv).doc(COMMENT_PATH);

    await assertSucceeds(comment.update({
      "reactions.🔥": [UID_PLAYER_A],
    }));
    await assertSucceeds(comment.update({
      "reactions.🔥": [],
      "reactions.👏": [UID_PLAYER_A],
    }));
    await assertSucceeds(comment.update({
      "reactions.👏": [],
    }));
  });

  it("bloqueia apagar ou fabricar reacao de terceiro", async () => {
    const comment = asPlayerA(testEnv).doc(COMMENT_PATH);

    await assertFails(comment.update({
      "reactions.😂": [],
    }));
    await assertFails(comment.update({
      "reactions.🔥": [UID_PLAYER_B],
    }));
  });

  it("bloqueia emoji desconhecido, valor escalar e UID duplicado", async () => {
    const comment = asPlayerA(testEnv).doc(COMMENT_PATH);

    await assertFails(comment.update({
      reactions: { "❤️": [UID_PLAYER_A] },
    }));
    await assertFails(comment.update({
      reactions: { "🔥": UID_PLAYER_A },
    }));
    await assertFails(comment.update({
      reactions: {
        "🔥": [UID_PLAYER_A, UID_PLAYER_A],
        ...foreignReaction,
      },
    }));
  });

  it.each([
    `groups/${GROUP_ID}/wall_posts/post-integrity`,
    "game_photos/photo-integrity",
    "game_videos/video-integrity",
    `post_game_highlights/${GAME_ID}`,
  ])("preserva reacao alheia em %s", async (path) => {
    const payload = path.startsWith("post_game_highlights/")
      ? { reactions: {}, updated_at: serverTimestamp() }
      : { reactions: {} };

    await assertFails(asPlayerA(testEnv).doc(path).update(payload));
  });

  it("preserva reacao alheia no resultado da votacao", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID}`).update({
        vote_result_reactions: {},
      })
    );
  });

  it("bloqueia reactions iniciais fabricadas pelo cliente", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID}/comments/comment-spoof-create`).set({
        author_id: UID_PLAYER_A,
        author_name: "Player A",
        author_photo_url: null,
        text: "Tentativa de spoofing",
        parent_id: null,
        created_at: serverTimestamp(),
        edited_at: null,
        deleted_by: null,
        deleted_at: null,
        reactions: foreignReaction,
        context: "game",
      })
    );
  });
});

