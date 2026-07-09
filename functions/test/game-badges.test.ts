const store = new Map<string, Record<string, unknown>>();
const notificationCalls: Array<{userId: string; payload: Record<string, unknown>}> = [];
const registeredHandlers: Array<(event: any) => Promise<void>> = [];

function normalizePath(path: string): string {
  return path.replace(/\/+/g, "/");
}

function snap(path: string) {
  const normalizedPath = normalizePath(path);
  const data = store.get(normalizedPath);
  return {
    id: normalizedPath.split("/").pop(),
    path: normalizedPath,
    exists: data !== undefined,
    ref: docRef(normalizedPath),
    data: () => data,
    docs: [],
    empty: data === undefined,
  };
}

function applySet(
  path: string,
  data: Record<string, unknown>,
  merge = false
) {
  const normalizedPath = normalizePath(path);
  const current = store.get(normalizedPath) || {};
  store.set(
    normalizedPath,
    merge ? {...current, ...data} : data
  );
}

function applyUpdate(path: string, data: Record<string, unknown>) {
  const normalizedPath = normalizePath(path);
  const current = store.get(normalizedPath) || {};
  const next = {...current};

  for (const [key, value] of Object.entries(data)) {
    if (
      value &&
      typeof value === "object" &&
      "__increment" in value
    ) {
      next[key] =
        ((next[key] as number | undefined) || 0) +
        (value as {__increment: number}).__increment;
    } else {
      next[key] = value;
    }
  }

  store.set(normalizedPath, next);
}

function matchesFilters(
  data: Record<string, unknown> | undefined,
  filters: Array<{field: string; value: unknown}>
) {
  if (!data) return false;
  return filters.every((filter) =>
    data[filter.field] === filter.value
  );
}

function collectionDocs(pathPrefix: string) {
  const prefix = `${normalizePath(pathPrefix)}/`;
  return Array.from(store.entries())
    .filter(([path]) =>
      path.startsWith(prefix) &&
      path.slice(prefix.length).split("/").length === 1)
    .map(([path]) => snap(path));
}

function makeQuery(
  pathPrefix: string,
  filters: Array<{field: string; value: unknown}> = []
) {
  return {
    where: (field: string, _op: string, value: unknown) =>
      makeQuery(pathPrefix, [
        ...filters,
        {field, value},
      ]),
    get: jest.fn(async () => {
      const docs = collectionDocs(pathPrefix).filter((doc) =>
        matchesFilters(
          doc.data() as Record<string, unknown> | undefined,
          filters
        )
      );
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
      };
    }),
  };
}

function docRef(path: string) {
  const normalizedPath = normalizePath(path);
  return {
    id: normalizedPath.split("/").pop(),
    path: normalizedPath,
    get: jest.fn(async () => snap(normalizedPath)),
    set: jest.fn(async (data: Record<string, unknown>, options?: {merge?: boolean}) =>
      applySet(normalizedPath, data, options?.merge)),
    update: jest.fn(async (data: Record<string, unknown>) =>
      applyUpdate(normalizedPath, data)),
    collection: (name: string) =>
      collectionRef(`${normalizedPath}/${name}`),
  };
}

function collectionRef(pathPrefix: string) {
  const normalizedPath = normalizePath(pathPrefix);
  return {
    doc: (id: string) => docRef(`${normalizedPath}/${id}`),
    get: jest.fn(async () => {
      const docs = collectionDocs(normalizedPath);
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
      };
    }),
    where: (field: string, _op: string, value: unknown) =>
      makeQuery(normalizedPath, [{field, value}]),
  };
}

const firestore = {
  collection: jest.fn((name: string) => collectionRef(name)),
  runTransaction: jest.fn(async (callback: (tx: any) => Promise<any>) => {
    const tx = {
      get: async (ref: {path: string}) => snap(ref.path),
      set: (ref: {path: string}, data: Record<string, unknown>) =>
        applySet(ref.path, data),
      update: (ref: {path: string}, data: Record<string, unknown>) =>
        applyUpdate(ref.path, data),
    };
    return callback(tx);
  }),
};

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => firestore),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
    increment: jest.fn((value: number) => ({__increment: value})),
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: unknown, handler: (event: any) => Promise<void>) => {
    registeredHandlers.push(handler);
    return handler;
  }),
}));

jest.mock("firebase-functions/v2", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../src/notifications/helpers", () => ({
  NotificationType: {
    ACHIEVEMENT: "ACHIEVEMENT",
  },
  sendNotificationToUser: jest.fn(async (userId: string, payload: Record<string, unknown>) => {
    notificationCalls.push({userId, payload});
  }),
}));

describe("badges/game-badges", () => {
  let onGameFinishedCheckBadges: (event: any) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    notificationCalls.length = 0;
    registeredHandlers.length = 0;

    jest.isolateModules(() => {
      require("../src/badges/game-badges");
    });

    [onGameFinishedCheckBadges] = registeredHandlers;
  });

  it("concede badge com xpReward e xp_log idempotente", async () => {
    store.set("users/user1", {
      name: "Jogador 1",
      experience_points: 100,
      level: 0,
    });
    store.set("statistics/user1", {
      bestPlayerCount: 1,
    });
    store.set("confirmations/conf1", {
      game_id: "game1",
      user_id: "user1",
      was_present: true,
    });

    for (const badgeId of [
      "streak_7",
      "mvp_10",
      "goals_10",
      "assists_50",
      "wins_10",
      "wins_50",
      "games_100",
      "onipresente",
      "rei_das_quartas",
      "carrasco",
    ]) {
      store.set(`users/user1/badges/${badgeId}`, {
        earned: true,
      });
    }

    const event = {
      params: {gameId: "game1"},
      data: {
        before: {data: () => ({status: "LIVE"})},
        after: {data: () => ({status: "FINISHED"})},
      },
    };

    await onGameFinishedCheckBadges(event);

    expect(store.get("users/user1/badges/mvp_1")).toMatchObject({
      badge_id: "mvp_1",
      xp_reward: 100,
      earned: true,
    });
    expect(store.get("user_badges/user1_mvp_1")).toMatchObject({
      user_id: "user1",
      badge_id: "mvp_1",
      xp_reward: 100,
      earned: true,
    });
    expect(store.get("users/user1")).toMatchObject({
      experience_points: 200,
      level: 1,
    });
    expect(
      store.get("xp_logs/badge_mvp_1_user_user1")
    ).toMatchObject({
      user_id: "user1",
      source: "badge_earned",
      xp_earned: 100,
      xp_before: 100,
      xp_after: 200,
      xp_milestones: 100,
      milestones_unlocked: ["mvp_1"],
    });
    expect(notificationCalls).toHaveLength(1);

    await onGameFinishedCheckBadges(event);

    expect(store.get("users/user1")).toMatchObject({
      experience_points: 200,
    });
    expect(notificationCalls).toHaveLength(1);
  });
});
