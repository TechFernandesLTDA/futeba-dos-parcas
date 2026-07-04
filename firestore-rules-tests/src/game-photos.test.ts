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

const FINISHED_GAME_ID = "game-photo-finished";
const HIGHLIGHT_CREATE_GAME_ID = "game-highlight-create";
const SCHEDULED_GAME_ID = "game-photo-scheduled";
const UID_OUTSIDER = "uid-photo-outsider";

const validPhoto = {
  game_id: FINISHED_GAME_ID,
  url: "https://firebasestorage.googleapis.com/v0/b/futebadosparcas.appspot.com/o/games%2Fgame-photo-finished%2Fphotos%2Fuid-player-a-001%2Fphoto.jpg",
  storage_path: `games/${FINISHED_GAME_ID}/photos/${UID_PLAYER_A}/photo.jpg`,
  uploaded_by: UID_PLAYER_A,
  uploaded_by_name: "Player A",
  uploaded_by_photo: "",
  content_type: "image/jpeg",
  size: 512_000,
  caption: "Resenha pos-jogo",
  reactions: {},
  status: "ACTIVE",
  created_at: new Date(),
  updated_at: new Date(),
};

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
  await seedDoc(testEnv, `games/${HIGHLIGHT_CREATE_GAME_ID}`, {
    owner_id: UID_PLAYER_B,
    co_organizers: [],
    status: "FINISHED",
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
  await seedDoc(testEnv, `confirmations/${HIGHLIGHT_CREATE_GAME_ID}_${UID_PLAYER_A}`, {
    game_id: HIGHLIGHT_CREATE_GAME_ID,
    user_id: UID_PLAYER_A,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, "game_photos/photo-by-player-a", validPhoto);
  await seedDoc(testEnv, `post_game_highlights/${FINISHED_GAME_ID}`, {
    game_id: FINISHED_GAME_ID,
    reactions: {},
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("game_photos", () => {
  it("jogador confirmado pode criar foto em jogo finalizado", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("game_photos/photo-valid").set(validPhoto)
    );
  });

  it("organizador pode criar foto mesmo sem confirmacao", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc("game_photos/photo-owner").set({
        ...validPhoto,
        uploaded_by: UID_PLAYER_B,
        storage_path: `games/${FINISHED_GAME_ID}/photos/${UID_PLAYER_B}/photo.jpg`,
      })
    );
  });

  it("co-organizador pode moderar/criar foto no album", async () => {
    await assertSucceeds(
      asPlayerC(testEnv).doc("game_photos/photo-co-organizer").set({
        ...validPhoto,
        uploaded_by: UID_PLAYER_C,
        storage_path: `games/${FINISHED_GAME_ID}/photos/${UID_PLAYER_C}/photo.jpg`,
      })
    );
  });

  it("bloqueia anonimo e jogador nao confirmado", async () => {
    await assertFails(asAnon(testEnv).doc("game_photos/photo-anon").set(validPhoto));
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc("game_photos/photo-non-player").set({
        ...validPhoto,
        uploaded_by: UID_OUTSIDER,
        storage_path: `games/${FINISHED_GAME_ID}/photos/${UID_OUTSIDER}/photo.jpg`,
      })
    );
  });

  it("bloqueia foto fora de jogo finalizado", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-scheduled-game").set({
        ...validPhoto,
        game_id: SCHEDULED_GAME_ID,
        storage_path: `games/${SCHEDULED_GAME_ID}/photos/${UID_PLAYER_A}/photo.jpg`,
      })
    );
  });

  it("bloqueia path que nao pertence ao uploader e tipos inseguros", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-wrong-path").set({
        ...validPhoto,
        storage_path: `games/${FINISHED_GAME_ID}/photos/${UID_PLAYER_B}/photo.jpg`,
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-svg").set({
        ...validPhoto,
        content_type: "image/svg+xml",
      })
    );
  });

  it("bloqueia campos extras e legenda acima do limite", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-extra-field").set({
        ...validPhoto,
        raw_html: "<script>alert(1)</script>",
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-long-caption").set({
        ...validPhoto,
        caption: "a".repeat(161),
      })
    );
  });

  it("nao permite update de metadados", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-by-player-a").update({
        caption: "alterada",
        updated_at: new Date(),
      })
    );
  });

  it("permite jogador confirmado reagir a foto", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc("game_photos/photo-by-player-a").update({
        "reactions.🔥": [UID_PLAYER_A],
      })
    );
  });

  it("bloqueia reacao de terceiro nao confirmado", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc("game_photos/photo-by-player-a").update({
        "reactions.🔥": [UID_OUTSIDER],
      })
    );
  });

  it("bloqueia reacao misturada com metadados", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("game_photos/photo-by-player-a").update({
        "reactions.🔥": [UID_PLAYER_A],
        caption: "alterada",
      })
    );
  });

  it("permite delete por uploader, organizador, co-organizador e admin", async () => {
    await seedDoc(testEnv, "game_photos/photo-delete-uploader", validPhoto);
    await seedDoc(testEnv, "game_photos/photo-delete-owner", validPhoto);
    await seedDoc(testEnv, "game_photos/photo-delete-co", validPhoto);
    await seedDoc(testEnv, "game_photos/photo-delete-admin", validPhoto);

    await assertSucceeds(asPlayerA(testEnv).doc("game_photos/photo-delete-uploader").delete());
    await assertSucceeds(asPlayerB(testEnv).doc("game_photos/photo-delete-owner").delete());
    await assertSucceeds(asPlayerC(testEnv).doc("game_photos/photo-delete-co").delete());
    await assertSucceeds(asAdmin(testEnv).doc("game_photos/photo-delete-admin").delete());
  });

  it("bloqueia delete por terceiro", async () => {
    await assertFails(asUser(testEnv, UID_OUTSIDER).doc("game_photos/photo-by-player-a").delete());
  });
});

describe("post_game_highlights", () => {
  it("jogador confirmado pode criar estado social dos highlights do jogo finalizado", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`post_game_highlights/${HIGHLIGHT_CREATE_GAME_ID}`).set({
        game_id: HIGHLIGHT_CREATE_GAME_ID,
        reactions: {
          "🔥": [UID_PLAYER_A],
        },
        updated_at: serverTimestamp(),
      })
    );
  });

  it("jogador confirmado pode reagir aos highlights persistidos", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`post_game_highlights/${FINISHED_GAME_ID}`).set({
        game_id: FINISHED_GAME_ID,
        reactions: {
          "🔥": [UID_PLAYER_A],
        },
        updated_at: serverTimestamp(),
      }, { merge: true })
    );
  });

  it("bloqueia reacao de nao participante nos highlights", async () => {
    await assertFails(
      asUser(testEnv, UID_OUTSIDER).doc(`post_game_highlights/${FINISHED_GAME_ID}`).set({
        game_id: FINISHED_GAME_ID,
        reactions: {
          "🔥": [UID_OUTSIDER],
        },
        updated_at: serverTimestamp(),
      }, { merge: true })
    );
  });

  it("bloqueia metadados extras misturados com reacao nos highlights", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`post_game_highlights/${FINISHED_GAME_ID}`).set({
        game_id: FINISHED_GAME_ID,
        title: "tentativa de editar conteudo derivado",
        reactions: {
          "🔥": [UID_PLAYER_A],
        },
        updated_at: serverTimestamp(),
      }, { merge: true })
    );
  });

  it("bloqueia delete dos highlights sociais", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`post_game_highlights/${FINISHED_GAME_ID}`).delete()
    );
  });
});
