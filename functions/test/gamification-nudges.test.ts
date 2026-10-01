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
        read: false,
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

import {
  runGamificationNudges,
  sendGamificationNudgesDaily,
} from "../src/gamification-nudges";

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
        docId: "gamification_nudge_almost_level_user-1",
        payload: expect.objectContaining({
          title: "Quase subir de nível!",
          body: "Faltam 95 XP para Experiente",
          type: "ACHIEVEMENT",
          action: "achievements",
        }),
      }),
      expect.objectContaining({
        userId: "user-1",
        docId: "gamification_nudge_almost_badge_user-1",
        payload: expect.objectContaining({
          title: "Quase conquista!",
          body: "Faltam 5 gols para Goleador",
          type: "ACHIEVEMENT",
          action: "badges",
        }),
      }),
      expect.objectContaining({
        userId: "user-1",
        docId: "gamification_nudge_streak_at_risk_user-1",
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
    expect(store.has("notifications/gamification_nudge_almost_level_user-1")).toBe(true);
    expect(store.has("notifications/gamification_nudge_almost_badge_user-1")).toBe(true);
    expect(store.has("notifications/gamification_nudge_streak_at_risk_user-1")).toBe(true);
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
    expect(mockReleaseNotificationEvent).toHaveBeenCalledTimes(3);
    expect(mockLogger.info).toHaveBeenCalledWith("[GAMIFICATION_NUDGES] daily run complete");
  });

  it("#4058: 2 execuções em dias diferentes com estado idêntico ⇒ 1 notificação", async () => {
    seedEligibleUser({experiencePoints: 1755, goals: 0, streak: 0});

    await sendGamificationNudgesDaily();
    expect(notificationCalls).toHaveLength(1);

    // Avança 1 dia (dentro do cooldown de 7 dias) mantendo o estado idêntico.
    jest.setSystemTime(new Date(baseNow.getTime() + 24 * 60 * 60 * 1000));
    notificationCalls.length = 0;

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(0);
  });

  it("#4058: reenvia quando o valor muda (sem esperar o cooldown)", async () => {
    seedEligibleUser({experiencePoints: 1755, goals: 0, streak: 0});

    await sendGamificationNudgesDaily();
    expect(notificationCalls).toHaveLength(1);

    // xpLeft muda de 95 para 94 — valor diferente justifica reenvio imediato.
    store.set("users/user-1", {experience_points: 1756});
    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(2);
  });

  it("#4058: suspende um tipo após 3 não lidos consecutivos", async () => {
    seedEligibleUser({experiencePoints: 1755, goals: 0, streak: 0});

    await sendGamificationNudgesDaily(); // run 1 → consecutive_unread = 0

    // Cada execução muda o valor para contornar o cooldown; a notificação
    // permanece não lida (read=false), acumulando não-lidos consecutivos.
    for (let xp = 1756; xp <= 1758; xp++) {
      store.set("users/user-1", {experience_points: xp});
      await sendGamificationNudgesDaily();
    }

    const levelCalls = notificationCalls.filter(
      ({payload}) => payload.action === "achievements"
    ).length;
    // run1 (95) + run2 (94) + run3 (93) = 3; run4 (92) seria o 4º não lido
    // consecutivo e é suprimido.
    expect(levelCalls).toBe(3);
  });

  it("isola a falha de envio (nao aborta o run), libera a claim e permite retry", async () => {
    seedEligibleUser({experiencePoints: 1755, goals: 0, streak: 2});

    mockSendAndSaveNotification.mockImplementationOnce(async (
      userId: string,
      payload: Record<string, unknown>,
      docId?: string,
    ) => {
      notificationCalls.push({userId, payload, docId});
      throw new Error("FCM unavailable");
    });

    // #3875: o run NAO deve mais propagar a falha do usuario — deve logar e
    // seguir. A claim e liberada para preservar a idempotencia do dedup.
    await expect(sendGamificationNudgesDaily()).resolves.toBeUndefined();
    expect(mockReleaseNotificationEvent).toHaveBeenCalledWith(
      "gamification_nudge_almost_level_user-1",
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      "[GAMIFICATION_NUDGES] falha ao processar usuário; seguindo",
      expect.objectContaining({userId: "user-1"}),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[GAMIFICATION_NUDGES] daily run complete",
    );

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(2);
    expect(mockReleaseNotificationEvent).toHaveBeenCalledWith(
      "gamification_nudge_almost_level_user-1",
    );
  });

  it("uma falha de usuario nao impede os proximos de receberem nudge", async () => {
    // Dois usuarios elegiveis a "quase nivel". O primeiro (por ordem de id)
    // lanca no envio; o segundo ainda deve receber.
    seedDoc("users/user-a", {experience_points: 1755});
    seedDoc("users/user-b", {experience_points: 1755});

    mockSendAndSaveNotification.mockImplementation(async (
      userId: string,
      payload: Record<string, unknown>,
      docId?: string,
    ) => {
      notificationCalls.push({userId, payload, docId});
      if (userId === "user-a") {
        throw new Error("documento corrompido");
      }
      store.set(`notifications/${docId}`, {user_id: userId, ...payload});
      deliveredNotifications.push({userId, payload, docId});
      return true;
    });

    await expect(sendGamificationNudgesDaily()).resolves.toBeUndefined();

    expect(mockReleaseNotificationEvent).toHaveBeenCalledWith(
      "gamification_nudge_almost_level_user-a",
    );
    expect(deliveredNotifications.map(({userId}) => userId)).toContain("user-b");
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[GAMIFICATION_NUDGES] daily run complete",
    );
  });

  it("persiste o cursor ao esgotar o orcamento e retoma na execucao seguinte", async () => {
    // Quatro usuarios elegiveis; pageLimit=2 e orcamento estourado apos a
    // primeira pagina. A primeira execucao processa user-1/user-2 e persiste o
    // cursor; a segunda retoma de user-3/user-4 (sem reprocessar o prefixo).
    for (const id of ["user-1", "user-2", "user-3", "user-4"]) {
      seedDoc(`users/${id}`, {experience_points: 1755});
    }

    // Relogio artificial: avanca alem do orcamento logo apos a 1a pagina.
    let ticks = 0;
    const now = () => {
      ticks += 1;
      return ticks === 1 ? 0 : 10_000;
    };

    await runGamificationNudges({
      pageLimit: 2,
      timeBudgetMs: 1_000,
      concurrency: 1,
      now,
    });

    // 1a execucao: apenas user-1 e user-2.
    expect(notificationCalls.map(({userId}) => userId).sort())
      .toEqual(["user-1", "user-2"]);
    // Cursor persistido aponta para o ultimo processado (user-2).
    expect(store.get("system_state/gamification_nudges_cursor"))
      .toEqual(expect.objectContaining({last_user_id: "user-2"}));

    // 2a execucao: retoma de user-3 (sem relogio artificial, roda ate o fim).
    notificationCalls.length = 0;
    await runGamificationNudges({pageLimit: 2});

    expect(notificationCalls.map(({userId}) => userId).sort())
      .toEqual(["user-3", "user-4"]);
    // Varredura concluida: doc de estado apagado.
    expect(store.has("system_state/gamification_nudges_cursor")).toBe(false);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "[GAMIFICATION_NUDGES] daily run complete",
    );
  });

  it(
    "#3901: retoma do ponto seguinte quando o usuario do cursor foi excluido " +
    "(nao reinicia a varredura)",
    async () => {
      // Quatro usuarios elegiveis. A 1a execucao persiste o cursor em
      // user-2; antes da 2a execucao, user-2 e excluido de verdade (delete
      // real, como account-cleanup.ts faz). A retomada deve continuar de
      // user-3/user-4 — nao reiniciar em user-1.
      for (const id of ["user-1", "user-2", "user-3", "user-4"]) {
        seedDoc(`users/${id}`, {experience_points: 1755});
      }

      let ticks = 0;
      const now = () => {
        ticks += 1;
        return ticks === 1 ? 0 : 10_000;
      };

      await runGamificationNudges({
        pageLimit: 2,
        timeBudgetMs: 1_000,
        concurrency: 1,
        now,
      });

      expect(notificationCalls.map(({userId}) => userId).sort())
        .toEqual(["user-1", "user-2"]);
      expect(store.get("system_state/gamification_nudges_cursor"))
        .toEqual(expect.objectContaining({last_user_id: "user-2"}));

      // Usuario do cursor e excluido de verdade (delete real, nao soft-delete).
      store.delete("users/user-2");
      notificationCalls.length = 0;

      // now() explicito e proximo do timestamp persistido (10_000ms) — bem
      // abaixo do teto de 48h — para nao acionar o descarte por idade (#3901
      // D2), que e testado separadamente.
      await runGamificationNudges({pageLimit: 2, now: () => 20_000});

      // Retomada continua de user-3/user-4 — NAO reinicia em user-1.
      expect(notificationCalls.map(({userId}) => userId).sort())
        .toEqual(["user-3", "user-4"]);
      expect(store.has("system_state/gamification_nudges_cursor")).toBe(false);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("cursor persistido excede"),
        expect.anything(),
      );
    },
  );

  it(
    "#3901: descarta cursor persistido ha mais de 48h e reinicia do inicio",
    async () => {
      for (const id of ["user-1", "user-2"]) {
        seedDoc(`users/${id}`, {experience_points: 1755});
      }

      // Cursor persistido apontando para user-1, ha 49h (acima do teto de 48h).
      const staleUpdatedAt = new Date(baseNow.getTime() - 49 * 60 * 60 * 1000);
      seedDoc("system_state/gamification_nudges_cursor", {
        last_user_id: "user-1",
        updated_at: {toDate: () => staleUpdatedAt},
      });

      await runGamificationNudges({pageLimit: 10, now: () => baseNow.getTime()});

      // Cursor obsoleto descartado: varredura reinicia do inicio (user-1
      // tambem recebe nudge, nao e pulado como "ja processado").
      expect(notificationCalls.map(({userId}) => userId).sort())
        .toEqual(["user-1", "user-2"]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "[GAMIFICATION_NUDGES] cursor persistido excede 48h; " +
          "descartando e reiniciando varredura do início",
        expect.objectContaining({lastUserId: "user-1"}),
      );
    },
  );

  it("encontra o grupo ativo relevante mesmo com mais de 20 memberships", async () => {
    // Usuario com 25 grupos inativos (ids que ordenam antes) + 1 grupo ativo
    // com jogo futuro aberto. O limit(20) sem orderBy antigo podia devolver so
    // os inativos; com orderBy(documentId()) + cap 100, o ativo aparece.
    const userId = "user-1";
    seedDoc(`users/${userId}`, {experience_points: 0});
    seedDoc(`statistics/${userId}`, {totalGoals: 0});
    seedDoc(`user_streaks/${userId}`, {current_streak: 3});

    for (let index = 0; index < 25; index++) {
      const groupId = `group-inactive-${String(index).padStart(2, "0")}`;
      seedDoc(`groups/${groupId}/members/member-${userId}`, {
        user_id: userId,
        status: "INACTIVE",
      });
    }

    // Id ordena depois dos inativos ("group-inactive-*" < "group-z-active").
    const activeGroup = "group-z-active";
    seedDoc(`groups/${activeGroup}/members/member-${userId}`, {
      user_id: userId,
      status: "ACTIVE",
    });
    seedDoc("games/game-active", {
      group_id: activeGroup,
      status: "SCHEDULED",
      dateTime: {toDate: () => new Date("2026-07-20T15:00:00.000Z")},
    });

    await sendGamificationNudgesDaily();

    const streakCall = notificationCalls.find(
      ({payload}) => payload.action === "games",
    );
    expect(streakCall).toBeDefined();
    expect(streakCall?.payload).toEqual(expect.objectContaining({
      gameId: "game-active",
    }));
  });

  it("#4150: NÃO manda nudge de streak quando o jogo aberto está fora da janela de 8 dias", async () => {
    // game-11 e game-12 são os únicos abertos e estão a +12/+13 dias —
    // confirmar não salva mais a sequência com a janela de 8 dias.
    seedFutureGameBurstFixture();

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(0);
  });

  it("#4150: seleciona jogo futuro aberto DENTRO da janela de 8 dias", async () => {
    const userId = "user-1";
    const groupId = "group-1";
    seedDoc(`users/${userId}`, {experience_points: 0});
    seedDoc(`statistics/${userId}`, {totalGoals: 0});
    seedDoc(`user_streaks/${userId}`, {current_streak: 3});
    seedDoc(`groups/${groupId}/members/member-1`, {
      user_id: userId,
      status: "ACTIVE",
    });

    // Jogos a +2..+6 dias: user-1 confirmou nos 3 primeiros; o 1º aberto
    // (sem confirmação dele) é game-4, a +5 dias — dentro da janela de 8.
    for (let index = 1; index <= 5; index++) {
      const gameId = `game-${index}`;
      const start = new Date(Date.UTC(2026, 6, 20 + index, 15, 0, 0));
      seedDoc(`games/${gameId}`, {
        group_id: groupId,
        status: "CONFIRMED",
        dateTime: {toDate: () => start},
      });
      if (index <= 3) {
        seedDoc(`confirmations/game-${index}_${userId}`, {
          game_id: gameId,
          user_id: userId,
          status: "CONFIRMED",
        });
      }
    }

    await sendGamificationNudgesDaily();

    expect(notificationCalls).toHaveLength(1);
    expect(notificationCalls[0]).toEqual(expect.objectContaining({
      docId: "gamification_nudge_streak_at_risk_user-1",
      payload: expect.objectContaining({
        action: "games",
        gameId: "game-4",
      }),
    }));
  });
});
