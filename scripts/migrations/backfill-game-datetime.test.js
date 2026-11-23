"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  isValidTimeZone,
  parseArgs,
  runBackfill,
  zonedDateTime,
} = require("./backfill-game-datetime.js");

test("parseArgs fica em simulação por padrão", () => {
  assert.deepEqual(parseArgs(["--project=demo-x"]), {help: false, apply: false, projectId: "demo-x"});
  assert.equal(parseArgs(["--apply", "--project=demo-x"]).apply, true);
});

test("zonedDateTime monta a hora de parede no fuso da quadra", () => {
  assert.equal(zonedDateTime("2026-03-20", "19:00", "America/Sao_Paulo").toISOString(), "2026-03-20T22:00:00.000Z");
  assert.equal(zonedDateTime("2026-03-20", "19:00", "America/Manaus").toISOString(), "2026-03-20T23:00:00.000Z");
  assert.equal(zonedDateTime("2026-03-20", "", "America/Sao_Paulo").toISOString(), "2026-03-20T03:00:00.000Z");
});

test("zonedDateTime recusa formato inesperado", () => {
  assert.equal(zonedDateTime("20/03/2026", "19:00", "America/Sao_Paulo"), null);
  assert.equal(zonedDateTime("2026-02-31", "19:00", "America/Sao_Paulo"), null);
  assert.equal(zonedDateTime("2026-03-20", "25:00", "America/Sao_Paulo"), null);
  assert.equal(zonedDateTime(undefined, "19:00", "America/Sao_Paulo"), null);
});

test("isValidTimeZone", () => {
  assert.equal(isValidTimeZone("America/Cuiaba"), true);
  assert.equal(isValidTimeZone("Lua/Base"), false);
  assert.equal(isValidTimeZone(null), false);
});

function fakeDb(games, locations) {
  const updates = [];
  const doc = (col, id, data) => ({
    id,
    exists: data !== undefined,
    ref: {path: `${col}/${id}`},
    get: (field) => (data || {})[field],
  });
  return {
    updates,
    collection(name) {
      return {
        select: () => ({
          get: async () => {
            const docs = Object.entries(games).map(([id, data]) => doc("games", id, data));
            return {size: docs.length, docs};
          },
        }),
        doc: (id) => ({id, col: name}),
      };
    },
    getAll: async (...refs) => refs.map((r) => doc(r.col, r.id, locations[r.id])),
    batch() {
      const ops = [];
      return {
        update: (ref, data) => ops.push({ref, data}),
        commit: async () => {
          for (const op of ops) {
            updates.push(op);
            Object.assign(games[op.ref.path.split("/")[1]], op.data);
          }
        },
      };
    },
  };
}

const Timestamp = {fromDate: (d) => ({toDate: () => d})};

test("runBackfill em simulação não escreve", async () => {
  const db = fakeDb({g1: {date: "2026-03-20", time: "19:00"}}, {});
  const {scan, written} = await runBackfill({db, apply: false, log: () => {}, Timestamp});
  assert.equal(scan.fixes.length, 1);
  assert.equal(written, 0);
  assert.equal(db.updates.length, 0);
});

test("runBackfill grava só dateTime e só em quem não tem data", async () => {
  const antigo = {toDate: () => new Date("2026-01-01T00:00:00Z")};
  const games = {
    web: {date: "2026-03-20", time: "19:00", location_id: "quadra-manaus"},
    semQuadra: {date: "2026-03-21", time: "08:00"},
    jaTem: {date: "2026-03-22", time: "10:00", dateTime: antigo},
    legado: {date: "2026-03-22", time: "10:00", date_time: antigo},
    quebrado: {date: "amanhã", time: "10:00"},
  };
  const db = fakeDb(games, {"quadra-manaus": {time_zone: "America/Manaus"}});
  const {scan, after, written} = await runBackfill({db, apply: true, log: () => {}, Timestamp});

  assert.equal(scan.missing, 3);
  assert.deepEqual(scan.invalid, ["quebrado"]);
  assert.equal(written, 2);
  assert.deepEqual(db.updates.map((u) => Object.keys(u.data)), [["dateTime"], ["dateTime"]]);
  assert.equal(games.web.dateTime.toDate().toISOString(), "2026-03-20T23:00:00.000Z");
  assert.equal(games.semQuadra.dateTime.toDate().toISOString(), "2026-03-21T11:00:00.000Z");
  assert.equal(games.jaTem.dateTime, antigo);
  assert.equal(after.fixes.length, 0);
});
