import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";
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

const GAME_ID = "game-rides-basic";
const RIDE_ID_B = `${GAME_ID}_${UID_PLAYER_B}`;
const RIDE_ID_OWNER = `${GAME_ID}_${UID_PLAYER_A}`;
const GROUP_ID = "game-rides-group";

function createRide(userId: string) {
  return {
    game_id: GAME_ID,
    group_id: GROUP_ID,
    user_id: userId,
    user_name: `Player ${userId.slice(-3)}`,
    user_photo: `https://pics/${userId}.png`,
    type: "OFFER",
    origin_label: "Aeroporto do Campo",
    destination_label: "Quadra Central",
    seats: 3,
    note: "Levo carona até o jogo",
    status: "ACTIVE",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  } as const;
}

beforeAll(async () => {
  testEnv = await initTestEnv();

  await seedDoc(testEnv, `locations/location-rides`, {
    name: "Quadra Base",
    owner_id: UID_PLAYER_A,
    is_active: true,
    is_verified: true,
    rating: 4.5,
    latitude: -23.5,
    longitude: -46.6,
  });
  await seedDoc(testEnv, `games/${GAME_ID}`, {
    owner_id: UID_PLAYER_A,
    group_id: GROUP_ID,
    co_organizers: [],
    status: "SCHEDULED",
    players_count: 0,
    goalkeepers_count: 0,
    max_players: 20,
    max_goalkeepers: 2,
  });

  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_B}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
  });

  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_C}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_C,
    status: "PENDING",
  });

  await seedDoc(testEnv, `game_rides/${RIDE_ID_OWNER}`, {
    ...createRide(UID_PLAYER_A),
    type: "REQUEST",
    seats: null,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("game_rides", () => {
  it("criador confirmado pode criar carona", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`game_rides/${RIDE_ID_B}`).set(createRide(UID_PLAYER_B))
    );
  });

  it("nao jogador confirmado nao pode criar carona", async () => {
    await assertFails(
      asUser(testEnv, UID_PLAYER_C).doc(`game_rides/${GAME_ID}_${UID_PLAYER_C}`).set({
        ...createRide(UID_PLAYER_C),
      })
    );
  });

  it("documento de carona com id divergente nao pode ser criado", async () => {
    await assertFails(
      asPlayerB(testEnv).doc(`game_rides/divergente`).set({
        ...createRide(UID_PLAYER_B),
      })
    );
  });

  it("owner do jogo pode ler carona", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`game_rides/${RIDE_ID_OWNER}`).get()
    );
  });

  it("jogador confirmado pode ler carona", async () => {
    await assertSucceeds(
      asPlayerB(testEnv).doc(`game_rides/${RIDE_ID_OWNER}`).get()
    );
  });

  it("anonimo nao consegue ler carona", async () => {
    await assertFails(
      asAnon(testEnv).doc(`game_rides/${RIDE_ID_OWNER}`).get()
    );
  });

  it("owner pode atualizar propria carona", async () => {
    await assertSucceeds(
      asPlayerA(testEnv).doc(`game_rides/${RIDE_ID_OWNER}`).update({
        note: "Cancelando por atraso",
        status: "CANCELLED",
        updated_at: serverTimestamp(),
      })
    );
  });

  it("admin nao pode atualizar carona de terceiros", async () => {
    await assertFails(
      asAdmin(testEnv).doc(`game_rides/${RIDE_ID_B}`).update({
        status: "CANCELLED",
        updated_at: serverTimestamp(),
      })
    );
  });

  it("terceiro confirmado fora da carona nao pode atualizar", async () => {
    await assertFails(
      asPlayerC(testEnv).doc(`game_rides/${RIDE_ID_B}`).update({
        note: "Tentativa indevida",
        updated_at: serverTimestamp(),
      })
    );
  });
});
