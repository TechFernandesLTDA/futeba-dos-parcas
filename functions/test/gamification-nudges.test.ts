const notificationCalls: Array<{
  userId: string;
  payload: Record<string, unknown>;
  docId?: string;
}> = [];
const deliveredNotifications: Array<{
  userId: string;
  payload: Record<string, unknown>;
  docId?: string;
}> = [];
const optedOutUsers = new Set<string>();
const claimedNotificationIds = new Set<string>();
const completedNotificationIds = new Set<string>();
const store = new Map<string, Record<string, unknown>>();
const mockSendAndSaveNotification = jest.fn();
const mockClaimNotificationEventOnce = jest.fn();
const mockCompleteNotificationEvent = jest.fn();
const mockReleaseNotificationEvent = jest.fn();

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const firestoreFn: any = jest.fn();
firestoreFn.FieldPath = {
  documentId: jest.fn(() => "__name__"),
};

jest.mock("firebase-admin", () => ({
  firestore: firestoreFn,
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
    })),
  },
}));

jest.mock("firebase-functions/v2", () => ({
  logger: mockLogger,
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("../src/constants", () => ({
  FUNCTION_REGION: "southamerica-east1",
  FIRESTORE_PAGINATION_LIMIT: 500,
}));

jest.mock("../src/xp/pipeline", () => ({
  LEVELS: [
    {level: 0, name: "Novato", xpRequired: 0},
    {level: 1, name: "Iniciante", xpRequired: 100},
    {level: 2, name: "Amador", xpRequired: 350},
    {level: 3, name: "Regular", xpRequired: 850},
    {level: 4, name: "Experiente", xpRequired: 1850},
  ],
}));

jest.mock("../src/notifications/notification-messages", () => ({
  GAMIFICATION_NUDGES: {
    ALMOST_LEVEL: {
      title: {
        "pt-BR": jest.fn(() => "Quase subir de nível!"),
      },
      body: {
        "pt-BR": jest.fn(({xpLeft, levelName}: {xpLeft: string; levelName: string}) =>
          `Faltam ${xpLeft} XP para ${levelName}`),
      },
    },
    ALMOST_BADGE: {
      title: {
        "pt-BR": jest.fn(() => "Quase conquista!"),
      },
      body: {
        "pt-BR": jest.fn(
          ({remaining, unit, badgeName}: {remaining: string; unit: string; badgeName: string}) =>
            `Faltam ${remaining} ${unit} para ${badgeName}`,
        ),
      },
    },
    STREAK_AT_RISK: {
      title: {
        "pt-BR": jest.fn(() => "Sequência em risco!"),
      },
      body: {
        "pt-BR": jest.fn(({streak}: {streak: string}) =>
          `Você está com ${streak} jogos seguidos`),
      },
    },
  },
}));

jest.mock("../src/notifications/helpers", () => ({
  NotificationType: {
    ACHIEVEMENT: "ACHIEVEMENT",
  },
  sendAndSaveNotification: mockSendAndSaveNotification,
}));

jest.mock("../src/notifications/dedup", () => ({
  claimNotificationEventOnce: mockClaimNotificationEventOnce,
  completeNotificationEvent: mockCompleteNotificationEvent,
  releaseNotificationEvent: mockReleaseNotificationEvent,
}));

jest.mock("../src/_db", () => ({
  db: jest.fn(() => firestore),
}));

type QueryConfig = {
  collectionName: string;
  isGroup: boolean;
  filters: Array<{field: string; op: string; value: unknown}>;
  orderByField?: string;
  orderByDirection?: "asc" | "desc";
  limitValue?: number;
  startAfterId?: string;
};

function normalizePath(path: string): string {
  return path.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

function seedDoc(path: string, data: Record<string, unknown>): void {
  store.set(normalizePath(path), data);
}

function clearStore(): void {
  store.clear();
  notificationCalls.length = 0;
  deliveredNotifications.length = 0;
  optedOutUsers.clear();
  claimedNotificationIds.clear();
  completedNotificationIds.clear();
  jest.clearAllMocks();
  mockLogger.info.mockClear();
  mockLogger.warn.mockClear();
  mockLogger.error.mockClear();
  mockSendAndSaveNotification.mockReset();
  mockSendAndSaveNotification.mockImplementation(
    async (userId: string, payload: Record<string, unknown>, docId?: string) => {
      notificationCalls.push({userId, payload, docId});
      const normalizedDocId = docId ?? `${userId}_${notificationCalls.length}`;
      store.set(`notifications/${normalizedDocId}`, {
        user_id: userId,
        ...payload,
      });
      if (!optedOutUsers.has(userId)) {
        deliveredNotifications.push({userId, payload, docId});
      }
      return !optedOutUsers.has(userId);
    },
  );
  mockClaimNotificationEventOnce.mockImplementation(async (claimId: string) => {
    if (
      claimedNotificationIds.has(claimId) ||
      completedNotificationIds.has(claimId)
    ) {
      return false;
    }
    claimedNotificationIds.add(claimId);
    return true;
  });
  mockCompleteNotificationEvent.mockImplementation(async (claimId: string) => {
    claimedNotificationIds.delete(claimId);
    completedNotificationIds.add(claimId);
  });
  mockReleaseNotificationEvent.mockImplementation(async (claimId: string) => {
    claimedNotificationIds.delete(claimId);
  });
}

function matchesFilters(
  data: Record<string, unknown> | undefined,
  filters: Array<{field: string; op: string; value: unknown}>,
): boolean {
  if (!data) return false;
  return filters.every((filter) => {
    const current = data[filter.field];
    switch (filter.op) {
      case "==":
        return current === filter.value;
      case "in":
        return Array.isArray(filter.value) &&
          filter.value.includes(current);
      case ">":
      case ">=":
      case "<":
      case "<=": {
        const left = comparableValue(current);
        const right = comparableValue(filter.value);
        if (left == null || right == null) return false;
        if (filter.op === ">") return left > right;
        if (filter.op === ">=") return left >= right;
        if (filter.op === "<") return left < right;
        return left <= right;
      }
      default:
        return current === filter.value;
    }
  });
}

function comparableValue(value: unknown): number | string | null {
  if (value && typeof value === "object" && "toDate" in value &&
    typeof (value as {toDate?: unknown}).toDate === "function") {
    return (value as {toDate: () => Date}).toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function collectionDocs(config: QueryConfig): Array<{
  id: string;
  path: string;
  data: () => Record<string, unknown> | undefined;
  exists: boolean;
  ref: ReturnType<typeof docRef>;
}> {
  const docs = Array.from(store.entries())
    .filter(([path]) => {
      const normalizedPath = normalizePath(path);
      const parts = normalizedPath.split("/");
      if (config.isGroup) {
        return parts.length % 2 === 0 &&
          parts[parts.length - 2] === config.collectionName;
      }
      const prefix = `${config.collectionName}/`;
      return normalizedPath.startsWith(prefix) &&
        normalizedPath.slice(prefix.length).split("/").length === 1;
    })
    .map(([path, data]) => ({
      id: normalizePath(path).split("/").pop() ?? path,
      path: normalizePath(path),
      data: () => data,
      exists: true,
      ref: docRef(path),
    }))
    .filter((doc) => matchesFilters(doc.data(), config.filters))
    .sort((a, b) => {
      const field = config.orderByField ?? "id";
      const direction = config.orderByDirection ?? "asc";
      const left = field === "id" ? a.id : comparableValue(a.data()?.[field]);
      const right = field === "id" ? b.id : comparableValue(b.data()?.[field]);
      if (left == null || right == null) {
        return a.id.localeCompare(b.id);
      }
      const compare = typeof left === "number" && typeof right === "number" ?
        left - right :
        String(left).localeCompare(String(right));
      return direction === "asc" ? compare : -compare;
    });

  if (typeof config.startAfterId === "string") {
    return docs.filter((doc) => doc.id.localeCompare(config.startAfterId ?? "") > 0);
  }

  if (typeof config.limitValue === "number") {
    return docs.slice(0, config.limitValue);
  }

  return docs;
}

function docRef(path: string) {
  const normalizedPath = normalizePath(path);
  const parts = normalizedPath.split("/");
  const parentCollectionId = parts.length >= 2 ? parts[parts.length - 2] : undefined;
  const grandParentId = parts.length >= 4 ? parts[parts.length - 3] : undefined;
  return {
    id: parts[parts.length - 1],
    path: normalizedPath,
    parent: parentCollectionId ? {
      id: parentCollectionId,
      parent: grandParentId ? {id: grandParentId} : null,
    } : null,
    get: jest.fn(async () => {
      const data = store.get(normalizedPath);
      return {
        id: parts[parts.length - 1],
        path: normalizedPath,
        exists: data !== undefined,
        data: () => data,
        ref: docRef(normalizedPath),
      };
    }),
    set: jest.fn(async (data: Record<string, unknown>) => {
      store.set(normalizedPath, data);
    }),
    update: jest.fn(async (data: Record<string, unknown>) => {
      const current = store.get(normalizedPath) ?? {};
      store.set(normalizedPath, {...current, ...data});
    }),
    delete: jest.fn(async () => {
      store.delete(normalizedPath);
    }),
    collection: (name: string) => collectionRef(`${normalizedPath}/${name}`),
  };
}

function makeQuery(config: QueryConfig) {
  const query = {
    ...config,
    where(field: string, _op: string, value: unknown) {
      return makeQuery({
        ...config,
        filters: [...config.filters, {field, op: _op, value}],
      });
    },
    orderBy(field: string, direction: "asc" | "desc" = "asc") {
      return makeQuery({
        ...config,
        orderByField: field,
        orderByDirection: direction,
      });
    },
    limit(value: number) {
      return makeQuery({
        ...config,
        limitValue: value,
      });
    },
    startAfter(cursor: {id?: string}) {
      return makeQuery({
        ...config,
        startAfterId: cursor.id,
      });
    },
    get: jest.fn(async () => {
      const docs = collectionDocs(config);
      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
      };
    }),
  };
  return query;
}

function collectionRef(pathPrefix: string) {
  const normalizedPath = normalizePath(pathPrefix);
  const collectionName = normalizedPath.split("/").pop() ?? normalizedPath;
  const query = makeQuery({
    collectionName,
    isGroup: false,
    filters: [],
  });

  return {
    doc: (id: string) => docRef(`${normalizedPath}/${id}`),
    where: query.where,
    orderBy: query.orderBy,
    limit: query.limit,
    startAfter: query.startAfter,
    get: query.get,
  };
}

function collectionGroupRef(collectionName: string) {
  const query = makeQuery({
    collectionName,
    isGroup: true,
    filters: [],
  });

  return {
    doc: (id: string) => docRef(`${collectionName}/${id}`),
    where: query.where,
    orderBy: query.orderBy,
    limit: query.limit,
    startAfter: query.startAfter,
    get: query.get,
  };
}

const firestore = {
  collection: jest.fn((name: string) => collectionRef(name)),
  collectionGroup: jest.fn((name: string) => collectionGroupRef(name)),
};

import {sendGamificationNudgesDaily} from "../src/gamification-nudges";

const baseNow = new Date("2026-07-19T15:00:00.000Z");

function seedEligibleUser(overrides: {
  experiencePoints?: number;
  goals?: number;
  streak?: number;
  confirmationStatus?: string | null;
  membershipStatus?: string;
  gameStatus?: string;
} = {}) {
  const userId = "user-1";
  const groupId = "group-1";
  const gameId = "game-1";
  const experiencePoints = overrides.experiencePoints ?? 1755;
  const goals = overrides.goals ?? 20;
  const streak = overrides.streak ?? 3;
  const confirmationStatus = overrides.confirmationStatus ?? null;
  const membershipStatus = overrides.membershipStatus ?? "ACTIVE";
  const gameStatus = overrides.gameStatus ?? "SCHEDULED";

  seedDoc(`users/${userId}`, {
    experience_points: experiencePoints,
  });
  seedDoc(`statistics/${userId}`, {
    totalGoals: goals,
  });
  seedDoc(`user_streaks/${userId}`, {
    current_streak: streak,
  });
  seedDoc(`groups/${groupId}/members/member-1`, {
    user_id: userId,
    status: membershipStatus,
  });
  seedDoc(`games/${gameId}`, {
    group_id: groupId,
    status: gameStatus,
    dateTime: {
      toDate: () => new Date("2026-07-20T15:00:00.000Z"),
    },
  });

  if (confirmationStatus !== null) {
    seedDoc(`confirmations/${gameId}_${userId}`, {
      status: confirmationStatus,
    });
  }

  return {userId, groupId, gameId};
}

function seedFutureGameBurstFixture(): {
  userId: string;
  groupId: string;
} {
  const userId = "user-1";
  const groupId = "group-1";

  seedDoc(`users/${userId}`, {
    experience_points: 0,
  });
  seedDoc(`statistics/${userId}`, {
    totalGoals: 0,
  });
  seedDoc(`user_streaks/${userId}`, {
    current_streak: 3,
  });
  seedDoc(`groups/${groupId}/members/member-1`, {
    user_id: userId,
    status: "ACTIVE",
  });

  for (let index = 1; index <= 12; index++) {
    const gameId = `game-${index}`;
    const start = new Date(Date.UTC(2026, 6, 20 + index, 15, 0, 0));
    seedDoc(`games/${gameId}`, {
      group_id: groupId,
      status: index <= 10 ? "CONFIRMED" : "SCHEDULED",
      dateTime: {
        toDate: () => start,
      },
    });
    if (index <= 10) {
      seedDoc(`confirmations/${gameId}_${userId}`, {
        status: "CONFIRMED",
      });
    }
  }

  return {userId, groupId};
}

function sentActions(): string[] {
  return notificationCalls.map(({payload}) => String(payload.action ?? ""));
}

describe("gamification nudges daily scheduler", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(baseNow);
    clearStore();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("envia streak em risco, quase nivel e quase badge quando o usuario e elegivel", async () => {
    seedEligibleUser();

    await sendGamificationNudgesDaily();

    expect(sentActions()).toEqual(["achievements", "badges", "games"]);
    expect(notificationCalls).toHaveLength(3);
    expect(deliveredNotifications).toHaveLength(3);
    expect(notificationCalls).toEqual([
      expect.objectContaining({
        userId: "user-1",
        docId: "gamification_nudge_almost_level_user-1_2026-07-19",
        payload: expect.objectContaining({
          title: "Quase subir de nível!",
          body: "Faltam 95 XP para Experiente",
          type: "ACHIEVEMENT",
          action: "achievements",
        }),
      }),
      expect.objectContaining({
        userId: "user-1",
        docId: "gamification_nudge_almost_badge_user-1_2026-07-19",
        payload: expect.objectContaining({
          title: "Quase conquista!",
          body: "Faltam 5 gols para Goleador",
          type: "ACHIEVEMENT",
          action: "badges",
        }),
      }),
      expect.objectContaining({
        userId: "user-1",
        docId: "gamification_nudge_streak_at_risk_user-1_2026-07-19",
        payload: expect.objectContaining({
          title: "Sequência em risco!",
          body: "Você está com 3 jogos seguidos",
          type: "ACHIEVEMENT",
          action: "games",
          gameId: "game-1",
        }),
      }),
    ]);
  });

  it("nao envia streak quando a sequencia esta abaixo de 3", async () => {
    seedEligibleUser({streak: 2});

    await sendGamificationNudgesDaily();

    expect(sentActions()).toEqual(["achievements", "badges"]);
    expect(notificationCalls).toHaveLength(2);
    expect(notificationCalls.find(({payload}) => payload.action === "games")).toBeUndefined();
  });

  it("nao envia quase nivel quando a distancia para o proximo nivel e de 100 XP ou mais", async () => {
    seedEligibleUser({experiencePoints: 1750});

    await sendGamificationNudgesDaily();

    expect(sentActions()).toEqual(["badges", "games"]);
    expect(notificationCalls).toHaveLength(2);
    expect(notificationCalls.find(({payload}) => payload.action === "achievements")).toBeUndefined();
  });

  it("nao envia quase badge quando o progresso fica abaixo de 80 por cento", async () => {
    seedEligibleUser({goals: 19});

    await sendGamificationNudgesDaily();

    expect(sentActions()).toEqual(["achievements", "games"]);
    expect(notificationCalls).toHaveLength(2);
    expect(notificationCalls.find(({payload}) => payload.action === "badges")).toBeUndefined();
  });

  it("nao envia streak quando o jogo aberto ja foi confirmado", async () => {
    seedEligibleUser({confirmationStatus: "CONFIRMED"});

    await sendGamificationNudgesDaily();

    expect(sentActions()).toEqual(["achievements", "badges"]);
    expect(notificationCalls).toHaveLength(2);
    expect(notificationCalls.find(({payload}) => payload.action === "games")).toBeUndefined();
  });

  it("respeita opt-out no helper de entrega sem quebrar o cron", async () => {
    seedEligibleUser();
    optedOutUsers.add("user-1");

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(3);
    expect(deliveredNotifications).toHaveLength(0);
    expect(store.has("notifications/gamification_nudge_almost_level_user-1_2026-07-19")).toBe(true);
    expect(store.has("notifications/gamification_nudge_almost_badge_user-1_2026-07-19")).toBe(true);
    expect(store.has("notifications/gamification_nudge_streak_at_risk_user-1_2026-07-19")).toBe(true);
  });

  it("nao duplica em corrida concorrente no mesmo dia", async () => {
    seedEligibleUser();

    await Promise.all([
      sendGamificationNudgesDaily(),
      sendGamificationNudgesDaily(),
    ]);

    expect(notificationCalls).toHaveLength(3);
    expect(deliveredNotifications).toHaveLength(3);
    expect(mockClaimNotificationEventOnce).toHaveBeenCalled();
    expect(mockCompleteNotificationEvent).toHaveBeenCalledTimes(3);
    expect(mockLogger.info).toHaveBeenCalledWith("[GAMIFICATION_NUDGES] daily run complete");
  });

  it("libera a claim e permite retry depois de falha de envio", async () => {
    seedEligibleUser({experiencePoints: 1755, goals: 0, streak: 2});

    mockSendAndSaveNotification.mockImplementationOnce(async (
      userId: string,
      payload: Record<string, unknown>,
      docId?: string,
    ) => {
      notificationCalls.push({userId, payload, docId});
      throw new Error("FCM unavailable");
    });

    await expect(sendGamificationNudgesDaily()).rejects.toThrow("FCM unavailable");
    expect(mockReleaseNotificationEvent).toHaveBeenCalledWith(
      "gamification_nudge_almost_level_user-1_2026-07-19",
    );

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(2);
    expect(mockCompleteNotificationEvent).toHaveBeenCalledWith(
      "gamification_nudge_almost_level_user-1_2026-07-19",
    );
  });

  it("seleciona um jogo futuro aberto mesmo quando os primeiros estao confirmados", async () => {
    seedFutureGameBurstFixture();

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(1);
    expect(notificationCalls[0]).toEqual(expect.objectContaining({
      docId: "gamification_nudge_streak_at_risk_user-1_2026-07-19",
      payload: expect.objectContaining({
        action: "games",
        gameId: "game-11",
      }),
    }));
  });
});
