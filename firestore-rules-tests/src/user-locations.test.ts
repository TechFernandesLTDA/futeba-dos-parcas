import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const enabledLocation = {
  user_id: UID_PLAYER_A,
  location_sharing_enabled: true,
  location_consent_at: serverTimestamp(),
  location_updated_at: serverTimestamp(),
  geohash: "6gyf4bf",
  lat: -23.55052,
  lng: -46.633308,
};

beforeAll(async () => {
  testEnv = await initTestEnv();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("user_locations rules", () => {
  it("dono pode ativar compartilhamento com consentimento e coordenadas validas", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`user_locations/${UID_PLAYER_A}`).set(enabledLocation)
    );
  });

  it("dono pode ler sua propria localizacao e admin tambem", async () => {
    await seedDoc(testEnv, `user_locations/${UID_PLAYER_A}`, {
      user_id: UID_PLAYER_A,
      location_sharing_enabled: true,
      location_consent_at: new Date(),
      location_updated_at: new Date(),
      geohash: "6gyf4bf",
      lat: -23.55052,
      lng: -46.633308,
    });

    await assertSucceeds(
      asPlayerA(testEnv).doc(`user_locations/${UID_PLAYER_A}`).get()
    );
    await assertSucceeds(
      asAdmin(testEnv).doc(`user_locations/${UID_PLAYER_A}`).get()
    );
  });

  it("terceiros e anonimos nao leem coordenadas", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`user_locations/${UID_PLAYER_A}`).get()
    );
    await assertFails(
      asAnon(testEnv).doc(`user_locations/${UID_PLAYER_A}`).get()
    );
  });

  it("dono pode revogar e limpar coordenadas/geohash", async () => {
    await seedDoc(testEnv, `user_locations/${UID_PLAYER_A}`, {
      user_id: UID_PLAYER_A,
      location_sharing_enabled: true,
      location_consent_at: new Date(),
      location_updated_at: new Date(),
      geohash: "6gyf4bf",
      lat: -23.55052,
      lng: -46.633308,
    });

    await assertSucceeds(
      asPlayerA(testEnv).doc(`user_locations/${UID_PLAYER_A}`).set({
        user_id: UID_PLAYER_A,
        location_sharing_enabled: false,
        location_updated_at: serverTimestamp(),
      })
    );
  });

  it("usuario nao pode escrever localizacao de outro usuario", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`user_locations/${UID_PLAYER_A}`).set({
        ...enabledLocation,
        user_id: UID_PLAYER_A,
      })
    );
  });

  it("payload ativo exige geohash e coordenadas validas", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`user_locations/${UID_PLAYER_A}`).set({
        ...enabledLocation,
        lat: -123,
      })
    );
    await assertFails(
      asPlayerA(testEnv).doc(`user_locations/${UID_PLAYER_A}`).set({
        ...enabledLocation,
        geohash: "",
      })
    );
  });

  it("revogacao nao pode manter coordenadas", async () => {
    await assertFails(
      asPlayerA(testEnv).doc(`user_locations/${UID_PLAYER_A}`).set({
        user_id: UID_PLAYER_A,
        location_sharing_enabled: false,
        location_updated_at: serverTimestamp(),
        lat: -23.55052,
        lng: -46.633308,
      })
    );
  });
});
