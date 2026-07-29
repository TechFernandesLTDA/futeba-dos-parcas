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
  // FIX #3908: activeSeasonQuery ganhou orderBy(FieldPath.documentId()) e
  // start_date do provisionamento sob demanda passou a usar Timestamp.
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({__timestamp: date.toISOString()})),
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
  const writes: Array<{kind: "set" | "update" | "delete"; path: string; data?: AnyDoc}> = [];

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
    orderBy: jest.fn(function(this: unknown) {
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
        update: jest.fn((ref: {path: string}, data: AnyDoc) => {
          writes.push({kind: "update", path: ref.path, data});
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
    // FIX #3917: o provisionamento sob demanda agora clampa is_active ao mês
    // corrente via deriveFallbackSeasonId("", new Date()). Fake timers fixam
    // o "agora" em agosto/2026 para que os testes sejam determinísticos
    // independentemente de quando rodam.
    jest.useFakeTimers({now: new Date("2026-08-15T12:00:00Z")});
    jest.isolateModules(() => {
      require("../src/group-league");
    });
  });

  afterEach(() => {
    jest.useRealTimers();
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

    // FIX #3896: a temporada passa a ser provisionada sob demanda, para que
    // groups/{id}/league_seasons deixe de ficar vazio e a aba Liga consiga
    // resolver a temporada. start_date é obrigatório: useGroupLeague ordena
    // por ele, e doc sem o campo sairia silenciosamente da consulta.
    const seasonWrite = writes.find(
      (write) => write.path === "groups/group-1/league_seasons/2026-08",
    );
    expect(seasonWrite).toBeDefined();
    expect(seasonWrite?.data).toMatchObject({is_active: true});
    expect(seasonWrite?.data).toHaveProperty("start_date");

    // FIX #3896: deixou de ser WARN — sem season ativa era o estado normal
    // de todo grupo não oficial, e o alerta disparava a cada jogo.
    expect(loggerWarn).not.toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledWith(
      expect.stringContaining("season 2026-08"),
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

  // FIX #3908: corrida do provisionamento sob demanda pode deixar duas
  // `league_seasons` is_active==true para o mesmo grupo (dois jogos de
  // meses diferentes finalizando ao mesmo tempo — ver D2.5 da spec
  // BUGFIX_3908). A transação seguinte de onGameFinishedGroupLeague deve
  // se autocurar: escolher a mais recente (orderBy documentId desc) e
  // desativar as demais na MESMA transação.
  it("desativa temporada ativa duplicada quando a leitura encontra mais de uma", async () => {
    const game = {
      status: "FINISHED",
      group_id: "group-1",
      date: "2026-08-15",
    };
    const {firestore, writes} = createTurnoverWindowFirestore(game);
    const originalRunTransaction = firestore.runTransaction;
    const staleSeasonRef = {path: "groups/group-1/league_seasons/2026-07"};
    firestore.runTransaction = jest.fn(async (callback: (tx: unknown) => Promise<void>) => {
      await originalRunTransaction(async (tx: any) => {
        const originalGet = tx.get;
        tx.get = jest.fn(async (query: {path: string}) => {
          if (
            query.path !== "games/game-1" &&
            query.path !== "confirmations" &&
            query.path !== "teams"
          ) {
            // Duas seasons ativas: a mais recente (2026-08, escolhida pelo
            // orderBy documentId desc) e uma obsoleta (2026-07, corrida).
            return {
              docs: [
                {id: "2026-08", data: () => ({is_active: true}), ref: {path: "groups/group-1/league_seasons/2026-08"}},
                {id: "2026-07", data: () => ({is_active: true}), ref: staleSeasonRef},
              ],
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
    // A temporada mais recente venceu — standings vão para ela.
    expect(matchWrite?.data).toMatchObject({season_id: "2026-08"});

    // A duplicata obsoleta foi desativada NA MESMA transação.
    const healWrite = writes.find(
      (write) => write.kind === "update" && write.path === staleSeasonRef.path,
    );
    expect(healWrite).toBeDefined();
    expect(healWrite?.data).toMatchObject({is_active: false});
  });

  // FIX #3917: jogo finalizado após a virada do mês (organizador fechando no
  // dia seguinte) não deve provisionar a temporada retroativa como ativa —
  // isso sequestraria a resolução de temporada de todos os jogos seguintes.
  it("provisiona temporada retroativa como INATIVA (jogo de mês passado)", async () => {
    // Jogo de 31 de julho finalizado em agosto (fechamento tardio).
    // Fake timer: agora = 2026-08-15 (beforeEach).
    const game = {
      status: "FINISHED",
      group_id: "group-1",
      date: "2026-07-31",
    };
    const {firestore, writes} = createTurnoverWindowFirestore(game);
    mockDb.mockReturnValue(firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {...game, status: "LIVE"},
      game,
    ));

    // A partida FOI armazenada na season do mês do jogo (julho).
    const matchWrite = writes.find(
      (write) => write.path === "groups/group-1/league_matches/game-1",
    );
    expect(matchWrite).toBeDefined();
    expect(matchWrite?.data).toMatchObject({season_id: "2026-07"});

    // A temporada de julho foi provisionada, mas como INATIVA — não pode
    // sequestrar a resolução ativa dos jogos seguintes.
    const seasonWrite = writes.find(
      (write) => write.path === "groups/group-1/league_seasons/2026-07",
    );
    expect(seasonWrite).toBeDefined();
    expect(seasonWrite?.data).toMatchObject({is_active: false});
    expect(seasonWrite?.data).toHaveProperty("start_date");
  });

  // FIX #3917: jogo do mês corrente (sem season ativa) ainda provisiona com
  // is_active:true — não regride o comportamento do #3896.
  it("provisiona temporada do mês corrente como ATIVA (jogo do mês atual)", async () => {
    // Fake timer: agora = 2026-08-15 (beforeEach).
    const game = {
      status: "FINISHED",
      group_id: "group-1",
      date: "2026-08-10",
    };
    const {firestore, writes} = createTurnoverWindowFirestore(game);
    mockDb.mockReturnValue(firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {...game, status: "LIVE"},
      game,
    ));

    const seasonWrite = writes.find(
      (write) => write.path === "groups/group-1/league_seasons/2026-08",
    );
    expect(seasonWrite).toBeDefined();
    expect(seasonWrite?.data).toMatchObject({is_active: true});
  });
});
