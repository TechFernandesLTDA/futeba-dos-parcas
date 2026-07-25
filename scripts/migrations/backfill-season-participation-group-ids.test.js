"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  needsBackfill,
  parseArgs,
  readGroupId,
  runBackfill,
  summarizeDocs,
} = require("./backfill-season-participation-group-ids.js");

function snapshot(id, data) {
  return {id, ref: {id, path: `season_participation/${id}`}, data: () => data};
}

// Stubs de FieldPath/FieldValue injetados no lugar dos de firebase-admin.
const fieldPath = {documentId: () => "__name__"};
const fieldValue = {arrayUnion: (value) => ({__arrayUnion: value})};

/**
 * Fake de Firestore com paginação por startAfter e batch de escrita.
 * `pages` é a lista de páginas devolvidas em sequência.
 */
function fakeDb(pages) {
  const commits = [];
  let pageIndex = 0;

  const query = {
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    startAfter: () => query,
    get: async () => {
      const docs = pages[pageIndex] || [];
      pageIndex += 1;
      return {docs};
    },
  };

  return {
    commits,
    collection: () => query,
    batch: () => {
      const updates = [];
      return {
        update: (ref, payload) => updates.push({id: ref.id, payload}),
        commit: async () => commits.push(updates),
      };
    },
  };
}

test("parseArgs mantém dry-run como padrão e valida os limites", () => {
  assert.deepEqual(parseArgs([]), {
    help: false,
    apply: false,
    projectId: "futebadosparcas",
    pageSize: 400,
    season: null,
  });
  assert.equal(parseArgs(["--apply"]).apply, true);
  assert.equal(parseArgs(["--season=2026-07"]).season, "2026-07");
  assert.throws(() => parseArgs(["--page-size=0"]), /entre 1 e 500/);
  assert.throws(() => parseArgs(["--season=julho"]), /YYYY-MM/);
});

test("readGroupId ignora valores não utilizáveis", () => {
  assert.equal(readGroupId({group_id: "g1"}), "g1");
  assert.equal(readGroupId({group_id: ""}), null);
  assert.equal(readGroupId({group_id: 42}), null);
  assert.equal(readGroupId({}), null);
});

test("needsBackfill cobre só o doc legado com group_id e sem group_ids", () => {
  assert.equal(needsBackfill({group_id: "g1"}), true);
  // Já migrado: array presente, mesmo vazio, não é sobrescrito.
  assert.equal(needsBackfill({group_id: "g1", group_ids: ["g1"]}), false);
  assert.equal(needsBackfill({group_id: "g1", group_ids: []}), false);
  // Sem grupo não há o que propagar.
  assert.equal(needsBackfill({}), false);
});

test("summarizeDocs separa pendentes, migrados e docs sem grupo", () => {
  const summary = summarizeDocs([
    snapshot("2026-07_u1", {group_id: "g1"}),
    snapshot("2026-07_u2", {group_id: "g2", group_ids: ["g2"]}),
    snapshot("2026-07_u3", {}),
    snapshot("2026-07_u4", {group_id: "g1"}),
  ]);

  assert.equal(summary.scanned, 4);
  assert.equal(summary.pending, 2);
  assert.equal(summary.alreadyMigrated, 1);
  assert.equal(summary.withoutGroup, 1);
  assert.deepEqual(
    summary.candidates.map((c) => [c.ref.id, c.groupId]),
    [["2026-07_u1", "g1"], ["2026-07_u4", "g1"]],
  );
});

test("dry-run não escreve nada", async () => {
  const db = fakeDb([[snapshot("2026-07_u1", {group_id: "g1"})]]);
  const summary = await runBackfill({
    db, apply: false, pageSize: 400, season: null, fieldPath, fieldValue, log: () => {},
  });

  assert.equal(summary.pending, 1);
  assert.equal(summary.written, 0);
  assert.equal(db.commits.length, 0);
});

test("apply grava arrayUnion apenas nos pendentes", async () => {
  const db = fakeDb([[
    snapshot("2026-07_u1", {group_id: "g1"}),
    snapshot("2026-07_u2", {group_id: "g2", group_ids: ["g2"]}),
  ]]);

  const summary = await runBackfill({
    db, apply: true, pageSize: 400, season: null, fieldPath, fieldValue, log: () => {},
  });

  assert.equal(summary.written, 1);
  assert.deepEqual(db.commits, [[
    {id: "2026-07_u1", payload: {group_ids: {__arrayUnion: "g1"}}},
  ]]);
});

test("pagina enquanto a página vier cheia e para na página curta", async () => {
  const full = [
    snapshot("a", {group_id: "g1"}),
    snapshot("b", {group_id: "g1"}),
  ];
  const partial = [snapshot("c", {group_id: "g2"})];
  const db = fakeDb([full, partial]);

  const summary = await runBackfill({
    db, apply: true, pageSize: 2, season: null, fieldPath, fieldValue, log: () => {},
  });

  assert.equal(summary.scanned, 3);
  assert.equal(summary.written, 3);
  assert.equal(db.commits.length, 2);
});

test("segunda execução sobre base já migrada não escreve nada", async () => {
  const db = fakeDb([[
    snapshot("2026-07_u1", {group_id: "g1", group_ids: ["g1"]}),
    snapshot("2026-07_u2", {group_id: "g2", group_ids: ["g2"]}),
  ]]);

  const summary = await runBackfill({
    db, apply: true, pageSize: 400, season: null, fieldPath, fieldValue, log: () => {},
  });

  assert.equal(summary.pending, 0);
  assert.equal(summary.written, 0);
  assert.equal(db.commits.length, 0);
});
