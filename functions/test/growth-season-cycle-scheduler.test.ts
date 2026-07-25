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
    delete: jest.fn(async () => {
      store.delete(path);
    }),
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

// FIX #3896: os crons deixaram de varrer só `official-groups` e passaram a
// incluir todo grupo com temporada ativa, via collection group.
function collectionGroupRef(
  name: string,
  filters: Array<{field: string; value: unknown}> = []
) {
  return {
    where: (field: string, _op: string, value: unknown) =>
      collectionGroupRef(name, [...filters, {field, value}]),
    get: jest.fn(async () => {
      const docs = Array.from(store.keys())
        .filter((path) => {
          const parts = path.split("/");
          return parts.length >= 3 && parts[parts.length - 2] === name;
        })
        .filter((path) => {
          const data = (store.get(path) ?? {}) as Record<string, unknown>;
          return filters.every((f) => data[f.field] === f.value);
        })
        .map((path) => {
          const parts = path.split("/");
          return {
            id: parts[parts.length - 1],
            data: () => store.get(path),
            ref: {path, parent: {parent: {id: parts[parts.length - 3]}}},
          };
        });
      return {docs, empty: docs.length === 0, size: docs.length};
    }),
  };
}

const firestore = {
  collection: jest.fn((name: string) => collectionRef(name)),
  collectionGroup: jest.fn((name: string) => collectionGroupRef(name)),
  batch: jest.fn(() => {
    const ops: Array<() => void> = [];
    return {
      set: (ref: {path: string}, data: Record<string, unknown>, options?: {merge?: boolean}) => {
        ops.push(() => applySet(ref.path, data, options?.merge));
      },
      update: (ref: {path: string}, data: Record<string, unknown>) => {
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
  // FIX #3908: cursor persistido grava updated_at com Timestamp.fromDate.
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({__timestamp: date.toISOString()})),
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

describe("growth/season-cycle schedulers", () => {
  let startNewSeasonHandler: () => Promise<void>;
  let archiveSeasonHandler: () => Promise<void>;
  let toLocaleDateStringSpy: jest.SpiedFunction<typeof Date.prototype.toLocaleDateString>;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    scheduledHandlers.length = 0;

    jest.isolateModules(() => {
      require("../src/growth/season-cycle");
    });

    [startNewSeasonHandler, archiveSeasonHandler] = scheduledHandlers;
    toLocaleDateStringSpy = jest.spyOn(Date.prototype, "toLocaleDateString");
  });

  afterEach(() => {
    toLocaleDateStringSpy.mockRestore();
  });

  it("startNewSeason desativa season antiga ativa e reativa a season corrente", async () => {
    store.set("official-groups/group-1", {name: "Grupo 1"});
    store.set("groups/group-1/league_seasons/2026-06", {
      is_active: true,
      name: "Temporada Junho de 2026",
    });
    store.set("groups/group-1/league_seasons/2026-07", {
      is_active: false,
      name: "Temporada Julho de 2026",
    });
    toLocaleDateStringSpy.mockReturnValue("2026-07-01");

    await startNewSeasonHandler();

    expect(store.get("groups/group-1/league_seasons/2026-06")).toMatchObject({
      is_active: false,
    });
    expect(store.get("groups/group-1/league_seasons/2026-07")).toMatchObject({
      is_active: true,
    });
  });

  // FIX #3896: antes, os crons varriam apenas `official-groups` (catálogo de
  // 11 entradas curadas), então grupo criado por usuário nunca tinha
  // temporada e a aba Liga ficava presa em "liga não começou".
  it("startNewSeason cobre grupo não oficial que já tem temporada ativa", async () => {
    // Nenhum official-groups/* — este grupo nasceu do provisionamento sob
    // demanda em onGameFinishedGroupLeague.
    store.set("groups/pelada-do-ze/league_seasons/2026-06", {
      is_active: true,
      name: "Temporada Junho de 2026",
    });
    toLocaleDateStringSpy.mockReturnValue("2026-07-01");

    await startNewSeasonHandler();

    expect(store.get("groups/pelada-do-ze/league_seasons/2026-06"))
      .toMatchObject({is_active: false});
    expect(store.get("groups/pelada-do-ze/league_seasons/2026-07"))
      .toMatchObject({is_active: true});
    // start_date é obrigatório: useGroupLeague ordena por ele.
    expect(store.get("groups/pelada-do-ze/league_seasons/2026-07"))
      .toHaveProperty("start_date");
  });

  it("archiveSeason arquiva mesmo sem mvp.user_id", async () => {
    store.set("official-groups/group-1", {name: "Grupo 1"});
    store.set("groups/group-1/league_seasons/2026-07", {
      is_active: true,
      name: "Temporada Julho de 2026",
    });
    store.set("groups/group-1/league_standings/standing-1", {
      season_id: "2026-07",
      user_name: "MVP sem uid",
      points: 42,
    });
    toLocaleDateStringSpy.mockReturnValue("2026-07-31");

    await archiveSeasonHandler();

    expect(store.get("groups/group-1/league_seasons/2026-07")).toMatchObject({
      is_active: false,
    });
    expect(store.get("season-archive/group-1/seasons/2026-07")).toMatchObject({
      month_key: "2026-07",
      mvp_user_id: null,
      mvp_user_name: "MVP sem uid",
    });
    expect(store.has("users/undefined/badges/mvp_liga_2026-07")).toBe(false);
    expect(loggerError).not.toHaveBeenCalled();
  });
});
