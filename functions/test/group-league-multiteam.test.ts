/**
 * FIX #2494 — pontuação multi-time da liga de grupo (modelo "ranking por
 * placar"). Testa as funções puras de resultado/saldo, garantindo que o caso
 * de 2 times reduz EXATAMENTE ao comportamento clássico.
 */
const mockDb = jest.fn();
let mockOnGameWrittenHandler: ((event: any) => Promise<void>) | null = null;

jest.mock("../src/_db", () => ({
  db: mockDb,
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_options: unknown, handler: any) => {
    mockOnGameWrittenHandler = handler;
    return handler;
  }),
}));

import {
  rankResult,
  opponentAverage,
  buildGroupLeaguePlayerResults,
  buildGroupLeagueTeamSummaries,
  getStoredTeamSummaries,
  resolveFinishedTeamScore,
} from "../src/group-league";

type LeagueTestDocument = Record<string, unknown>;

function storedHistoricalMatch(): LeagueTestDocument {
  return {
    game_id: "game-1",
    group_id: "group-1",
    season_id: "season-old",
    teams: [
      {team_id: "team-a", name: "A", score: 2, result: "WIN"},
      {team_id: "team-b", name: "B", score: 1, result: "LOSS"},
    ],
    player_results: [
      {
        user_id: "u1",
        team_id: "team-a",
        goals: 1,
        assists: 0,
        is_mvp: true,
        result: "WIN",
      },
      {
        user_id: "u2",
        team_id: "team-b",
        goals: 0,
        assists: 0,
        is_mvp: false,
        result: "LOSS",
      },
    ],
  };
}

function createLeagueFirestore(
  initialMatch?: LeagueTestDocument,
  options?: {
    confirmations?: Array<Record<string, unknown>>;
    teams?: Array<Record<string, unknown> & {id: string}>;
    currentGame?: LeagueTestDocument;
  },
) {
  const matchPath = "groups/group-1/league_matches/game-1";
  const matches = new Map<string, LeagueTestDocument>();
  if (initialMatch) matches.set(matchPath, initialMatch);

  const writes: Array<{kind: "set" | "delete"; path: string; data?: any}> = [];
  const transactionEvents: string[][] = [];
  let externalMatchReads = 0;
  let externalConfirmationReads = 0;
  let externalTeamReads = 0;
  let activeSeasonReads = 0;
  let transactionQueue = Promise.resolve();
  const confirmationDocs = options?.confirmations ?? [
    {
      user_id: "u1", status: "CONFIRMED", goals: 2, assists: 0,
      is_mvp: true,
    },
    {
      user_id: "u2", status: "CONFIRMED", goals: 0, assists: 1,
      is_mvp: false,
    },
  ];
  const teamDocs = options?.teams ?? [
    {id: "team-a", name: "A", player_ids: ["u1"], score: 3},
    {id: "team-b", name: "B", player_ids: ["u2"], score: 0},
  ];
  const currentGame = options?.currentGame ?? {
    status: "FINISHED",
    group_id: "group-1",
    date: "2026-07-17",
  };

  const snapshot = (data?: LeagueTestDocument) => ({
    exists: Boolean(data),
    data: () => data,
  });
  const querySnapshot = (docs: Array<{id: string; data: () => any}>) => ({
    docs,
    empty: docs.length === 0,
  });

  const makeQuery = (path: string): any => ({
    path,
    where: jest.fn(function() {
      return this;
    }),
    limit: jest.fn(function() {
      return this;
    }),
    get: jest.fn(async () => {
      if (path === "confirmations") {
        externalConfirmationReads++;
        return querySnapshot(
          confirmationDocs.map((doc, index) => ({
            id: `confirmation-${index}`,
            data: () => doc,
          })),
        );
      }
      if (path === "teams") {
        externalTeamReads++;
        return querySnapshot(
          teamDocs.map((doc) => ({
            id: doc.id,
            data: () => doc,
          })),
        );
      }
      return querySnapshot([]);
    }),
  });

  const makeDocument = (path: string): any => ({
    path,
    id: path.split("/").at(-1),
    collection: (name: string) => makeCollection(`${path}/${name}`),
    get: jest.fn(async () => {
      if (path.includes("/league_matches/")) externalMatchReads++;
      return snapshot(matches.get(path));
    }),
  });
  const makeCollection = (path: string): any => ({
    path,
    doc: (id: string) => makeDocument(`${path}/${id}`),
    where: jest.fn(() => makeQuery(path)),
  });

  const firestore = {
    collection: (name: string) => makeCollection(name),
    runTransaction: jest.fn((callback: (tx: any) => Promise<void>) => {
      const run = transactionQueue.then(async () => {
        let wrote = false;
        const events: string[] = [];
        transactionEvents.push(events);
        const assertCanRead = () => {
          if (wrote) throw new Error("Firestore transaction read after write");
        };
        const tx = {
          getAll: jest.fn(async (...refs: any[]) => {
            assertCanRead();
            events.push("read:matches");
            return refs.map((ref) => snapshot(matches.get(ref.path)));
          }),
          get: jest.fn(async (query: any) => {
            assertCanRead();
            if (query.path === "games/game-1") {
              events.push("read:game");
              return snapshot(currentGame);
            }
            if (query.path === "confirmations") {
              events.push("read:confirmations");
              return querySnapshot(
                confirmationDocs.map((doc, index) => ({
                  id: `confirmation-${index}`,
                  data: () => doc,
                })),
              );
            }
            if (query.path === "teams") {
              events.push("read:teams");
              return querySnapshot(
                teamDocs.map((doc) => ({
                  id: doc.id,
                  data: () => doc,
                })),
              );
            }
            events.push("read:active-season");
            activeSeasonReads++;
            return querySnapshot([
              {id: "season-new", data: () => ({is_active: true})},
            ]);
          }),
          set: jest.fn((ref: any, data: any) => {
            wrote = true;
            events.push(`write:set:${ref.path}`);
            writes.push({kind: "set", path: ref.path, data});
            if (ref.path.includes("/league_matches/")) {
              matches.set(ref.path, data);
            }
          }),
          delete: jest.fn((ref: any) => {
            wrote = true;
            events.push(`write:delete:${ref.path}`);
            writes.push({kind: "delete", path: ref.path});
            matches.delete(ref.path);
          }),
        };
        await callback(tx);
      });
      transactionQueue = run.catch(() => undefined);
      return run;
    }),
  };

  return {
    firestore,
    matchPath,
    matches,
    writes,
    transactionEvents,
    get externalMatchReads() {
      return externalMatchReads;
    },
    get externalConfirmationReads() {
      return externalConfirmationReads;
    },
    get externalTeamReads() {
      return externalTeamReads;
    },
    get activeSeasonReads() {
      return activeSeasonReads;
    },
  };
}

function gameWriteEvent(before: any, after: any) {
  return {
    params: {gameId: "game-1"},
    data: {
      before: {data: () => before},
      after: {data: () => after},
    },
  };
}

describe("group-league multi-team scoring (#2494)", () => {
  describe("rankResult", () => {
    it("2 times: vence quem fez mais gols", () => {
      expect(rankResult(3, 3, 1)).toBe("WIN");
      expect(rankResult(1, 3, 1)).toBe("LOSS");
    });
    it("2 times empatados: DRAW para ambos", () => {
      expect(rankResult(2, 2, 2)).toBe("DRAW");
    });
    it("3 times com placares distintos: WIN/DRAW/LOSS", () => {
      // placares 5,4,3 → max=5 min=3
      expect(rankResult(5, 5, 3)).toBe("WIN");
      expect(rankResult(4, 5, 3)).toBe("DRAW");
      expect(rankResult(3, 5, 3)).toBe("LOSS");
    });
    it("3 times com empate no topo: ambos WIN, último LOSS", () => {
      expect(rankResult(5, 5, 3)).toBe("WIN"); // os dois de 5
      expect(rankResult(3, 5, 3)).toBe("LOSS");
    });
  });

  describe("opponentAverage", () => {
    it("2 times: média = placar do único oponente (comportamento antigo)", () => {
      const scores = [{id: "a", score: 5}, {id: "b", score: 2}];
      expect(opponentAverage("a", scores)).toBe(2);
      expect(opponentAverage("b", scores)).toBe(5);
    });
    it("3 times: média (arredondada) dos demais", () => {
      const scores = [
        {id: "a", score: 5},
        {id: "b", score: 3},
        {id: "c", score: 1},
      ];
      expect(opponentAverage("a", scores)).toBe(2); // (3+1)/2
      expect(opponentAverage("b", scores)).toBe(3); // (5+1)/2
      expect(opponentAverage("c", scores)).toBe(4); // (5+3)/2
    });
    it("time único: 0", () => {
      expect(opponentAverage("a", [{id: "a", score: 5}])).toBe(0);
    });
  });

  it("saldo do campeão é positivo e do lanterna negativo (3 times)", () => {
    const scores = [
      {id: "a", score: 5},
      {id: "b", score: 3},
      {id: "c", score: 1},
    ];
    expect(5 - opponentAverage("a", scores)).toBeGreaterThan(0);
    expect(1 - opponentAverage("c", scores)).toBeLessThan(0);
  });

  it("usa o score do proprio doc do time, sem depender da ordem do array", () => {
    const summaries = buildGroupLeagueTeamSummaries([
      {id: "team-b", name: "B", playerIds: ["u2"], score: 1},
      {id: "team-a", name: "A", playerIds: ["u1"], score: 4},
    ]);

    const byId = new Map(summaries.map((summary) => [summary.team_id, summary]));
    expect(byId.get("team-a")?.result).toBe("WIN");
    expect(byId.get("team-b")?.result).toBe("LOSS");
  });

  it("atribui o resultado do jogador pelo score do time dele", () => {
    const playerResults = buildGroupLeaguePlayerResults(
      [
        {userId: "u1", goals: 2, assists: 1, isMvp: true},
        {userId: "u2", goals: 0, assists: 0, isMvp: false},
      ],
      [
        {id: "team-b", name: "B", playerIds: ["u2"], score: 0},
        {id: "team-a", name: "A", playerIds: ["u1"], score: 3},
      ],
    );

    const byUser = new Map(playerResults.map((result) => [result.user_id, result]));
    expect(byUser.get("u1")?.result).toBe("WIN");
    expect(byUser.get("u2")?.result).toBe("LOSS");
  });

  it("prefere o placar canonico do jogo para dois times", () => {
    const game = {
      team1_id: "team-a",
      team2_id: "team-b",
      team1_score: 4,
      team2_score: 1,
    };
    expect(resolveFinishedTeamScore("team-a", 0, 2, 0, game)).toBe(4);
    expect(resolveFinishedTeamScore("team-b", 1, 2, 0, game)).toBe(1);
  });

  it("recupera ids reais ao reverter partida legada", () => {
    const summaries = getStoredTeamSummaries({
      team1_name: "A",
      team2_name: "B",
      team1_score: 3,
      team2_score: 1,
      player_results: [
        {
          user_id: "u1", team_id: "real-a", goals: 1, assists: 0,
          is_mvp: false, result: "WIN",
        },
        {
          user_id: "u2", team_id: "real-b", goals: 0, assists: 0,
          is_mvp: false, result: "LOSS",
        },
      ],
    });
    expect(summaries.map(({team_id: teamId}) => teamId))
      .toEqual(["real-a", "real-b"]);
  });
});

describe("group-league historical match transactions (#3438)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rebuilds an edited historical game in its stored season", async () => {
    const fake = createLeagueFirestore(storedHistoricalMatch());
    mockDb.mockReturnValue(fake.firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {status: "FINISHED", group_id: "group-1"},
      {status: "FINISHED", group_id: "group-1", date: "2026-01-10"},
    ));

    expect(fake.externalMatchReads).toBe(0);
    expect(fake.externalConfirmationReads).toBe(0);
    expect(fake.externalTeamReads).toBe(0);
    expect(fake.activeSeasonReads).toBe(0);
    expect(fake.matches.get(fake.matchPath)?.season_id).toBe("season-old");

    const standingWrites = fake.writes.filter(
      ({kind, path}) => kind === "set" && path.includes("/league_standings/"),
    );
    expect(standingWrites).toHaveLength(4);
    expect(standingWrites.every(({path}) => path.includes("/season-old_")))
      .toBe(true);
    expect(standingWrites.some(({path}) => path.includes("season-new")))
      .toBe(false);

    const events = fake.transactionEvents[0];
    expect(events.slice(0, 4))
      .toEqual(["read:game", "read:confirmations", "read:teams", "read:matches"]);
    expect(events.slice(4).every((event) => event.startsWith("write:")))
      .toBe(true);
  });

  it("clamps inflated goals and assists before persisting standings deltas", async () => {
    const fake = createLeagueFirestore(undefined, {
      confirmations: [
        {
          user_id: "u1",
          status: "CONFIRMED",
          goals: 999,
          assists: 999,
          is_mvp: true,
        },
        {
          user_id: "u2",
          status: "CONFIRMED",
          goals: -4,
          assists: -7,
          is_mvp: false,
        },
      ],
    });
    mockDb.mockReturnValue(fake.firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {status: "LIVE", group_id: "group-1"},
      {status: "FINISHED", group_id: "group-1", date: "2026-07-17"},
    ));

    const persistedMatch = fake.matches.get(fake.matchPath);
    expect(persistedMatch?.player_results).toEqual([
      {
        user_id: "u1",
        team_id: "team-a",
        goals: 15,
        assists: 10,
        is_mvp: true,
        result: "WIN",
      },
      {
        user_id: "u2",
        team_id: "team-b",
        goals: 0,
        assists: 0,
        is_mvp: false,
        result: "LOSS",
      },
    ]);
  });

  it("claims a historical delete atomically across concurrent redelivery", async () => {
    const fake = createLeagueFirestore(storedHistoricalMatch());
    mockDb.mockReturnValue(fake.firestore);
    const deletion = gameWriteEvent(
      {status: "FINISHED", group_id: "group-1"},
      undefined,
    );

    await Promise.all([
      mockOnGameWrittenHandler!(deletion),
      mockOnGameWrittenHandler!(deletion),
    ]);

    expect(fake.externalMatchReads).toBe(0);
    expect(fake.transactionEvents).toHaveLength(2);
    expect(fake.transactionEvents.map((events) => events[0]))
      .toEqual(["read:matches", "read:matches"]);
    expect(fake.matches.has(fake.matchPath)).toBe(false);

    const standingReverts = fake.writes.filter(
      ({kind, path}) => kind === "set" && path.includes("/league_standings/"),
    );
    expect(standingReverts).toHaveLength(2);
    expect(fake.writes.filter(({kind}) => kind === "delete"))
      .toHaveLength(1);
    expect(fake.transactionEvents[1]).toEqual(["read:matches"]);
  });

  it("nao reaplica standings quando o jogo atual ja nao esta mais FINISHED", async () => {
    const fake = createLeagueFirestore(storedHistoricalMatch(), {
      currentGame: {
        status: "LIVE",
        group_id: "group-1",
        date: "2026-07-17",
      },
    });
    mockDb.mockReturnValue(fake.firestore);

    await mockOnGameWrittenHandler!(gameWriteEvent(
      {status: "LIVE", group_id: "group-1"},
      {status: "FINISHED", group_id: "group-1", date: "2026-07-17"},
    ));

    expect(fake.matches.has(fake.matchPath)).toBe(false);
    expect(fake.activeSeasonReads).toBe(0);
    expect(fake.transactionEvents[0])
      .toEqual(["read:game", "read:matches", "write:set:groups/group-1/league_standings/season-old_u1", "write:set:groups/group-1/league_standings/season-old_u2", "write:delete:groups/group-1/league_matches/game-1"]);

    const applyWrites = fake.writes.filter(
      ({kind, path, data}) =>
        kind === "set" &&
        path === fake.matchPath &&
        data?.season_id === "season-old",
    );
    expect(applyWrites).toHaveLength(0);
  });
});
