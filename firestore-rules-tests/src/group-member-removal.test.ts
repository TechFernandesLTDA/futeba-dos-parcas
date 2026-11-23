/**
 * Remoção de membro pelo web com jogo futuro (achado 2 da simulação de uso, PR #4621).
 *
 * O web (removeGroupMembershipArtifacts) consulta as confirmações da pessoa em
 * cada jogo futuro do grupo e cancela só as que estão CONFIRMED, no mesmo lote
 * que marca o vínculo como REMOVED e apaga o espelho users/{uid}/groups/{gid}.
 * Antes, o lote atualizava confirmations/{jogo}_{uid} de todo jogo futuro, e um
 * documento ausente derrubava a remoção inteira.
 */
import { describe, it, beforeAll, afterAll } from "vitest";
import { assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  collection, doc, getDocs, query, where, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { initTestEnv, asUser, seedDocs } from "./helpers.js";

let testEnv: RulesTestEnvironment;

const GROUP = "rm-group";
const OWNER = "rm-owner";
const MEMBER = "rm-member";
const OUTSIDER = "rm-outsider";
const GAME_CONFIRMED = "rm-game-confirmed";
const GAME_NO_CONF = "rm-game-no-conf";
const GAME_PENDING = "rm-game-pending";
const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);

beforeAll(async () => {
  testEnv = await initTestEnv();
  const game = (id: string) => ({
    path: `games/${id}`,
    data: {
      title: id, owner_id: OWNER, group_id: GROUP, status: "SCHEDULED", dateTime: amanha,
      visibility: "GROUP_ONLY", max_players: 14, players_count: 1, co_organizers: [],
    },
  });
  const member = (uid: string, role: string) => ({
    path: `groups/${GROUP}/members/${uid}`,
    data: { id: uid, user_id: uid, role, status: "ACTIVE", joined_at: new Date() },
  });
  await seedDocs(testEnv, [
    { path: `groups/${GROUP}`, data: { name: "Pelada", owner_id: OWNER, status: "ACTIVE", member_count: 2 } },
    member(OWNER, "OWNER"),
    member(MEMBER, "MEMBER"),
    { path: `users/${MEMBER}/groups/${GROUP}`, data: { group_id: GROUP, role: "MEMBER" } },
    game(GAME_CONFIRMED),
    game(GAME_NO_CONF),
    game(GAME_PENDING),
    {
      path: `confirmations/${GAME_CONFIRMED}_${MEMBER}`,
      data: { game_id: GAME_CONFIRMED, user_id: MEMBER, status: "CONFIRMED" },
    },
    {
      path: `confirmations/${GAME_PENDING}_${MEMBER}`,
      data: { game_id: GAME_PENDING, user_id: MEMBER, status: "PENDING" },
    },
  ]);
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("groups/members — remoção pelo dono com jogo futuro (web)", () => {
  it("o dono consulta as confirmações da pessoa em cada jogo do grupo", async () => {
    const db = asUser(testEnv, OWNER);
    for (const gameId of [GAME_CONFIRMED, GAME_NO_CONF, GAME_PENDING]) {
      await assertSucceeds(getDocs(query(
        collection(db, "confirmations"),
        where("game_id", "==", gameId),
        where("user_id", "==", MEMBER),
      )));
    }
  });

  it("quem é de fora do grupo não consulta", async () => {
    const db = asUser(testEnv, OUTSIDER);
    await assertFails(getDocs(query(
      collection(db, "confirmations"),
      where("game_id", "==", GAME_CONFIRMED),
      where("user_id", "==", MEMBER),
    )));
  });

  it("o lote antigo (todo jogo futuro, exista ou não a confirmação) é negado", async () => {
    const db = asUser(testEnv, OWNER);
    const batch = writeBatch(db);
    batch.update(doc(db, "groups", GROUP, "members", MEMBER), { status: "REMOVED", updated_at: serverTimestamp() });
    batch.delete(doc(db, "users", MEMBER, "groups", GROUP));
    for (const gameId of [GAME_CONFIRMED, GAME_NO_CONF, GAME_PENDING]) {
      batch.update(doc(db, "confirmations", `${gameId}_${MEMBER}`), { status: "CANCELLED", updated_at: serverTimestamp() });
    }
    await assertFails(batch.commit());
  });

  it("o lote novo (só as confirmações CONFIRMED) passa", async () => {
    const db = asUser(testEnv, OWNER);
    const batch = writeBatch(db);
    batch.update(doc(db, "groups", GROUP, "members", MEMBER), { status: "REMOVED", updated_at: serverTimestamp() });
    batch.delete(doc(db, "users", MEMBER, "groups", GROUP));
    for (const gameId of [GAME_CONFIRMED, GAME_NO_CONF, GAME_PENDING]) {
      const snap = await getDocs(query(
        collection(db, "confirmations"),
        where("game_id", "==", gameId),
        where("user_id", "==", MEMBER),
      ));
      for (const confirmation of snap.docs) {
        if (confirmation.data().status !== "CONFIRMED") continue;
        batch.update(confirmation.ref, { status: "CANCELLED", updated_at: serverTimestamp() });
      }
    }
    await assertSucceeds(batch.commit());
  });
});
