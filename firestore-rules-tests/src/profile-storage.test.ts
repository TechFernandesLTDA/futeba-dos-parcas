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
import { PROJECT_ID, STORAGE_EMULATOR_PORT } from "./helpers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_RULES = readFileSync(resolve(__dirname, "../../storage.rules"), "utf8");
const UID_OWNER = "uid-profile-storage-owner";
const UID_OTHER = "uid-profile-storage-other";
const PROFILE_PATH = `users/${UID_OWNER}/profile.jpg`;
const smallJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

let testEnv: RulesTestEnvironment;

const storageAs = (uid: string) =>
  testEnv.authenticatedContext(uid, {role: "PLAYER"}).storage();

const uploadAs = (
  uid: string,
  path = PROFILE_PATH,
  bytes: Uint8Array = smallJpeg,
  contentType = "image/jpeg",
) => storageAs(uid).ref(path).put(bytes, {contentType});

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: STORAGE_RULES,
      host: "127.0.0.1",
      port: STORAGE_EMULATOR_PORT,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Storage Rules — foto de perfil", () => {
  it("permite ao owner enviar, ler e excluir profile.jpg", async () => {
    await assertSucceeds(uploadAs(UID_OWNER));
    await assertSucceeds(storageAs(UID_OWNER).ref(PROFILE_PATH).getDownloadURL());
    await assertSucceeds(storageAs(UID_OWNER).ref(PROFILE_PATH).delete());
  });

  it("permite leitura autenticada e bloqueia leitura anônima", async () => {
    await assertSucceeds(uploadAs(UID_OWNER));
    await assertSucceeds(storageAs(UID_OTHER).ref(PROFILE_PATH).getDownloadURL());
    await assertFails(testEnv.unauthenticatedContext().storage().ref(PROFILE_PATH).getDownloadURL());
  });

  it("bloqueia escrita e deleção por outro usuário", async () => {
    await assertFails(uploadAs(UID_OTHER));
    await assertFails(storageAs(UID_OTHER).ref(PROFILE_PATH).delete());
  });

  it("bloqueia filename, MIME e tamanho fora do contrato", async () => {
    await assertFails(uploadAs(UID_OWNER, `users/${UID_OWNER}/avatar.jpg`));
    await assertFails(uploadAs(UID_OWNER, PROFILE_PATH, smallJpeg, "text/plain"));
    await assertFails(
      uploadAs(
        UID_OWNER,
        PROFILE_PATH,
        new Uint8Array(2 * 1024 * 1024),
      ),
    );
  });
});
