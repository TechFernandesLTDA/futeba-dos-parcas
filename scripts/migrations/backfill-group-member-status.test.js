"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  migrateMemberTransaction,
  parseArgs,
  runBackfill,
  summarizeMemberSnapshots,
} = require("./backfill-group-member-status.js");

function snapshot(path, data, exists = true) {
  return {exists, ref: {path}, data: () => data};
}

test("parseArgs mantém dry-run como padrão e exige --apply explícito", () => {
  assert.deepEqual(parseArgs([]), {
    help: false,
    apply: false,
    projectId: "futebadosparcas",
    concurrency: 8,
  });
  assert.equal(parseArgs(["--apply"]).apply, true);
  assert.throws(() => parseArgs(["--concurrency=0"]), /entre 1 e 20/);
});

test("summarizeMemberSnapshots considera apenas paths canônicos e preserva status existente", () => {
  const summary = summarizeMemberSnapshots([
    snapshot("groups/g1/members/legacy", {role: "MEMBER"}),
    snapshot("groups/g1/members/active", {role: "MEMBER", status: "ACTIVE"}),
    snapshot("groups/g1/members/inactive", {role: "MEMBER", status: "INACTIVE"}),
    snapshot("other/x/members/not-group", {}),
  ]);

  assert.equal(summary.canonicalMembers, 3);
  assert.equal(summary.missingStatus, 1);
  assert.equal(summary.existingStatus, 2);
  assert.deepEqual(summary.statusCounts, {ACTIVE: 1, INACTIVE: 1});
  assert.equal(summary.missing[0].ref.path, "groups/g1/members/legacy");
});

test("runBackfill em dry-run não abre transação e mostra contagem projetada", async () => {
  let transactionCalls = 0;
  const docs = [
    snapshot("groups/g1/members/legacy", {role: "MEMBER"}),
    snapshot("groups/g1/members/inactive", {status: "INACTIVE"}),
  ];
  const db = {
    collectionGroup: () => ({select: () => ({get: async () => ({docs})})}),
    runTransaction: async () => {
      transactionCalls += 1;
    },
  };
  const logs = [];

  const result = await runBackfill({db, apply: false, concurrency: 2, log: (line) => logs.push(line)});

  assert.equal(transactionCalls, 0);
  assert.equal(result.projected, true);
  assert.match(logs.join("\n"), /DRY-RUN/);
  assert.match(logs.join("\n"), /"missingStatus":0/);
  assert.match(logs.join("\n"), /"INACTIVE":1/);
});

test("migrateMemberTransaction não sobrescreve status criado depois do scan", async () => {
  let updateCalls = 0;
  const db = {
    runTransaction: (worker) => worker({
      get: async () => snapshot("groups/g1/members/member", {status: "INACTIVE"}),
      update: () => {
        updateCalls += 1;
      },
    }),
  };

  const outcome = await migrateMemberTransaction(db, {path: "groups/g1/members/member"});
  assert.equal(outcome, "already-set");
  assert.equal(updateCalls, 0);
});
