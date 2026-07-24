/**
 * FIX #3882 — voto de MVP concluído APÓS o congelamento da temporada.
 *
 * checkSeasonEnd roda às 03:00 BRT do dia 1º e congela
 * season_final_standings (one-shot, idempotente por doc-id). A votação de
 * MVP fica aberta até gameEnd + 24h, então um jogo de 31/07 pode ter o voto
 * concluído às 09:00 de 01/08 — depois do freeze. Antes, o incremento de
 * mvp_count ia só para season_participation e o standing congelado ficava
 * errado para sempre. Agora, applyVotingXpDelta detecta o standing
 * congelado e o corrige na MESMA transaction.
 */

// Mock do logger (firebase-functions)
const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();

jest.mock("firebase-functions", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
  },
}));

jest.mock("firebase-admin", () => ({
  apps: [{name: "test"}],
  firestore: jest.fn(),
  initializeApp: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
    increment: jest.fn((value: number) => ({__increment: value})),
    delete: jest.fn(() => ({__delete: true})),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({toDate: () => date})),
    now: jest.fn(() => ({toDate: () => new Date()})),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((configOrHandler: unknown, handler?: unknown) =>
    handler || configOrHandler),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock obrigatório por CLAUDE.md para módulos com callable functions
jest.mock("../../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({allowed: true}),
}));

jest.mock("../../src/middleware/require-profile-complete", () => ({
  requireProfileComplete: jest.fn(),
}));

jest.mock("../../src/_db", () => ({
  db: jest.fn(),
}));

import {applyVotingXpDelta} from "../../src/voting/mvp-voting";

type AnyDoc = Record<string, unknown>;

/**
 * Firestore fake injetável: docs em Map por path, transaction que registra
 * writes e respeita leitura-antes-de-escrita.
 *
 * @param {Map<string, AnyDoc>} store Documentos pré-existentes por path.
 * @return {object} Fake db + writes capturados.
 */
function createFakeDb(store: Map<string, AnyDoc>) {
  const writes: Array<{
    kind: "set" | "update";
    path: string;
    data: AnyDoc;
  }> = [];

  const makeDocRef = (path: string): AnyDoc => ({
    path,
    id: path.split("/").pop(),
  });
  const makeCollection = (name: string) => ({
    doc: (id: string) => makeDocRef(`${name}/${id}`),
    where: jest.fn(function(this: unknown) {
      return this;
    }),
    limit: jest.fn(function(this: unknown) {
      return this;
    }),
  });

  let wrote = false;
  const txn = {
    get: jest.fn(async (ref: {path?: string}) => {
      if (wrote) throw new Error("Firestore transaction read after write");
      const path = ref.path as string;
      const data = store.get(path);
      return {
        exists: data !== undefined,
        data: () => data,
        forEach: (cb: (d: unknown) => void) => void cb,
      };
    }),
    set: jest.fn((ref: {path: string}, data: AnyDoc) => {
      wrote = true;
      writes.push({kind: "set", path: ref.path, data});
    }),
    update: jest.fn((ref: {path: string}, data: AnyDoc) => {
      wrote = true;
      writes.push({kind: "update", path: ref.path, data});
    }),
  };

  const db = {
    collection: jest.fn((name: string) => makeCollection(name)),
    runTransaction: jest.fn(async (cb: (t: typeof txn) => Promise<void>) => {
      await cb(txn);
    }),
  };

  return {db, writes};
}

function baseStore(): Map<string, AnyDoc> {
  const store = new Map<string, AnyDoc>();
  // Jogo de 31/07 com season explícita (congelada às 03:00 de 01/08)
  store.set("games/game-1", {
    status: "FINISHED",
    owner_id: "owner-1",
    season_id: "monthly_2026_07",
    date: "2026-07-31T21:00:00",
  });
  store.set("users/u1", {
    experience_points: 500,
    level: 2,
    milestones_achieved: [],
  });
  return store;
}

describe("FIX #3882 — MVP pós-congelamento corrige season_final_standings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("incrementa mvp_count no standing congelado na mesma transaction", async () => {
    const store = baseStore();
    // Standing já congelado pelo checkSeasonEnd (mvp_count desatualizado)
    store.set("season_final_standings/monthly_2026_07_u1", {
      season_id: "monthly_2026_07",
      user_id: "u1",
      mvp_count: 2,
      frozen_at: {__serverTimestamp: true},
    });
    const {db, writes} = createFakeDb(store);

    await applyVotingXpDelta(db as never, "game-1", "u1", "MVP", 30);

    // season_participation continua recebendo o delta normal
    const participationWrite = writes.find(
      (write) => write.path === "season_participation/monthly_2026_07_u1",
    );
    expect(participationWrite).toBeDefined();
    expect(participationWrite?.data.mvp_count).toEqual({__increment: 1});

    // E o standing CONGELADO é corrigido (antes: errado para sempre)
    const frozenWrite = writes.find(
      (write) => write.path === "season_final_standings/monthly_2026_07_u1",
    );
    expect(frozenWrite).toBeDefined();
    expect(frozenWrite?.data).toEqual({mvp_count: {__increment: 1}});

    // Alerta em WARN — situação anômala, distinguível de operação normal
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("already frozen"),
    );
  });

  it("não toca season_final_standings quando a season ainda está aberta", async () => {
    const store = baseStore();
    const {db, writes} = createFakeDb(store);

    await applyVotingXpDelta(db as never, "game-1", "u1", "MVP", 30);

    const frozenWrite = writes.find(
      (write) => write.path.startsWith("season_final_standings/"),
    );
    expect(frozenWrite).toBeUndefined();

    // Delta normal aplicado
    const participationWrite = writes.find(
      (write) => write.path === "season_participation/monthly_2026_07_u1",
    );
    expect(participationWrite?.data.mvp_count).toEqual({__increment: 1});
  });

  it("é idempotente: re-execução com xp_log existente não repete a correção", async () => {
    const store = baseStore();
    store.set("season_final_standings/monthly_2026_07_u1", {
      season_id: "monthly_2026_07",
      user_id: "u1",
      mvp_count: 2,
    });
    // Log determinístico já existe (voto já processado)
    store.set("xp_logs/mvp_game-1_u1", {user_id: "u1", game_id: "game-1"});
    const {db, writes} = createFakeDb(store);

    await applyVotingXpDelta(db as never, "game-1", "u1", "MVP", 30);

    expect(writes).toHaveLength(0);
  });

  it("Bola Murcha não lê nem escreve standings congelados", async () => {
    const store = baseStore();
    store.set("season_final_standings/monthly_2026_07_u1", {
      season_id: "monthly_2026_07",
      user_id: "u1",
      mvp_count: 2,
    });
    const {db, writes} = createFakeDb(store);

    await applyVotingXpDelta(db as never, "game-1", "u1", "BOLA_MURCHA", -10);

    const frozenWrite = writes.find(
      (write) => write.path.startsWith("season_final_standings/"),
    );
    expect(frozenWrite).toBeUndefined();
  });
});
