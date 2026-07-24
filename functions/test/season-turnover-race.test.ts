/**
 * FIX #3882 — corrida na virada de temporada da liga de grupo.
 *
 * Antes: archiveSeason (23:59 do último dia) desativava a season SEM criar
 * a próxima, deixando ~61min sem nenhuma `league_seasons` ativa até o
 * startNewSeason (01:00 do dia 1º). Partidas finalizadas nessa janela eram
 * descartadas permanentemente pelo onGameFinishedGroupLeague.
 *
 * Agora: archiveSeason cria/ativa a próxima season NO MESMO batch que
 * desativa a atual (virada atômica) — não existe mais instante sem season
 * ativa. startNewSeason vira repair idempotente.
 */
const store = new Map<string, Record<string, unknown>>();
const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();

const scheduledHandlers: Array<() => Promise<void>> = [];

function snap(path: string) {
  const data = store.get(path);
  return {
    id: path.split("/").pop(),
    path,
    exists: data !== undefined,
    ref: docRef(path),
    data: () => data,
  };
}

function collectionDocs(pathPrefix: string) {
  const prefix = `${pathPrefix}/`;
  return Array.from(store.entries())
    .filter(([path]) =>
      path.startsWith(prefix) &&
      path.slice(prefix.length).split("/").length === 1)
    .map(([path]) => snap(path));
}

function applySet(path: string, data: Record<string, unknown>, merge = false) {
  const current = store.get(path) || {};
  store.set(path, merge ? {...current, ...data} : data);
}

function applyUpdate(path: string, data: Record<string, unknown>) {
  const current = store.get(path) || {};
  store.set(path, {...current, ...data});
}

function docRef(path: string) {
  return {
    id: path.split("/").pop(),
    path,
    get: jest.fn(async () => snap(path)),
    set: jest.fn(async (data: Record<string, unknown>, options?: {merge?: boolean}) =>
      applySet(path, data, options?.merge)),
    update: jest.fn(async (data: Record<string, unknown>) =>
      applyUpdate(path, data)),
    collection: (name: string) => collectionRef(`${path}/${name}`),
  };
}

function queryRef(
  pathPrefix: string,
  filters: Array<{field: string; value: unknown}> = []
) {
  return {
    get: jest.fn(async () => {
      const docs = collectionDocs(pathPrefix).filter((doc) => {
        const data = doc.data() ?? {};
        return filters.every((filter) => data[filter.field] === filter.value);
      });
      return {docs, empty: docs.length === 0, size: docs.length};
    }),
    where: (field: string, _op: string, value: unknown) =>
      queryRef(pathPrefix, [...filters, {field, value}]),
    orderBy: () => queryRef(pathPrefix, filters),
    limit: () => queryRef(pathPrefix, filters),
  };
}

function collectionRef(pathPrefix: string) {
  return {
    doc: (id: string) => docRef(`${pathPrefix}/${id}`),
    get: jest.fn(async () => {
      const docs = collectionDocs(pathPrefix);
      return {docs, empty: docs.length === 0, size: docs.length};
    }),
    where: (field: string, _op: string, value: unknown) =>
      queryRef(pathPrefix, [{field, value}]),
  };
}

// Batches criados, na ordem, com as operações registradas — permite
// verificar a atomicidade da virada (desativar + ativar no MESMO batch).
const batchOps: Array<Array<{kind: string; path: string; data: Record<string, unknown>}>> = [];

const firestore = {
  collection: jest.fn((name: string) => collectionRef(name)),
  batch: jest.fn(() => {
    const ops: Array<() => void> = [];
    const recorded: Array<{kind: string; path: string; data: Record<string, unknown>}> = [];
    batchOps.push(recorded);
    return {
      set: (ref: {path: string}, data: Record<string, unknown>, options?: {merge?: boolean}) => {
        recorded.push({kind: "set", path: ref.path, data});
        ops.push(() => applySet(ref.path, data, options?.merge));
      },
      update: (ref: {path: string}, data: Record<string, unknown>) => {
        recorded.push({kind: "update", path: ref.path, data});
        ops.push(() => applyUpdate(ref.path, data));
      },
      commit: jest.fn(async () => {
        ops.forEach((op) => op());
      }),
    };
  }),
};

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => firestore),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: () => Promise<void>) => {
    scheduledHandlers.push(handler);
    return handler;
  }),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
  },
}));

import {getNextMonthKey} from "../src/growth/season-cycle";

describe("FIX #3882 — virada atômica de temporada (season-cycle)", () => {
  let startNewSeasonHandler: () => Promise<void>;
  let archiveSeasonHandler: () => Promise<void>;
  let toLocaleDateStringSpy: jest.SpiedFunction<typeof Date.prototype.toLocaleDateString>;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    scheduledHandlers.length = 0;
    batchOps.length = 0;

    jest.isolateModules(() => {
      require("../src/growth/season-cycle");
    });

    [startNewSeasonHandler, archiveSeasonHandler] = scheduledHandlers;
    toLocaleDateStringSpy = jest.spyOn(Date.prototype, "toLocaleDateString");
  });

  afterEach(() => {
    toLocaleDateStringSpy.mockRestore();
  });

  describe("getNextMonthKey", () => {
    it("avança o mês dentro do mesmo ano", () => {
      expect(getNextMonthKey("2026-07")).toBe("2026-08");
      expect(getNextMonthKey("2026-01")).toBe("2026-02");
    });

    it("vira o ano em dezembro", () => {
      expect(getNextMonthKey("2026-12")).toBe("2027-01");
    });
  });

  it("archiveSeason cria e ativa a próxima season no MESMO batch que desativa a atual", async () => {
    store.set("official-groups/group-1", {name: "Grupo 1"});
    store.set("groups/group-1/league_seasons/2026-07", {
      is_active: true,
      name: "Temporada Julho de 2026",
    });
    store.set("groups/group-1/league_standings/2026-07_u1", {
      season_id: "2026-07",
      user_id: "u1",
      user_name: "Jogador 1",
      points: 42,
    });
    toLocaleDateStringSpy.mockReturnValue("2026-07-31");

    await archiveSeasonHandler();

    // Season atual desativada e arquivada
    expect(store.get("groups/group-1/league_seasons/2026-07")).toMatchObject({
      is_active: false,
    });
    expect(store.get("season-archive/group-1/seasons/2026-07")).toMatchObject({
      month_key: "2026-07",
    });

    // Próxima season JÁ existe e está ativa — sem janela de virada
    expect(store.get("groups/group-1/league_seasons/2026-08")).toMatchObject({
      is_active: true,
      name: "Temporada Agosto de 2026",
    });

    // Atomicidade: desativação da atual e ativação da próxima estão no
    // MESMO batch (nunca aplicadas separadamente)
    const turnoverBatch = batchOps.find((ops) =>
      ops.some((op) => op.path === "groups/group-1/league_seasons/2026-07" &&
        op.data.is_active === false));
    expect(turnoverBatch).toBeDefined();
    expect(turnoverBatch).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: "groups/group-1/league_seasons/2026-08",
        data: expect.objectContaining({is_active: true}),
      }),
    ]));

    expect(loggerError).not.toHaveBeenCalled();
  });

  it("archiveSeason em dezembro cria a season de janeiro do ano seguinte", async () => {
    store.set("official-groups/group-1", {name: "Grupo 1"});
    store.set("groups/group-1/league_seasons/2026-12", {
      is_active: true,
      name: "Temporada Dezembro de 2026",
    });
    toLocaleDateStringSpy.mockReturnValue("2026-12-31");

    await archiveSeasonHandler();

    expect(store.get("groups/group-1/league_seasons/2026-12")).toMatchObject({
      is_active: false,
    });
    expect(store.get("groups/group-1/league_seasons/2027-01")).toMatchObject({
      is_active: true,
      name: "Temporada Janeiro de 2027",
    });
  });

  it("archiveSeason apenas ativa (sem sobrescrever) a próxima season pré-existente", async () => {
    store.set("official-groups/group-1", {name: "Grupo 1"});
    store.set("groups/group-1/league_seasons/2026-07", {
      is_active: true,
      name: "Temporada Julho de 2026",
    });
    store.set("groups/group-1/league_seasons/2026-08", {
      is_active: false,
      name: "Nome customizado",
      created_at: "original",
    });
    toLocaleDateStringSpy.mockReturnValue("2026-07-31");

    await archiveSeasonHandler();

    // merge:true preserva os campos originais e só liga is_active
    expect(store.get("groups/group-1/league_seasons/2026-08")).toMatchObject({
      is_active: true,
      name: "Nome customizado",
      created_at: "original",
    });
  });

  it("startNewSeason no dia 1º é no-op idempotente após a virada atômica", async () => {
    store.set("official-groups/group-1", {name: "Grupo 1"});
    // Estado deixado pela virada atômica de 31/07 às 23:59
    store.set("groups/group-1/league_seasons/2026-07", {
      is_active: false,
      name: "Temporada Julho de 2026",
    });
    store.set("groups/group-1/league_seasons/2026-08", {
      is_active: true,
      name: "Temporada Agosto de 2026",
    });
    toLocaleDateStringSpy.mockReturnValue("2026-08-01");

    await startNewSeasonHandler();

    expect(store.get("groups/group-1/league_seasons/2026-08")).toMatchObject({
      is_active: true,
    });
    expect(store.get("groups/group-1/league_seasons/2026-07")).toMatchObject({
      is_active: false,
    });
    expect(loggerError).not.toHaveBeenCalled();
  });
});
