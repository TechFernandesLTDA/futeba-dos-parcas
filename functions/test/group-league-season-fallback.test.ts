/**
 * FIX #3882 — partidas de liga NÃO são mais descartadas quando não há
 * `league_seasons` com is_active==true (janela de virada de mês ou falha
 * do cron de season). O trigger deriva o season_id determinístico (YYYY-MM)
 * da data do jogo e aplica a partida normalmente, logando em WARN.
 */
const mockDb = jest.fn();
let mockOnGameWrittenHandler: ((event: unknown) => Promise<void>) | null = null;

const loggerInfo = jest.fn();
const loggerWarn = jest.fn();
const loggerError = jest.fn();

jest.mock("../src/_db", () => ({
  db: mockDb,
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: loggerInfo,
    warn: loggerWarn,
    error: loggerError,
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => ({__serverTimestamp: true})),
    increment: jest.fn((value: number) => ({__increment: value})),
  },
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_options: unknown, handler: (event: unknown) => Promise<void>) => {
    mockOnGameWrittenHandler = handler;
    return handler;
  }),
}));

import {deriveFallbackSeasonId} from "../src/group-league";

type AnyDoc = Record<string, unknown>;

/**
 * Firestore fake mínimo: sem match anterior, com confirmações/times válidos
 * e SEM nenhuma season ativa (query vazia) — reproduz a janela de virada.
 *
 * @param {AnyDoc} currentGame Documento atual do jogo.
 * @return {object} Harness com firestore fake e writes capturados.
 */
function createTurnoverWindowFirestore(currentGame: AnyDoc) {
  const writes: Array<{kind: "set" | "delete"; path: string; data?: AnyDoc}> = [];

  const confirmationDocs = [
    {user_id: "u1", status: "CONFIRMED", goals: 2, assists: 0, is_mvp: true},
    {user_id: "u2", status: "CONFIRMED", goals: 0, assists: 1, is_mvp: false},
  ];
  const teamDocs = [
    {id: "team-a", name: "A", player_ids: ["u1"], score: 3},
    {id: "team-b", name: "B", player_ids: ["u2"], score: 0},
  ];

  const snapshot = (data?: AnyDoc) => ({
    exists: Boolean(data),
    data: () => data,
  });
  const querySnapshot = (docs: Array<{id: string; data: () => AnyDoc}>) => ({
    docs,
    empty: docs.length === 0,
  });

  const makeQuery = (path: string): any => ({
    path,
    where: jest.fn(function(this: unknown) {
      return this;
    }),
    limit: jest.fn(function(this: unknown) {
      return this;
    }),
  });

  const makeDocument = (path: string): any => ({
    path,
    id: path.split("/").at(-1),
    collection: (name: string) => makeCollection(`${path}/${name}`),
  });
  const makeCollection = (path: string): any => ({
    path,
    doc: (id: string) => makeDocument(`${path}/${id}`),
    where: jest.fn(() => makeQuery(path)),
  });

  const firestore = {
    collection: (name: string) => makeCollection(name),
    runTransaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) => {
      const tx = {
        getAll: jest.fn(async (...refs: Array<{path: string}>) =>
          refs.map(() => snapshot(undefined))),
        get: jest.fn(async (query: {path: string}) => {
          if (query.path === "games/game-1") {
            return snapshot(currentGame);
          }
          if (query.path === "confirmations") {
            return querySnapshot(
              confirmationDocs.map((doc, index) => ({
                id: `confirmation-${index}`,
                data: () => doc,
              })),
            );
          }
          if (query.path === "teams") {
            return querySnapshot(
              teamDocs.map((doc) => ({id: doc.id, data: () => doc})),
            );
          }
          // Query de season ativa: VAZIA — janela de virada (#3882)
          return querySnapshot([]);
        }),
        set: jest.fn((ref: {path: string}, data: AnyDoc) => {
          writes.push({kind: "set", path: ref.path, data});
        }),
        delete: jest.fn((ref: {path: string}) => {
          writes.push({kind: "delete", path: ref.path});
        }),
      };
      await callback(tx);
    }),
  };

  return {firestore, writes};
}

function gameWriteEvent(before: AnyDoc | undefined, after: AnyDoc) {
  return {
    params: {gameId: "game-1"},
    data: {
      before: {data: () => before},
      after: {data: () => after},
    },
  };
}

describe("FIX #3882 — fallback determinístico de season na liga de grupo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnGameWrittenHandler = null;
    jest.isolateModules(() => {
      require("../src/group-league");
    });
  });

  describe("deriveFallbackSeasonId", () => {
    it("deriva YYYY-MM da data do jogo", () => {
      expect(deriveFallbackSeasonId("2026-08-01")).toBe("2026-08");
      expect(deriveFallbackSeasonId("2026-12-31T23:30:00")).toBe("2026-12");
    });

    it("sem data utilizável, usa o mês corrente em BRT", () => {
      // 2026-08-01 02:30 UTC = 2026-07-31 23:30 BRT → mês 2026-07
      const now = new Date("2026-08-01T02:30:00Z");
      expect(deriveFallbackSeasonId("", now)).toBe("2026-07");
      expect(deriveFallbackSeasonId("sem-data", now)).toBe("2026-07");
    });
  });

  it("aplica a partida com season derivada da data quando NÃO há season ativa", async () => {
    const game = {
      status: "FINISHED",
      group_id: "group-1",
      date: "2026-08-01",
    };
    const {firestore, writes} = createTurnoverWindowFirestore(game);
    mockDb.mockReturnValue(firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {...game, status: "LIVE"},
      game,
    ));

    // A partida FOI armazenada (antes: descartada silenciosamente)
    const matchWrite = writes.find(
      (write) => write.path === "groups/group-1/league_matches/game-1",
    );
    expect(matchWrite).toBeDefined();
    expect(matchWrite?.data).toMatchObject({season_id: "2026-08"});

    // Standings gravadas com o season_id determinístico
    const standingPaths = writes
      .filter((write) => write.path.includes("/league_standings/"))
      .map((write) => write.path);
    expect(standingPaths).toEqual(expect.arrayContaining([
      "groups/group-1/league_standings/2026-08_u1",
      "groups/group-1/league_standings/2026-08_u2",
    ]));

    // Alerta em WARN (não info) — distinguível de operação normal
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("fallback season 2026-08"),
    );
  });

  it("continua usando a season ativa quando ela existe (sem fallback)", async () => {
    const game = {
      status: "FINISHED",
      group_id: "group-1",
      date: "2026-08-01",
    };
    const {firestore, writes} = createTurnoverWindowFirestore(game);
    // Sobrescreve a query de season ativa para retornar uma season
    const originalRunTransaction = firestore.runTransaction;
    firestore.runTransaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) => {
      await originalRunTransaction(async (tx: any) => {
        const originalGet = tx.get;
        tx.get = jest.fn(async (query: {path: string}) => {
          if (
            query.path !== "games/game-1" &&
            query.path !== "confirmations" &&
            query.path !== "teams"
          ) {
            return {
              docs: [{id: "2026-08", data: () => ({is_active: true})}],
              empty: false,
            };
          }
          return originalGet(query);
        });
        await callback(tx);
      });
    }) as any;
    mockDb.mockReturnValue(firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {...game, status: "LIVE"},
      game,
    ));

    const matchWrite = writes.find(
      (write) => write.path === "groups/group-1/league_matches/game-1",
    );
    expect(matchWrite?.data).toMatchObject({season_id: "2026-08"});
    expect(loggerWarn).not.toHaveBeenCalled();
  });
});
