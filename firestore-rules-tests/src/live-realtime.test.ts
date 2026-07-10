import {afterAll, beforeAll, describe, expect, it} from "vitest";
import type {RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {
  asPlayerA,
  asPlayerB,
  initTestEnv,
  seedDoc,
  UID_PLAYER_A,
  UID_PLAYER_B,
} from "./helpers.js";

let testEnv: RulesTestEnvironment;
const GAME_ID = "realtime-game-001";

function waitForSnapshot(
  target: {onSnapshot: (next: (snapshot: any) => void, error: (error: Error) => void) => () => void},
  predicate: (snapshot: any) => boolean,
  timeoutMs = 3000
): {ready: Promise<void>; update: Promise<number>} {
  const startedAt = Date.now();
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const update = new Promise<number>((resolve, reject) => {
    let unsubscribe = () => undefined;
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Listener não recebeu atualização em ${timeoutMs}ms`));
    }, timeoutMs);

    unsubscribe = target.onSnapshot((snapshot) => {
      readyResolve();
      if (!predicate(snapshot)) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(Date.now() - startedAt);
    }, (error) => {
      clearTimeout(timeout);
      unsubscribe();
      readyReject(error);
      reject(error);
    });
  });
  return {ready, update};
}

beforeAll(async () => {
  testEnv = await initTestEnv();
  await seedDoc(testEnv, `games/${GAME_ID}`, {
    title: "Jogo público em tempo real",
    owner_id: UID_PLAYER_A,
    status: "LIVE",
    visibility: "PUBLIC_OPEN",
    date_time: new Date(),
    max_players: 10,
    max_goalkeepers: 2,
    players_count: 2,
    goalkeepers_count: 0,
    team1_score: 0,
    team2_score: 0,
    group_id: null,
    co_organizers: [],
  });
  await seedDoc(testEnv, `confirmations/${GAME_ID}_${UID_PLAYER_B}`, {
    game_id: GAME_ID,
    user_id: UID_PLAYER_B,
    status: "CONFIRMED",
  });
  await seedDoc(testEnv, `live_scores/${GAME_ID}`, {
    game_id: GAME_ID,
    owner_id: UID_PLAYER_A,
    team1_id: "team-a",
    team2_id: "team-b",
    team1_score: 0,
    team2_score: 0,
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Live Game multi-cliente em tempo real", () => {
  it("propaga placar para dois clientes conectados sem refresh", async () => {
    const ownerRef = asPlayerA(testEnv).doc(`live_scores/${GAME_ID}`);
    const playerRef = asPlayerB(testEnv).doc(`live_scores/${GAME_ID}`);
    const ownerListener = waitForSnapshot(
      ownerRef,
      (snapshot) => snapshot.data()?.team1_score === 1
    );
    const playerListener = waitForSnapshot(
      playerRef,
      (snapshot) => snapshot.data()?.team1_score === 1
    );

    await Promise.all([ownerListener.ready, playerListener.ready]);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`live_scores/${GAME_ID}`).update({
        team1_score: 1,
        updated_at: new Date(),
      });
    });

    const latencies = await Promise.all([
      ownerListener.update,
      playerListener.update,
    ]);
    expect(Math.max(...latencies)).toBeLessThan(3000);
  });

  it("propaga novo gol na timeline para dois clientes conectados", async () => {
    const ownerQuery = asPlayerA(testEnv)
      .collection("game_events")
      .where("game_id", "==", GAME_ID);
    const playerQuery = asPlayerB(testEnv)
      .collection("game_events")
      .where("game_id", "==", GAME_ID);
    const hasGoal = (snapshot: any) =>
      snapshot.docs.some((doc: any) => doc.id === "goal-realtime-001");
    const ownerListener = waitForSnapshot(ownerQuery, hasGoal);
    const playerListener = waitForSnapshot(playerQuery, hasGoal);

    await Promise.all([ownerListener.ready, playerListener.ready]);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("game_events/goal-realtime-001").set({
        game_id: GAME_ID,
        event_type: "GOAL",
        type: "GOAL",
        player_id: UID_PLAYER_B,
        player_name: "Jogador B",
        team_id: "team-a",
        created_by: UID_PLAYER_B,
        created_at: new Date(),
      });
    });

    const latencies = await Promise.all([
      ownerListener.update,
      playerListener.update,
    ]);
    expect(Math.max(...latencies)).toBeLessThan(3000);
  });

  it("propaga conclusão e resultado da votação sem nova consulta", async () => {
    const ownerRef = asPlayerA(testEnv).doc(`games/${GAME_ID}`);
    const playerRef = asPlayerB(testEnv).doc(`games/${GAME_ID}`);
    const concluded = (snapshot: any) =>
      snapshot.data()?.voting_status === "CONCLUDED" &&
      snapshot.data()?.mvp_id === UID_PLAYER_B;
    const ownerListener = waitForSnapshot(ownerRef, concluded);
    const playerListener = waitForSnapshot(playerRef, concluded);

    await Promise.all([ownerListener.ready, playerListener.ready]);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`games/${GAME_ID}`).update({
        status: "FINISHED",
        voting_status: "CONCLUDED",
        voting_concluded: true,
        voting_concluded_at: new Date(),
        mvp_id: UID_PLAYER_B,
        mvp_votes: 2,
        mvp_total_votes: 2,
      });
    });

    const latencies = await Promise.all([
      ownerListener.update,
      playerListener.update,
    ]);
    expect(Math.max(...latencies)).toBeLessThan(3000);
  });
});
