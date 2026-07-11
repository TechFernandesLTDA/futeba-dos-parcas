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

const GROUP_ID = "group-wall-storage-test";
const UID_OWNER = "uid-storage-owner";
const UID_ACTIVE = "uid-storage-active";
const UID_LEGACY = "uid-storage-legacy";
const UID_INACTIVE = "uid-storage-inactive";
const UID_OUTSIDER = "uid-storage-outsider";
const UID_CORRUPT = "uid-storage-corrupt";
const GAME_ID = "game-storage-immutable";
const LOCATION_ID = "location-storage-receipt";

const smallJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const smallMp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);
const draftPath = (uid: string, fileName = "photo.jpg") =>
  `groups/${GROUP_ID}/wall_media/__draft__/${uid}/${fileName}`;

let testEnv: RulesTestEnvironment;

function storageAs(uid: string) {
  return testEnv.authenticatedContext(uid, {role: "PLAYER"}).storage();
}

async function uploadAs(
  uid: string,
  path = draftPath(uid),
  bytes: Uint8Array = smallJpeg,
  contentType = "image/jpeg",
) {
  return storageAs(uid).ref(path).put(bytes, { contentType });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: FIRESTORE_RULES,
      host: "127.0.0.1",
      port: EMULATOR_PORT,
    },
    storage: {
      rules: STORAGE_RULES,
      host: "127.0.0.1",
      port: STORAGE_EMULATOR_PORT,
    },
  });

  await seedDoc(testEnv, `groups/${GROUP_ID}`, {
    name: "Storage Rules Group",
    owner_id: UID_OWNER,
    status: "ACTIVE",
    is_public: false,
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_ACTIVE}`, {
    user_id: UID_ACTIVE,
    role: "MEMBER",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_LEGACY}`, {
    user_id: UID_LEGACY,
    role: "MEMBER",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_INACTIVE}`, {
    user_id: UID_INACTIVE,
    role: "MEMBER",
    status: "INACTIVE",
  });
  await seedDoc(testEnv, `groups/${GROUP_ID}/members/${UID_CORRUPT}`, {
    user_id: UID_ACTIVE,
    role: "ADMIN",
    status: "ACTIVE",
  });
  await seedDoc(testEnv, `games/${GAME_ID}`, {
    owner_id: UID_OWNER,
    status: "FINISHED",
    co_organizers: [],
  });
  await seedDoc(testEnv, `locations/${LOCATION_ID}`, {
    owner_id: UID_OWNER,
    is_active: true,
    is_verified: true,
    publication_status: "PUBLISHED",
    managers: [],
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Storage Rules — groups/{groupId}/wall_media", () => {
  it("permite upload no draft para owner, membro ACTIVE e membro legado sem status", async () => {
    await assertSucceeds(uploadAs(UID_OWNER));
    await assertSucceeds(uploadAs(UID_ACTIVE));
    await assertSucceeds(uploadAs(UID_LEGACY));
  });

  it("nega upload para membro INACTIVE e outsider", async () => {
    await assertFails(uploadAs(UID_INACTIVE));
    await assertFails(uploadAs(UID_OUTSIDER));
  });

  it("nega membership corrompida cujo user_id diverge do UID do path", async () => {
    await assertFails(uploadAs(UID_CORRUPT));
  });

  it("permite vídeo MP4 de até 25MB e bloqueia tipos/extensões inválidos", async () => {
    await assertSucceeds(uploadAs(UID_ACTIVE, draftPath(UID_ACTIVE, "clip.mp4"), smallMp4, "video/mp4"));
    await assertFails(uploadAs(UID_ACTIVE, draftPath(UID_ACTIVE, "photo.jpg"), smallJpeg, "text/plain"));
    await assertFails(uploadAs(UID_ACTIVE, draftPath(UID_ACTIVE, "clip.webm"), smallMp4, "video/webm"));
    await assertFails(uploadAs(UID_ACTIVE, draftPath(UID_ACTIVE, "bitmap.jpg"), smallJpeg, "image/bmp"));
    await assertFails(
      uploadAs(
        UID_ACTIVE,
        draftPath(UID_ACTIVE, "limit.jpg"),
        new Uint8Array(10 * 1024 * 1024),
      ),
    );
    await assertFails(
      uploadAs(
        UID_ACTIVE,
        draftPath(UID_ACTIVE, "limit.mp4"),
        new Uint8Array(25 * 1024 * 1024),
        "video/mp4",
      ),
    );
  });

  it("permite ao autor excluir o próprio draft e nega exclusão por outro membro", async () => {
    const ownPath = draftPath(UID_LEGACY, "delete-own.jpg");
    await assertSucceeds(uploadAs(UID_LEGACY, ownPath));
    await assertFails(storageAs(UID_ACTIVE).ref(ownPath).delete());
    await assertSucceeds(storageAs(UID_LEGACY).ref(ownPath).delete());
  });
});

describe("Storage Rules — objetos de mídia e recibos imutáveis", () => {
  it("não permite sobrescrever recibo financeiro do grupo", async () => {
    const path = `groups/${GROUP_ID}/receipts/receipt.jpg`;
    await assertSucceeds(uploadAs(UID_OWNER, path));
    await assertFails(uploadAs(UID_OWNER, path));
  });

  it("não permite ao owner sobrescrever comprovante comercial enviado", async () => {
    const path = `locations/${LOCATION_ID}/subscription_receipts/${UID_OWNER}/receipt.pdf`;
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await assertSucceeds(uploadAs(UID_OWNER, path, pdf, "application/pdf"));
    await assertFails(uploadAs(UID_OWNER, path, pdf, "application/pdf"));
  });

  it("não permite sobrescrever foto legada já publicada", async () => {
    const path = `games/${GAME_ID}/photos/legacy.jpg`;
    await assertSucceeds(uploadAs(UID_OWNER, path));
    await assertFails(uploadAs(UID_OWNER, path));
  });

  it("não permite sobrescrever foto do álbum do usuário", async () => {
    const path = `games/${GAME_ID}/photos/${UID_OWNER}/album.jpg`;
    await assertSucceeds(uploadAs(UID_OWNER, path));
    await assertFails(uploadAs(UID_OWNER, path));
  });

  it("não permite sobrescrever vídeo do jogo após o primeiro upload", async () => {
    const path = `games/${GAME_ID}/videos/${UID_OWNER}/clip.mp4`;
    await assertSucceeds(uploadAs(UID_OWNER, path, smallMp4, "video/mp4"));
    await assertFails(uploadAs(UID_OWNER, path, smallMp4, "video/mp4"));
  });
});
