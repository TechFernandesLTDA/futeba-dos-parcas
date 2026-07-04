import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asPlayerA,
  asUser,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GAME_ID_OPEN = "vote-result-social-open";
const GAME_ID_CLOSED = "vote-result-social-closed";
const UID_OUTSIDER = "uid-vote-result-outsider";

const recentConclusion = new Date(Date.now() - 60 * 60 * 1000);
const oldConclusion = new Date(Date.now() - 80 * 60 * 60 * 1000);

const baseComment = {
  author_id: UID_PLAYER_A,
  author_name: "Player A",
  author_photo_url: null,
  text: "MVP justo demais.",
  parent_id: null,
  created_at: serverTimestamp(),
  edited_at: null,
  deleted_by: null,
  deleted_at: null,
  reactions: {},
  context: "vote_result",
};

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${GAME_ID_OPEN}`, {
    owner_id: UID_PLAYER_B,
    status: "FINISHED",
    visibility: "PUBLIC",
    voting_status: "CONCLUDED",
    voting_concluded_at: recentConclusion,
    vote_result_reactions: {},
  });
  await seedDoc(testEnv, `games/${GAME_ID_CLOSED}`, {
    owner_id: UID_PLAYER_B,
    status: "FINISHED",
    visibility: "PUBLIC",
    voting_status: "CONCLUDED",
    voting_concluded_at: oldConclusion,
    vote_result_reactions: {},
  });
  await seedDoc(testEnv, `confirmations/${GAME_ID_OPEN}_${UID_PLAYER_A}`, {
    game_id: GAME_ID_OPEN,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, `confirmations/${GAME_ID_CLOSED}_${UID_PLAYER_A}`, {
    game_id: GAME_ID_CLOSED,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("vote result social", () => {
  it("participante confirmado pode reagir no resultado dentro de 72h", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_OPEN}`).update({
        "vote_result_reactions.🔥": [UID_PLAYER_A],
      })
    );
  });

  it("bloqueia outsider e janela expirada", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc(`games/${GAME_ID_OPEN}`).update({
        "vote_result_reactions.🔥": [UID_OUTSIDER],
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CLOSED}`).update({
        "vote_result_reactions.🔥": [UID_PLAYER_A],
      })
    );
  });

  it("bloqueia mistura com campos sensiveis da votacao", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_OPEN}`).update({
        "vote_result_reactions.🔥": [UID_PLAYER_A],
        mvp_id: UID_PLAYER_A,
      })
    );
  });

  it("participante pode comentar resultado dentro de 72h com limite de 200 chars", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`games/${GAME_ID_OPEN}/comments/vote-comment-ok`).set(baseComment)
    );
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_OPEN}/comments/vote-comment-long`).set({
        ...baseComment,
        text: "x".repeat(201),
      })
    );
  });

  it("bloqueia comentario de resultado apos 72h", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`games/${GAME_ID_CLOSED}/comments/vote-comment-closed`).set({
        ...baseComment,
        text: "Cheguei tarde.",
      })
    );
  });
});
