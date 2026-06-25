import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  initTestEnv,
  asPlayerA,
  asPlayerB,
  asPlayerC,
  asAnon,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
  UID_PLAYER_C,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;

const FINISHED_GAME = "post-game-finished-001";
const SCHEDULED_GAME = "post-game-scheduled-001";

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `games/${FINISHED_GAME}`, {
    owner_id: UID_PLAYER_A,
    status: "FINISHED",
    date_time: new Date("2026-01-01T10:00:00Z"),
  });
  await seedDoc(testEnv, `games/${SCHEDULED_GAME}`, {
    owner_id: UID_PLAYER_A,
    status: "SCHEDULED",
    date_time: new Date("2026-01-02T10:00:00Z"),
  });
  await seedDoc(testEnv, `confirmations/${FINISHED_GAME}_${UID_PLAYER_B}`, {
    game_id: FINISHED_GAME,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, `post_game_messages/${FINISHED_GAME}_${UID_PLAYER_B}`, {
    game_id: FINISHED_GAME,
    user_id: UID_PLAYER_B,
    user_name: "Player B",
    message: "Jogo bom demais.",
    created_at: new Date(),
    updated_at: new Date(),
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("post_game_messages", () => {
  it("participante confirmado pode ler recado do jogo", async () => {
    await assertSucceeds(asPlayerB(testEnv).doc(`post_game_messages/${FINISHED_GAME}_${UID_PLAYER_B}`).get());
  });

  it("dono do jogo pode ler recados", async () => {
    await assertSucceeds(asPlayerA(testEnv).doc(`post_game_messages/${FINISHED_GAME}_${UID_PLAYER_B}`).get());
  });

  it("nao-participante nao pode ler recados", async () => {
    await assertFails(asPlayerC(testEnv).doc(`post_game_messages/${FINISHED_GAME}_${UID_PLAYER_B}`).get());
  });

  it("participante confirmado pode criar recado em jogo finalizado", async () => {
    await assertSucceeds(asPlayerB(testEnv).doc(`post_game_messages/${FINISHED_GAME}_${UID_PLAYER_B}`).set({
      game_id: FINISHED_GAME,
      user_id: UID_PLAYER_B,
      user_name: "Player B",
      message: "Defesa encaixou bem.",
      created_at: new Date(),
      updated_at: new Date(),
    }));
  });

  it("nao-participante nao pode criar recado", async () => {
    await assertFails(asPlayerC(testEnv).doc(`post_game_messages/${FINISHED_GAME}_${UID_PLAYER_C}`).set({
      game_id: FINISHED_GAME,
      user_id: UID_PLAYER_C,
      user_name: "Player C",
      message: "Entrei sem jogar.",
      created_at: new Date(),
      updated_at: new Date(),
    }));
  });

  it("participante nao pode criar recado antes do fim do jogo", async () => {
    await seedDoc(testEnv, `confirmations/${SCHEDULED_GAME}_${UID_PLAYER_B}`, {
      game_id: SCHEDULED_GAME,
      user_id: UID_PLAYER_B,
      status: "CONFIRMED",
    });
    await assertFails(asPlayerB(testEnv).doc(`post_game_messages/${SCHEDULED_GAME}_${UID_PLAYER_B}`).set({
      game_id: SCHEDULED_GAME,
      user_id: UID_PLAYER_B,
      user_name: "Player B",
      message: "Cedo demais.",
      created_at: new Date(),
      updated_at: new Date(),
    }));
  });

  it("anonimo nao pode ler recados", async () => {
    await assertFails(asAnon(testEnv).doc(`post_game_messages/${FINISHED_GAME}_${UID_PLAYER_B}`).get());
  });
});
