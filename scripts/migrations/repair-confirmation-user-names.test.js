"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyRepair,
  parseArgs,
  profileName,
  runRepair,
} = require("./repair-confirmation-user-names.js");

function snapshot(path, data, exists = true) {
  const id = path.split("/").at(-1);
  return {exists, id, ref: {path}, data: () => data};
}

test("parseArgs exige game id e mantém dry-run como padrão", () => {
  assert.throws(() => parseArgs([]), /obrigatório/);
  assert.throws(() => parseArgs(["--game-id=a/b"]), /não pode conter/);
  assert.deepEqual(parseArgs(["--game-id=game-1"]), {
    help: false,
    apply: false,
    gameId: "game-1",
    projectId: "futebadosparcas",
  });
});

test("profileName ignora placeholder e normaliza o nome real", () => {
  assert.equal(profileName({name: " Membro "}), null);
  assert.equal(profileName({displayName: " Ana Souza "}), "Ana Souza");
});

test("dry-run encontra reparos sem escrever nem expor nomes no resumo", async () => {
  let transactionCalls = 0;
  const confirmations = [
    snapshot("confirmations/c1", {
      game_id: "game-1",
      user_id: "u1",
      user_name: "Membro",
    }),
    snapshot("confirmations/c2", {
      game_id: "game-1",
      user_id: "u2",
      user_name: "Nome existente",
    }),
  ];
  const db = {
    collection: (name) => {
      if (name === "confirmations") {
        return {
          where: () => ({get: async () => ({docs: confirmations, size: 2})}),
        };
      }
      return {doc: (id) => ({id, path: `users/${id}`})};
    },
    getAll: async () => [
      snapshot("users/u1", {name: "Nome Real"}),
    ],
    runTransaction: async () => {
      transactionCalls += 1;
    },
  };
  const logs = [];

  const result = await runRepair({
    db,
    gameId: "game-1",
    apply: false,
    log: (line) => logs.push(line),
  });

  assert.equal(result.scan.candidates.length, 1);
  assert.equal(transactionCalls, 0);
  assert.doesNotMatch(logs.join("\n"), /Nome Real/);
});

test("applyRepair preserva documento que mudou desde o scan", async () => {
  let updateCalls = 0;
  const repair = {
    ref: {path: "confirmations/c1"},
    userName: "Nome Real",
  };
  const db = {
    runTransaction: (worker) => worker({
      get: async () => snapshot("confirmations/c1", {
        game_id: "game-1",
        user_name: "Nome Corrigido",
      }),
      update: () => {
        updateCalls += 1;
      },
    }),
  };

  assert.equal(await applyRepair(db, "game-1", repair), "changed");
  assert.equal(updateCalls, 0);
});
