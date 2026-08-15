import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asUser,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const FINISHED_GAME_ID = "game-video-finished";
const SCHEDULED_GAME_ID = "game-video-scheduled";
const UID_OUTSIDER = "uid-video-outsider";

const seededVideo = {
  game_id: FINISHED_GAME_ID,
  url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.appspot.com/o/video.mp4",
  storage_path: `games/${FINISHED_GAME_ID}/videos/${UID_PLAYER_A}/clip.mp4`,
  thumbnail_path: null,
  uploaded_by: UID_PLAYER_A,
  uploaded_by_name: "Player A",
  uploaded_by_photo: "",
  content_type: "video/mp4",
  size: 2_500_000,
  duration_sec: null,
  caption: "Golaço",
  reactions: {},
  status: "PROCESSING",
  rejection_reason: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function validVideo(overrides: Record<string, unknown> = {}) {
  return {
    ...seededVideo,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `games/${FINISHED_GAME_ID}`, {
    owner_id: UID_PLAYER_B,
    co_organizers: [UID_PLAYER_C],
    status: "FINISHED",
  });
  await seedDoc(testEnv, `games/${SCHEDULED_GAME_ID}`, {
    owner_id: UID_PLAYER_B,
    co_organizers: [],
    status: "SCHEDULED",
  });
  await seedDoc(testEnv, `confirmations/${FINISHED_GAME_ID}_${UID_PLAYER_A}`, {
    game_id: FINISHED_GAME_ID,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, `confirmations/${SCHEDULED_GAME_ID}_${UID_PLAYER_A}`, {
    game_id: SCHEDULED_GAME_ID,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, "game_videos/video-by-player-a", seededVideo);
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("game_videos", () => {
  it("bloqueia criacao direta mesmo para jogador confirmado", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-valid").set(validVideo())
    );
  });

  it("bloqueia criacao direta por organizador e co-organizador", async () => {
    await assertFails(
      asPlayerB(testEnv).doc("game_videos/video-owner").set(validVideo({
        uploaded_by: UID_PLAYER_B,
        storage_path: `games/${FINISHED_GAME_ID}/videos/${UID_PLAYER_B}/clip.mp4`,
      }))
    );
    await assertFails(
      asPlayerC(testEnv).doc("game_videos/video-co").set(validVideo({
        uploaded_by: UID_PLAYER_C,
        storage_path: `games/${FINISHED_GAME_ID}/videos/${UID_PLAYER_C}/clip.mp4`,
      }))
    );
  });

  it("bloqueia anonimo e jogador nao confirmado", async () => {
    await assertFails(asAnon(testEnv).doc("game_videos/video-anon").set(validVideo()));
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc("game_videos/video-outsider").set(validVideo({
        uploaded_by: UID_OUTSIDER,
        storage_path: `games/${FINISHED_GAME_ID}/videos/${UID_OUTSIDER}/clip.mp4`,
      }))
    );
  });

  it("bloqueia video fora de jogo finalizado", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-scheduled").set(validVideo({
        game_id: SCHEDULED_GAME_ID,
        storage_path: `games/${SCHEDULED_GAME_ID}/videos/${UID_PLAYER_A}/clip.mp4`,
      }))
    );
  });

  it("bloqueia path que nao pertence ao uploader, tipo inseguro e tamanho alto", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-wrong-path").set(validVideo({
        storage_path: `games/${FINISHED_GAME_ID}/videos/${UID_PLAYER_B}/clip.mp4`,
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-webm").set(validVideo({
        content_type: "video/webm",
      }))
    );
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-too-large").set(validVideo({
        size: 26 * 1024 * 1024,
      }))
    );
  });

  it("bloqueia metadados processados no create", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-ready-client").set(validVideo({
        status: "READY",
        duration_sec: 12,
        thumbnail_path: `games/${FINISHED_GAME_ID}/video_thumbnails/thumb.jpg`,
      }))
    );
  });

  it("permite jogador confirmado reagir e bloqueia metadados em update", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("game_videos/video-by-player-a").update({
        "reactions.🔥": [UID_PLAYER_A],
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc("game_videos/video-by-player-a").update({
        "reactions.🔥": [UID_PLAYER_A],
        caption: "editada",
      })
    );
  });

  it("bloqueia reacao de terceiro nao confirmado", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc("game_videos/video-by-player-a").update({
        "reactions.🔥": [UID_OUTSIDER],
      })
    );
  });

  it("permite delete por uploader, organizador, co-organizador e admin", async () => {
    await seedDoc(testEnv, "game_videos/video-delete-uploader", seededVideo);
    await seedDoc(testEnv, "game_videos/video-delete-owner", seededVideo);
    await seedDoc(testEnv, "game_videos/video-delete-co", seededVideo);
    await seedDoc(testEnv, "game_videos/video-delete-admin", seededVideo);

    await assertSucceeds(asPlayerA(testEnv).doc("game_videos/video-delete-uploader").delete());
    await assertSucceeds(asPlayerB(testEnv).doc("game_videos/video-delete-owner").delete());
    await assertSucceeds(asPlayerC(testEnv).doc("game_videos/video-delete-co").delete());
    await assertSucceeds(asAdmin(testEnv).doc("game_videos/video-delete-admin").delete());
  });

  it("bloqueia delete por terceiro", async () => {
    await assertFails(asUser(testEnv, UID_OUTSIDER).doc("game_videos/video-by-player-a").delete());
  });
});
