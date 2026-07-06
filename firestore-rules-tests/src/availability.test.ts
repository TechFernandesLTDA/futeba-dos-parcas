import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asAdmin,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const LOCATION_ID = "location-availability-001";
const SLOT_ID = "slot-001";
const SLOT_ID_MANAGER = "slot-manager";
const SLOT_ID_ADMIN = "slot-admin";

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `locations/${LOCATION_ID}`, {
    name: "Quadra Availability",
    owner_id: UID_PLAYER_A,
    is_active: true,
    is_verified: true,
    managers: [UID_PLAYER_B],
    rating: 4.5,
    latitude: -23.5,
    longitude: -46.6,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("availability", () => {
  it("owner pode criar slot de disponibilidade", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`locations/${LOCATION_ID}/availability/${SLOT_ID}`).set({
        day_of_week: 6,
        start_time: "09:00",
        end_time: "12:00",
        is_available: true,
      })
    );
  });

  it("manager pode criar slot de disponibilidade", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`locations/${LOCATION_ID}/availability/${SLOT_ID_MANAGER}`).set({
        day_of_week: 6,
        start_time: "13:00",
        end_time: "17:00",
        is_available: true,
      })
    );
  });

  it("admin pode criar slot de disponibilidade", async () => {
    await assertSucceeds(
      asAdmin(testEnv).doc(`locations/${LOCATION_ID}/availability/${SLOT_ID_ADMIN}`).set({
        day_of_week: 0,
        start_time: "18:00",
        end_time: "22:00",
        is_available: false,
      })
    );
  });

  it("usuario sem permissoes nao pode criar slot", async () => {
    await assertFails(
      asPlayerC(testEnv).doc(`locations/${LOCATION_ID}/availability/slot-outsider`).set({
        day_of_week: 1,
        start_time: "08:00",
        end_time: "10:00",
        is_available: true,
      })
    );
  });

  it("location inexistente bloqueia escrita de disponibilidade", async () => {
    await assertFails(
      asPlayerA(testEnv).doc("locations/location-inexistente/availability/slot-missing").set({
        day_of_week: 2,
        start_time: "10:00",
        end_time: "11:00",
        is_available: true,
      })
    );
  });
});
