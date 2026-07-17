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

const UID_OWNER = "uid-group-logo-owner";
const LEGACY_GROUP_ID = "group-logo-legacy-no-status";
const INACTIVE_GROUP_ID = "group-logo-inactive";

const smallJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let testEnv: RulesTestEnvironment;

function storageAs(uid: string) {
  return testEnv.authenticatedContext(uid, {role: "PLAYER"}).storage();
}

function uploadAs(
  uid: string,
  path: string,
  contentType = "image/jpeg",
) {
  return storageAs(uid).ref(path).put(smallJpeg, {contentType});
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

  await seedDoc(testEnv, `groups/${LEGACY_GROUP_ID}`, {
    owner_id: UID_OWNER,
    name: "Grupo legado sem status",
    is_public: false,
  });

  await seedDoc(testEnv, `groups/${INACTIVE_GROUP_ID}`, {
    owner_id: UID_OWNER,
    name: "Grupo inativo",
    status: "INACTIVE",
    is_public: false,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Storage Rules — groups/{groupId}/logo|thumb", () => {
  it("permite owner legado sem status subir logo e thumb sem depender de member doc", async () => {
    await assertSucceeds(uploadAs(UID_OWNER, `groups/${LEGACY_GROUP_ID}/logo.jpg`));
    await assertSucceeds(uploadAs(UID_OWNER, `groups/${LEGACY_GROUP_ID}/thumb.jpg`));
  });

  it("mantém bloqueio para owner de grupo INACTIVE", async () => {
    await assertFails(uploadAs(UID_OWNER, `groups/${INACTIVE_GROUP_ID}/logo.jpg`));
    await assertFails(uploadAs(UID_OWNER, `groups/${INACTIVE_GROUP_ID}/thumb.jpg`));
  });
});
