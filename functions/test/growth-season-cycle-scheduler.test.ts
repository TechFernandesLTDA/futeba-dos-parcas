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

const firestore = {
  collection: jest.fn((name: string) => collectionRef(name)),
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
