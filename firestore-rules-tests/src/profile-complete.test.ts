/**
 * Testes do Profile Complete Gate nas regras Firestore.
 */

import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asUser,
  seedDoc,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const UID_COMPLETE = "uid-profile-complete";
const UID_INCOMPLETE = "uid-profile-incomplete";
const UID_FALLBACK = "uid-profile-fallback";
const UID_EMPTY = "uid-profile-empty";
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const gameGroupId = (ownerId: string) => `profile-game-group-${ownerId}`;

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `users_private/${UID_FALLBACK}`, {
    phoneVerifiedAt: new Date(),
    cpfVerifiedAt: new Date(),
  });
  for (const uid of [UID_COMPLETE, UID_INCOMPLETE, UID_FALLBACK, UID_EMPTY]) {
    await seedDoc(testEnv, `groups/${gameGroupId(uid)}`, {
      name: "Grupo Profile Gate",
      owner_id: uid,
      status: "ACTIVE",
      member_count: 5,
    });
  }
});

afterAll(async () => {
  await testEnv.cleanup();
});

function completeClaims(profileComplete: boolean) {
  return {
    role: "PLAYER",
    verified: true,
    profileComplete,
  };
}

function validGame(ownerId: string) {
  return {
    title: "Jogo Profile Gate",
    owner_id: ownerId,
    status: "SCHEDULED",
    date_time: futureDate,
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 0,
    goalkeepers_count: 0,
    team1_score: null,
    team2_score: null,
    group_id: gameGroupId(ownerId),
    co_organizers: [],
  };
}

function validGroup(ownerId: string) {
  return {
    name: "Grupo Gate",
    owner_id: ownerId,
    is_public: true,
    status: "ACTIVE",
    description: "Grupo criado por usuario completo",
  };
}

describe("profileComplete — games create", () => {
  it("claim true permite criar jogo", async () => {
    const db = asUser(testEnv, UID_COMPLETE, completeClaims(true));
    await assertSucceeds(
      db.doc("games/profile-complete-claim-true").set(validGame(UID_COMPLETE))
    );
  });

  it("claim false sem fallback bloqueia criar jogo", async () => {
    const db = asUser(testEnv, UID_INCOMPLETE, completeClaims(false));
    await assertFails(
      db.doc("games/profile-complete-claim-false").set(validGame(UID_INCOMPLETE))
    );
  });

  it("fallback users_private/{uid} com phoneVerifiedAt + cpfVerifiedAt permite criar jogo", async () => {
    const db = asUser(testEnv, UID_FALLBACK, completeClaims(false));
    await assertSucceeds(
      db.doc("games/profile-complete-fallback").set(validGame(UID_FALLBACK))
    );
  });

  it("sem claim e sem fallback bloqueia criar jogo", async () => {
    const db = asUser(testEnv, UID_EMPTY, {role: "PLAYER", verified: true, profileComplete: false});
    await assertFails(
      db.doc("games/profile-complete-empty").set(validGame(UID_EMPTY))
    );
  });
});

describe("profileComplete — groups create", () => {
  it("claim true permite criar grupo", async () => {
    const db = asUser(testEnv, UID_COMPLETE, completeClaims(true));
    await assertSucceeds(
      db.doc("groups/profile-complete-claim-true").set(validGroup(UID_COMPLETE))
    );
  });

  it("claim false sem fallback bloqueia criar grupo", async () => {
    const db = asUser(testEnv, UID_INCOMPLETE, completeClaims(false));
    await assertFails(
      db.doc("groups/profile-complete-claim-false").set(validGroup(UID_INCOMPLETE))
    );
  });

  it("fallback users_private/{uid} com phoneVerifiedAt + cpfVerifiedAt permite criar grupo", async () => {
    const db = asUser(testEnv, UID_FALLBACK, completeClaims(false));
    await assertSucceeds(
      db.doc("groups/profile-complete-fallback").set(validGroup(UID_FALLBACK))
    );
  });

  it("sem claim e sem fallback bloqueia criar grupo", async () => {
    const db = asUser(testEnv, UID_EMPTY, {role: "PLAYER", verified: true, profileComplete: false});
    await assertFails(
      db.doc("groups/profile-complete-empty").set(validGroup(UID_EMPTY))
    );
  });
});
