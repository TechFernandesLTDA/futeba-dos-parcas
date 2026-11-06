/**
 * TESTES DE OURO DO PIPELINE DE XP (A1 do plano de modernização)
 *
 * Objetivo: CONGELAR o que o código atual calcula e grava para um jogo
 * finalizado. Não é um teste de correção. Cada fixture em
 * `fixtures/*.json` descreve um jogo sintético (gols, assistências,
 * defesas, resultado, MVP, Bola Murcha, streak, tetos anti-cheat). O
 * trigger REAL `onGameStatusUpdate` roda contra um Firestore em memória
 * e o estado gravado (xp_logs, users, statistics, game) é comparado com
 * o bloco `expected` do fixture.
 *
 * REGRA: o `expected` NÃO é calculado à mão pela tabela de XP. Ele é
 * obtido rodando o código atual, com:
 *
 *   XP_GOLDEN_RECORD=1 npx jest test/xp-golden --no-coverage
 *
 * (isso regrava o bloco `expected` de cada fixture). Quando a saída
 * parecer errada, ela é congelada mesmo assim e marcada no fixture com
 * "hoje_calcula_assim" (ver DIAGNOSTICO citado no plano).
 *
 * Os mocks abaixo replicam os de `test/onGameStatusUpdate.test.ts`, com
 * a diferença de que o Firestore é um fake real em memória.
 */

import * as fs from "fs";
import * as path from "path";

import {FakeFirestore, FakeTimestamp} from "./fake-firestore";
import {sharedStore} from "./fake-store-singleton";

jest.mock("firebase-admin", () => {
  const {createFakeAdmin} = require("./fake-firestore");
  const {sharedStore: store} = require("./fake-store-singleton");
  return createFakeAdmin(store);
});

jest.mock("firebase-admin/firestore", () => {
  const {FieldValue, FieldPath, FakeTimestamp: Ts} = require("./fake-firestore");
  return {FieldValue, FieldPath, Timestamp: Ts};
});

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((_config: any, handler: any) => handler),
  onDocumentDeleted: jest.fn((_config: any, handler: any) => handler),
  onDocumentCreated: jest.fn((_config: any, handler: any) => handler),
  onDocumentWritten: jest.fn((_config: any, handler: any) => handler),
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((config: any, handler: any) => handler || config),
  onRequest: jest.fn((config: any, handler: any) => handler || config),
  HttpsError: class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock("firebase-functions/v2", () => ({
  setGlobalOptions: jest.fn(),
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  scheduler: {
    onSchedule: jest.fn(() => jest.fn()),
  },
  https: {
    onCall: jest.fn((config: any, handler: any) => handler || config),
    HttpsError: class HttpsError extends Error {
      code: string;
      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
    onRequest: jest.fn((config: any, handler: any) => handler || config),
  },
  storage: {
    onObjectFinalized: jest.fn(() => jest.fn()),
  },
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(() => jest.fn()),
}));

jest.mock("../../src/notifications", () => ({
  sendStreakNotificationIfMilestone: jest.fn().mockResolvedValue(undefined),
  sendNotificationToUser: jest.fn(),
  saveNotificationToFirestore: jest.fn(),
  NotificationType: {GAME_REMINDER: "GAME_REMINDER"},
}));

jest.mock("../../src/league", () => ({
  calculateLeaguePromotion: jest.fn(),
  calculateLeagueRating: jest.fn(),
  PROMOTION_GAMES_REQUIRED: 5,
  RELEGATION_GAMES_REQUIRED: 3,
}));

jest.mock("../../src/activities", () => ({
  generateGameFinishedActivityDirect: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/reminders", () => ({}));
jest.mock("../../src/season", () => ({}));
jest.mock("../../src/user-management", () => ({}));
jest.mock("../../src/maintenance/cleanup-old-logs", () => ({}));
jest.mock("../../src/maintenance/soft-delete", () => ({}));
jest.mock("../../src/monitoring/collect-metrics", () => ({}));
jest.mock("../../src/storage/generate-thumbnails", () => ({}));
jest.mock("../../src/auth/custom-claims", () => ({}));
jest.mock("../../src/middleware/rate-limiter", () => ({
  RATE_LIMITS: {
    FINANCE_MANAGE: {maxRequests: 120, windowMs: 60_000},
    FINANCE_REBUILD: {maxRequests: 10, windowMs: 60_000},
    FINANCE_SETTLE: {maxRequests: 60, windowMs: 60_000},
  },
  checkRateLimit: jest.fn().mockResolvedValue({allowed: true, remaining: 9}),
}));
jest.mock("../../src/notifications/batch-sender", () => ({}));
jest.mock("../../src/monitoring/alerting", () => ({}));
jest.mock("../../src/cache/leaderboard-cache", () => ({}));
jest.mock("../../src/xp/parallel-processing", () => ({}));
jest.mock("../../src/voting/mvp-voting", () => ({}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {onGameStatusUpdate} = require("../../src/index");

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const GAME_ID = "game1";
const OWNER_ID = "owner1";
const RECORD = process.env.XP_GOLDEN_RECORD === "1";

/** Data fixa do jogo: 2026-04-14 20:00 BRT (23:00Z). */
const NOW_ISO = "2026-04-15T12:00:00.000-03:00";

/**
 * Converte marcadores {"__ts": "<iso>"} do JSON em FakeTimestamp, e
 * recursivamente no restante do objeto.
 */
function hydrate(value: any): any {
  if (Array.isArray(value)) return value.map(hydrate);
  if (value && typeof value === "object") {
    if (typeof value.__ts === "string") {
      return FakeTimestamp.fromDate(new Date(value.__ts));
    }
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = hydrate(v);
    return out;
  }
  return value;
}

/** Normaliza para congelamento: timestamps viram "<ts>". */
function normalize(value: any): any {
  if (value instanceof FakeTimestamp) return "<ts>";
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value).sort()) out[k] = normalize(value[k]);
    return out;
  }
  return value;
}

/** Diferença de campos de nível topo entre o seed e o estado final. */
function changedFields(
  before: Record<string, any> | undefined,
  after: Record<string, any> | undefined,
): Record<string, any> {
  const out: Record<string, any> = {};
  if (!after) return out;
  for (const k of Object.keys(after).sort()) {
    const b = before?.[k];
    const a = after[k];
    if (JSON.stringify(normalize(b)) !== JSON.stringify(normalize(a))) {
      out[k] = normalize(a);
    }
  }
  return out;
}

interface Fixture {
  description: string;
  hoje_calcula_assim?: string;
  seed: {
    game: Record<string, any>;
    before: Record<string, any>;
    confirmations: Array<Record<string, any>>;
    teams: Array<Record<string, any>>;
    liveScore?: Record<string, any> | null;
    gamificationSettings?: Record<string, any> | null;
    gameEvents?: Array<Record<string, any>>;
    users: Record<string, Record<string, any>>;
    statistics?: Record<string, Record<string, any>>;
    streaks?: Record<string, Record<string, any>>;
    activeSeasonId?: string;
  };
  expected?: Record<string, any>;
}

/**
 * Carrega o seed do fixture no store compartilhado e devolve as
 * referências usadas para montar o evento do trigger.
 */
function seedStore(fx: Fixture): {beforeGame: Record<string, any>} {
  sharedStore.reset();
  const s = hydrate(fx.seed);

  const afterGame = {
    id: GAME_ID,
    owner_id: OWNER_ID,
    ...s.game,
    status: "FINISHED",
  };
  const beforeGame = {...afterGame, ...s.before};
  sharedStore.seed(`games/${GAME_ID}`, afterGame);

  sharedStore.seed(`users/${OWNER_ID}`, {name: "Owner"});
  for (const [uid, data] of Object.entries<any>(s.users)) {
    sharedStore.seed(`users/${uid}`, data);
  }
  for (const [uid, data] of Object.entries<any>(s.statistics ?? {})) {
    sharedStore.seed(`statistics/${uid}`, data);
  }
  for (const [uid, data] of Object.entries<any>(s.streaks ?? {})) {
    sharedStore.seed(`user_streaks/${uid}`, {user_id: uid, ...data});
  }
  for (const c of s.confirmations) {
    sharedStore.seed(`confirmations/${GAME_ID}_${c.user_id}`, {game_id: GAME_ID, ...c});
  }
  s.teams.forEach((t: any) => sharedStore.seed(`teams/${t.id}`, {game_id: GAME_ID, ...t}));
  if (s.liveScore) {
    sharedStore.seed(`live_scores/${GAME_ID}`, s.liveScore);
  }
  if (s.gamificationSettings) {
    sharedStore.seed("app_settings/gamification", s.gamificationSettings);
  }
  (s.gameEvents ?? []).forEach((e: any, i: number) =>
    sharedStore.seed(`game_events/ev${i + 1}`, {game_id: GAME_ID, ...e}),
  );
  if (s.activeSeasonId) {
    sharedStore.seed(`seasons/${s.activeSeasonId}`, {is_active: true});
  }
  return {beforeGame};
}

/** Captura o estado final relevante ao XP. */
function captureOutput(fx: Fixture): Record<string, any> {
  const uids = fx.seed.confirmations.map((c: any) => c.user_id as string);

  const out: Record<string, any> = {xp_logs: {}, users: {}, game: {}};
  for (const uid of uids) {
    const logPath = `xp_logs/game_${GAME_ID}_user_${uid}`;
    const log = sharedStore.docs.get(logPath);
    out.xp_logs[uid] = log ? normalize(log) : null;
    const userNow = sharedStore.docs.get(`users/${uid}`);
    const userSeed = fx.seed.users[uid];
    out.users[uid] = changedFields(
      hydrate(userSeed) as Record<string, any>,
      userNow,
    );
  }
  out.game = changedFields(
    hydrate({id: GAME_ID, owner_id: OWNER_ID, ...fx.seed.game, status: "FINISHED"}),
    sharedStore.docs.get(`games/${GAME_ID}`),
  );
  return out;
}

function loadFixtures(): Array<{name: string; file: string; fixture: Fixture}> {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.json$/, ""),
      file: path.join(FIXTURES_DIR, file),
      fixture: JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), "utf8")) as Fixture,
    }));
}

describe("XP golden: onGameStatusUpdate (caracterização do código atual)", () => {
  beforeAll(() => {
    // Só a Date fica congelada; timers reais continuam funcionando.
    jest.useFakeTimers({
      now: new Date(NOW_ISO),
      doNotFake: [
        "setTimeout", "clearTimeout", "setInterval", "clearInterval",
        "setImmediate", "clearImmediate", "nextTick", "queueMicrotask",
      ],
    });
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  for (const {name, file, fixture} of loadFixtures()) {
    // HOJE CALCULA ASSIM (ver fixture.hoje_calcula_assim): o expect abaixo
    // congela o comportamento atual, mesmo quando parece incorreto.
    const marca = fixture.hoje_calcula_assim ? " [HOJE CALCULA ASSIM]" : "";
    test(`${name}: ${fixture.description}${marca}`, async () => {
      const {beforeGame} = seedStore(fixture);
      const gameRef = new FakeFirestore(sharedStore).doc(`games/${GAME_ID}`);
      const event = {
        data: {
          before: {data: () => beforeGame, ref: {id: GAME_ID}},
          after: {
            data: () => sharedStore.docs.get(`games/${GAME_ID}`),
            ref: gameRef,
          },
        },
        params: {gameId: GAME_ID},
      };

      await (onGameStatusUpdate as any)(event);

      const actual = captureOutput(fixture);

      if (RECORD) {
        const raw = JSON.parse(fs.readFileSync(file, "utf8"));
        raw.expected = actual;
        fs.writeFileSync(file, JSON.stringify(raw, null, 2) + "\n");
        return;
      }

      expect(fixture.expected).toBeDefined();
      expect(actual).toEqual(fixture.expected);
    });
  }
});
