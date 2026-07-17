import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asFieldOwner,
  asPlayerA,
  asAnon,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const OFFICIAL_GROUP_ID = "official-group-001";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `official-groups/${OFFICIAL_GROUP_ID}`, {
    group_id: "group-public-001",
    name: "Grupo Oficial",
    city: "São Paulo",
    created_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("official-groups", () => {
  it("admin pode criar official-group", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc("official-groups/official-group-admin-create").set({
        group_id: "group-public-002",
        name: "Outro Oficial",
        city: "Campinas",
        created_at: new Date(),
      })
    );
  });

  it("FIELD_OWNER NÃO pode criar official-group", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(
      db.doc("official-groups/official-group-field-owner-create").set({
        group_id: "group-public-003",
        name: "Tentativa indevida",
        city: "Santos",
        created_at: new Date(),
      })
    );
  });

  it("admin pode atualizar official-group", async () => {
    const db = asAdmin(testEnv);
    await assertSucceeds(
      db.doc(`official-groups/${OFFICIAL_GROUP_ID}`).update({
        name: "Grupo Oficial Atualizado",
      })
    );
  });

  it("FIELD_OWNER NÃO pode atualizar official-group", async () => {
    const db = asFieldOwner(testEnv);
    await assertFails(
      db.doc(`official-groups/${OFFICIAL_GROUP_ID}`).update({
        name: "Tomada indevida",
      })
    );
  });

  it("usuário autenticado pode ler official-group", async () => {
    const db = asPlayerA(testEnv);
    await assertSucceeds(db.doc(`official-groups/${OFFICIAL_GROUP_ID}`).get());
  });

  it("não autenticado NÃO pode ler official-group", async () => {
    const db = asAnon(testEnv);
    await assertFails(db.doc(`official-groups/${OFFICIAL_GROUP_ID}`).get());
  });
});
