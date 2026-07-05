import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asAnon,
  asPlayerA,
  asPlayerB,
  seedDoc,
  UID_ADMIN,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

function groupWallReport(overrides: Record<string, unknown> = {}) {
  return {
    reporter_id: UID_PLAYER_A,
    target_type: "group_wall_post",
    group_id: "group-1",
    post_id: "post-1",
    target_path: "groups/group-1/wall_posts/post-1",
    reason: "inappropriate_content",
    status: "OPEN",
    created_at: serverTimestamp(),
    ...overrides,
  };
}

function gameContentReport(overrides: Record<string, unknown> = {}) {
  return {
    reporter_id: UID_PLAYER_A,
    target_type: "game_comment",
    game_id: "game-1",
    target_id: "comment-1",
    target_path: "games/game-1/comments/comment-1",
    reason: "abusive_language",
    status: "OPEN",
    created_at: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, "reports/existing-open", {
    reporter_id: UID_PLAYER_A,
    target_type: "group_wall_post",
    group_id: "group-1",
    post_id: "post-1",
    target_path: "groups/group-1/wall_posts/post-1",
    reason: "inappropriate_content",
    status: "OPEN",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("reports", () => {
  it("bloqueia criacao client-side de denuncia", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("reports/group-wall-valid").set(groupWallReport())
    );
    await assertFails(
      asPlayerA(testEnv).doc("reports/game-comment-valid").set(gameContentReport())
    );
  });

  it("bloqueia anonimo, reporter forjado, target_type invalido e status inicial diferente", async () => {
    await assertFails(
      asAnon(testEnv).doc("reports/anon").set(groupWallReport())
    );
    await assertFails(
      asPlayerA(testEnv).doc("reports/spoof").set(groupWallReport({
        reporter_id: UID_PLAYER_B,
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc("reports/bad-target").set(groupWallReport({
        target_type: "user_profile",
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc("reports/bad-status").set(groupWallReport({
        status: "RESOLVED",
      }))
    );
  });

  it("somente admin le e revisa denuncia com campos de auditoria", async () => {
    await assertSucceeds(asAdmin(testEnv).doc("reports/existing-open").get());
    await assertFails(asPlayerB(testEnv).doc("reports/existing-open").get());

    await assertSucceeds(
      asAdmin(testEnv).doc("reports/existing-open").update({
        status: "REVIEWING",
        reviewed_at: serverTimestamp(),
        reviewed_by: UID_ADMIN,
      })
    );

    await assertFails(
      asPlayerB(testEnv).doc("reports/existing-open").update({
        status: "DISMISSED",
        reviewed_at: serverTimestamp(),
        reviewed_by: UID_PLAYER_B,
      })
    );
  });
});
