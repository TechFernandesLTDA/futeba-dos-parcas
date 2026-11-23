"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {finalTeamScores, parseArgs, runBackfill} = require("./backfill-team-scores");

test("parseArgs é só leitura por padrão", () => {
  assert.equal(parseArgs([]).apply, false);
  assert.equal(parseArgs(["--apply", "--project=demo"]).projectId, "demo");
});

test("finalTeamScores segue mapa, ids legados e ordem do id", () => {
  assert.deepEqual([...finalTeamScores(["a", "b", "c"], {}, {scores: {a: 2, b: 0, c: 4}})],
    [["a", 2], ["b", 0], ["c", 4]]);
  assert.deepEqual([...finalTeamScores(["x", "y"], {team1_score: 3, team2_score: 1}, {team1_id: "y", team2_id: "x"})],
    [["x", 1], ["y", 3]]);
  assert.deepEqual([...finalTeamScores(["zeta", "alfa"], {team1_score: 1, team2_score: 0}, undefined)],
    [["alfa", 1], ["zeta", 0]]);
  assert.equal(finalTeamScores(["a", "b", "c"], {team1_score: 1}, undefined).size, 0);
});

function fakeDb(games, teams, liveScores) {
  const writes = [];
  const teamDoc = (t) => ({
    id: t.id,
    ref: {id: t.id},
    get: (k) => t[k],
  });
  return {
    writes,
    collection(name) {
      if (name === "games") {
        return {where: () => ({select: () => ({get: async () => ({
          size: games.length,
          docs: games.map((g) => ({id: g.id, data: () => g})),
        })})})};
      }
      if (name === "teams") {
        return {where: (_f, _op, gameId) => ({get: async () => {
          const docs = teams.filter((t) => t.game_id === gameId).map(teamDoc);
          return {empty: docs.length === 0, docs};
        }})};
      }
      return {doc: (id) => ({get: async () => ({exists: id in liveScores, data: () => liveScores[id]})})};
    },
    batch() {
      return {
        update: (ref, data) => {
          writes.push({id: ref.id, ...data});
          const t = teams.find((x) => x.id === ref.id);
          if (t) t.score = data.score;
        },
        commit: async () => {},
      };
    },
  };
}

test("dry-run não escreve; apply corrige só o que difere", async () => {
  const games = [{id: "g1", team1_score: 3, team2_score: 2}, {id: "g2", team1_score: 1, team2_score: 1}];
  const teams = [
    {id: "g1a", game_id: "g1", score: 0},
    {id: "g1b", game_id: "g1", score: 0},
    {id: "g2a", game_id: "g2", score: 1},
    {id: "g2b", game_id: "g2", score: 1},
  ];
  const live = {g1: {scores: {g1a: 3, g1b: 2}, team1_id: "g1a", team2_id: "g1b"}};
  const db = fakeDb(games, teams, live);
  const logs = [];

  const dry = await runBackfill({db, apply: false, log: (l) => logs.push(l), serverTimestamp: () => "ts"});
  assert.equal(dry.written, 0);
  assert.equal(db.writes.length, 0);
  assert.equal(dry.scan.fixes.length, 2);

  const applied = await runBackfill({db, apply: true, log: (l) => logs.push(l), serverTimestamp: () => "ts"});
  assert.equal(applied.written, 2);
  assert.deepEqual(db.writes.map((w) => [w.id, w.score]), [["g1a", 3], ["g1b", 2]]);
  assert.equal(applied.after.fixes.length, 0);
});
