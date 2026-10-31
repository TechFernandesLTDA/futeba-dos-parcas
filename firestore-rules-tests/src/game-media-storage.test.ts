/**
 * FIX #4393 — Storage Rules: leitura de mídia de jogo (fotos, vídeos e
 * thumbnails) só para quem pode ver o jogo (canViewGameMedia), em paridade
 * com canViewGameById do firestore.rules.
 *
 * Observação: URLs com token de download não passam pelas Storage Rules;
 * estas regras protegem as leituras via SDK (getDownloadURL/getMetadata/
 * list). O upload existente (confirmado/organizador em jogo FINISHED)
 * continua liberado.
 */
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  EMULATOR_PORT,
  PROJECT_ID,
  STORAGE_EMULATOR_PORT,
  seedDoc,
} from "./helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIRESTORE_RULES = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");
const STORAGE_RULES = readFileSync(resolve(__dirname, "../../storage.rules"), "utf8");

const GROUP_ID = "gms4393-group";
const UID_OWNER = "gms4393-owner";
const UID_MEMBER = "gms4393-member";
const UID_PARTICIPANT = "gms4393-participant";
const UID_OUTSIDER = "gms4393-outsider";
const UID_ADMIN = "gms4393-admin";

const PRIVATE_GAME = "gms4393-private"; // GROUP_ONLY com grupo
const NO_GROUP_GAME = "gms4393-no-group"; // privado sem grupo
const PUBLIC_GAME = "gms4393-public";
const DELETED_GAME = "gms4393-deleted";

const smallJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const smallMp4 = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

let testEnv: RulesTestEnvironment;

function storageAs(uid: string, claims: Record<string, unknown> = {}) {
  return testEnv.authenticatedContext(uid, { role: "PLAYER", ...claims }).storage();
}

function urlAs(uid: string | null, path: string, claims: Record<string, unknown> = {}) {
  const storage = uid ? storageAs(uid, claims) : testEnv.unauthenticatedContext().storage();
  return storage.ref(path).getDownloadURL();
}

async function seedObject(path: string, bytes: Uint8Array, contentType: string) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.storage().ref(path).put(bytes, { contentType });
  });
}

const photoPath = (gameId: string) => `games/${gameId}/photos/${UID_OWNER}/a.jpg`;
const videoPath = (gameId: string) => `games/${gameId}/videos/${UID_OWNER}/clip.mp4`;
const thumbPath = (gameId: string) => `games/${gameId}/video_thumbnails/clip.jpg`;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: FIRESTORE_RULES, host: "127.0.0.1", port: EMULATOR_PORT },
    storage: { rules: STORAGE_RULES, host: "127.0.0.1", port: STORAGE_EMULATOR_PORT },
  });

  const base = {
    owner_id: UID_OWNER,
    co_organizers: [],
    status: "FINISHED",
    visibility: "GROUP_ONLY",
    group_id: GROUP_ID,
  };
  await seedDoc(testEnv, `groups/${GROUP_ID}`, { owner_id: UID_OWNER, name: "G" });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_MEMBER}`, {
    user_id: UID_MEMBER,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `games/${PRIVATE_GAME}`, base);
  await seedDoc(testEnv, `games/${NO_GROUP_GAME}`, { ...base, group_id: null });
  await seedDoc(testEnv, `games/${PUBLIC_GAME}`, { ...base, visibility: "PUBLIC_OPEN", group_id: null });
  await seedDoc(testEnv, `games/${DELETED_GAME}`, { ...base, deleted_at: new Date() });
  await seedDoc(testEnv, `confirmations/${NO_GROUP_GAME}_${UID_PARTICIPANT}`, {
    game_id: NO_GROUP_GAME,
    user_id: UID_PARTICIPANT,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, `confirmations/${PRIVATE_GAME}_${UID_MEMBER}`, {
    game_id: PRIVATE_GAME,
    user_id: UID_MEMBER,
    status: "CONFIRMED",
  });

  for (const gameId of [PRIVATE_GAME, NO_GROUP_GAME, PUBLIC_GAME, DELETED_GAME]) {
    await seedObject(photoPath(gameId), smallJpeg, "image/jpeg");
    await seedObject(videoPath(gameId), smallMp4, "video/mp4");
    await seedObject(thumbPath(gameId), smallJpeg, "image/jpeg");
  }
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Storage — mídia de jogo privado com grupo (#4393)", () => {
  it("membro ativo e dono leem foto, vídeo e thumbnail", async () => {
    for (const uid of [UID_MEMBER, UID_OWNER]) {
      await assertSucceeds(urlAs(uid, photoPath(PRIVATE_GAME)));
      await assertSucceeds(urlAs(uid, videoPath(PRIVATE_GAME)));
      await assertSucceeds(urlAs(uid, thumbPath(PRIVATE_GAME)));
    }
  });

  it("estranho autenticado é negado em foto, vídeo e thumbnail", async () => {
    await assertFails(urlAs(UID_OUTSIDER, photoPath(PRIVATE_GAME)));
    await assertFails(urlAs(UID_OUTSIDER, videoPath(PRIVATE_GAME)));
    await assertFails(urlAs(UID_OUTSIDER, thumbPath(PRIVATE_GAME)));
  });

  it("estranho não lista o diretório de fotos do jogo", async () => {
    await assertFails(
      storageAs(UID_OUTSIDER).ref(`games/${PRIVATE_GAME}/photos/${UID_OWNER}`).listAll()
    );
  });

  it("anônimo é negado", async () => {
    await assertFails(urlAs(null, photoPath(PRIVATE_GAME)));
  });

  it("admin lê", async () => {
    await assertSucceeds(urlAs(UID_ADMIN, photoPath(PRIVATE_GAME), { role: "ADMIN" }));
  });
});

describe("Storage — outros tipos de jogo (#4393)", () => {
  it("jogo privado sem grupo: participante confirmado lê, estranho não", async () => {
    await assertSucceeds(urlAs(UID_PARTICIPANT, photoPath(NO_GROUP_GAME)));
    await assertSucceeds(urlAs(UID_PARTICIPANT, videoPath(NO_GROUP_GAME)));
    await assertFails(urlAs(UID_OUTSIDER, photoPath(NO_GROUP_GAME)));
  });

  it("jogo público: qualquer autenticado lê", async () => {
    await assertSucceeds(urlAs(UID_OUTSIDER, photoPath(PUBLIC_GAME)));
    await assertSucceeds(urlAs(UID_OUTSIDER, videoPath(PUBLIC_GAME)));
    await assertSucceeds(urlAs(UID_OUTSIDER, thumbPath(PUBLIC_GAME)));
  });

  it("jogo privado soft-deleted: membro negado, admin lê", async () => {
    await assertFails(urlAs(UID_MEMBER, photoPath(DELETED_GAME)));
    await assertSucceeds(urlAs(UID_ADMIN, photoPath(DELETED_GAME), { role: "ADMIN" }));
  });

  it("thumbnail continua server-only para escrita", async () => {
    await assertFails(
      storageAs(UID_OWNER).ref(`games/${PRIVATE_GAME}/video_thumbnails/x.jpg`)
        .put(smallJpeg, { contentType: "image/jpeg" })
    );
  });
});

describe("Storage — upload existente não regride (#4393)", () => {
  it("jogador confirmado sobe foto e vídeo no jogo FINISHED", async () => {
    await assertSucceeds(
      storageAs(UID_MEMBER).ref(`games/${PRIVATE_GAME}/photos/${UID_MEMBER}/new.jpg`)
        .put(smallJpeg, { contentType: "image/jpeg" })
    );
    await assertSucceeds(
      storageAs(UID_MEMBER).ref(`games/${PRIVATE_GAME}/videos/${UID_MEMBER}/new.mp4`)
        .put(smallMp4, { contentType: "video/mp4" })
    );
  });

  it("estranho continua sem subir foto", async () => {
    await assertFails(
      storageAs(UID_OUTSIDER).ref(`games/${PRIVATE_GAME}/photos/${UID_OUTSIDER}/new.jpg`)
        .put(smallJpeg, { contentType: "image/jpeg" })
    );
  });
});
