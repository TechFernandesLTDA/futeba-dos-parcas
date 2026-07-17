import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { asUser, initTestEnv, seedDocs } from "./helpers.js";

const UID_OWNER = "uid-user-group-mirror-owner";
const UID_ADMIN = "uid-user-group-mirror-admin";
const UID_TARGET = "uid-user-group-mirror-target";

let testEnv: RulesTestEnvironment;

function mirrorPath(groupId: string, userId = UID_TARGET) {
  return `users/${userId}/groups/${groupId}`;
}

async function seedMirrorFixture(groupId: string) {
  await seedDocs(testEnv, [
    {
      path: `groups/${groupId}`,
      data: {
        owner_id: UID_OWNER,
        name: "Grupo Canonico",
        photo_url: "https://cdn.example.com/group-logo.jpg",
        status: "ACTIVE",
        member_count: 3,
      },
    },
    {
      path: `groups/${groupId}/members/${UID_OWNER}`,
      data: {
        user_id: UID_OWNER,
        role: "OWNER",
        status: "ACTIVE",
      },
    },
    {
      path: `groups/${groupId}/members/${UID_ADMIN}`,
      data: {
        user_id: UID_ADMIN,
        role: "ADMIN",
        status: "ACTIVE",
      },
    },
    {
      path: `groups/${groupId}/members/${UID_TARGET}`,
      data: {
        user_id: UID_TARGET,
        role: "MEMBER",
        status: "ACTIVE",
      },
    },
    {
      path: mirrorPath(groupId),
      data: {
        group_id: groupId,
        group_name: "Grupo Antigo",
        group_photo: null,
        role: "MEMBER",
        member_count: 1,
        joined_at: new Date("2026-01-01T00:00:00.000Z"),
      },
    },
  ]);
}

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore Rules — users/{userId}/groups/{groupId}", () => {
  it("permite admin do grupo deletar mirror de outro usuário no kick cleanup", async () => {
    const groupId = "mirror-delete-by-admin";
    await seedMirrorFixture(groupId);

    await assertSucceeds(
      asUser(testEnv, UID_ADMIN).doc(mirrorPath(groupId)).delete(),
    );
  });

  it("permite propagar group_name e group_photo quando batem com o grupo autoritativo", async () => {
    const groupId = "mirror-sync-canonical-fields";
    await seedMirrorFixture(groupId);

    await assertSucceeds(
      asUser(testEnv, UID_ADMIN).doc(mirrorPath(groupId)).update({
        group_name: "Grupo Canonico",
        group_photo: "https://cdn.example.com/group-logo.jpg",
      }),
    );
  });

  it("permite atualizar role cross-user somente junto do membership autoritativo no mesmo batch", async () => {
    const groupId = "mirror-role-batch-sync";
    await seedMirrorFixture(groupId);

    const db = asUser(testEnv, UID_OWNER);
    const batch = db.batch();
    batch.update(db.doc(`groups/${groupId}/members/${UID_TARGET}`), {
      role: "ADMIN",
    });
    batch.update(db.doc(mirrorPath(groupId)), {
      role: "ADMIN",
    });

    await assertSucceeds(batch.commit());
  });

  it("nega forjar role cross-user sem atualizar o membership autoritativo", async () => {
    const groupId = "mirror-role-forge";
    await seedMirrorFixture(groupId);

    await assertFails(
      asUser(testEnv, UID_ADMIN).doc(mirrorPath(groupId)).update({
        role: "OWNER",
      }),
    );
  });

  it("nega alterar member_count cross-user por admin do grupo", async () => {
    const groupId = "mirror-member-count-forge";
    await seedMirrorFixture(groupId);

    await assertFails(
      asUser(testEnv, UID_ADMIN).doc(mirrorPath(groupId)).update({
        member_count: 999,
      }),
    );
  });

  it("nega propagar group_name divergente da fonte autoritativa", async () => {
    const groupId = "mirror-name-forge";
    await seedMirrorFixture(groupId);

    await assertFails(
      asUser(testEnv, UID_ADMIN).doc(mirrorPath(groupId)).update({
        group_name: "Grupo Forjado",
      }),
    );
  });
});
