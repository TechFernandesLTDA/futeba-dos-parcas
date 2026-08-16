const mockBatchDelete = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockGetAll = jest.fn();

jest.mock("firebase-admin", () => ({
  firestore: jest.fn(() => ({
    collection: mockCollection,
    getAll: mockGetAll,
    batch: jest.fn(() => ({
      delete: mockBatchDelete,
      set: mockBatchSet,
      commit: mockBatchCommit,
    })),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldPath: {
    documentId: jest.fn(() => "__name__"),
  },
  Timestamp: class Timestamp {
    private readonly ms: number;

    constructor(ms = 0) {
      this.ms = ms;
    }

    static fromMillis(ms: number) {
      return new Timestamp(ms);
    }

    toMillis() {
      return this.ms;
    }
  },
}));

jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((_config: unknown, handler: unknown) => handler),
  HttpsError: class HttpsError extends Error {},
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentWritten: jest.fn((_config: unknown, handler: unknown) => handler),
}));

jest.mock("../src/middleware/rate-limiter", () => ({
  checkRateLimit: jest.fn().mockResolvedValue({
    allowed: true,
    remaining: 1,
    resetAt: new Date(),
  }),
}));

jest.mock("../src/validation/index", () => ({
  sanitizeText: jest.fn((value: string) => value),
}));

jest.mock("../src/error-messages", () => ({
  ERROR_MSGS: {},
}));

jest.mock("../src/constants", () => ({
  FIRESTORE_BATCH_SAFE_LIMIT: 450,
  FIRESTORE_WHERE_IN_LIMIT: 10,
  FUNCTION_REGION: "southamerica-east1",
  GAME_GENDERS: ["MALE", "FEMALE", "MIXED"],
  LEVEL_TABLE: {
    levels: [
      {level: 0, xpRequired: 0},
      {level: 1, xpRequired: 100},
      {level: 2, xpRequired: 300},
    ],
  },
}));

import {
  __testing,
  invalidateLeaderboardOnParticipation,
} from "../src/cache/leaderboard-cache";

describe("leaderboard-cache batching", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockImplementation((id: string) => ({
      id,
      path: `cache_leaderboard/${id}`,
      collection: mockCollection,
    }));
    mockCollection.mockImplementation(() => ({
      doc: mockDoc,
    }));
    mockGetAll.mockReset();
  });

  it("deleteDocsInBatches divide deletes acima de 500 em batches seguros", async () => {
    const fakeDb: any = {
      batch: jest.fn(() => ({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      })),
    };

    const docs = Array.from({length: 905}, (_, index) => ({
      ref: {path: `cache_leaderboard/doc-${index}`},
    })) as any[];

    const committedBatches =
      await __testing.deleteDocsInBatches(fakeDb, docs as any);

    expect(committedBatches).toBe(3);
    expect(fakeDb.batch).toHaveBeenCalledTimes(3);
    expect(mockBatchDelete).toHaveBeenCalledTimes(905);
    expect(mockBatchCommit).toHaveBeenCalledTimes(3);
  });

  it("writeLeaguePlayersDirectoryCache divide diretorio em chunks", async () => {
    const players = Array.from({length: 501}, (_, index) => ({
      id: `player-${index}`,
      userId: `user-${index}`,
      userName: `Jogador ${index}`,
      userPhoto: index === 0 ? undefined : `https://img.test/${index}.jpg`,
      level: 1,
      points: index,
      gamesPlayed: 0,
      wins: 0,
      goals: 0,
      assists: 0,
      mvpCount: 0,
      division: "BRONZE",
      experiencePoints: index,
      canReceiveInvites: true,
    }));

    await __testing.writeLeaguePlayersDirectoryCache(
      "league_players__season-1__global__ALL",
      "season-1",
      null,
      "ALL",
      players
    );

    expect(mockBatchSet).toHaveBeenCalledTimes(4);
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: "cache_leaderboard/league_players__season-1__global__ALL",
      }),
      expect.objectContaining({
        kind: "league_players_directory",
        season_id: "season-1",
        group_id: null,
        gender_key: "ALL",
        count: 501,
        chunk_count: 3,
      })
    );
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({path: "cache_leaderboard/0000"}),
      expect.objectContaining({
        index: 0,
        players: expect.arrayContaining([
          expect.objectContaining({userId: "user-0"}),
        ]),
      })
    );
    const firstChunkPayload = mockBatchSet.mock.calls[1][1];
    expect(firstChunkPayload.players[0]).not.toHaveProperty("userPhoto");
    expect(mockBatchSet).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({path: "cache_leaderboard/0002"}),
      expect.objectContaining({
        index: 2,
        players: [expect.objectContaining({userId: "user-500"})],
      })
    );
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("readLeaguePlayersDirectoryCache carrega chunks validos", async () => {
    const {Timestamp} = jest.requireMock("firebase-admin/firestore");
    const chunkDoc = jest.fn((id: string) => ({path: `chunks/${id}`}));
    const cacheRef = {
      path: "cache_leaderboard/league_players__season-1__global__ALL",
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          kind: "league_players_directory",
          schema_version: 3,
          expires_at: Timestamp.fromMillis(Date.now() + 60_000),
          chunk_count: 2,
        }),
      }),
      collection: jest.fn(() => ({doc: chunkDoc})),
    };
    mockDoc.mockReturnValue(cacheRef);
    mockGetAll.mockResolvedValue([
      {data: () => ({players: [{userId: "u1", userName: "Ana"}]})},
      {data: () => ({players: [{userId: "u2", userName: "Bia"}]})},
    ]);

    const players = await __testing.readLeaguePlayersDirectoryCache(
      "league_players__season-1__global__ALL"
    );

    expect(chunkDoc).toHaveBeenCalledWith("0000");
    expect(chunkDoc).toHaveBeenCalledWith("0001");
    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(players).toEqual([
      {userId: "u1", userName: "Ana"},
      {userId: "u2", userName: "Bia"},
    ]);
  });

  it("readLeaguePlayersDirectoryCache ignora cache expirado", async () => {
    const {Timestamp} = jest.requireMock("firebase-admin/firestore");
    mockDoc.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          kind: "league_players_directory",
          schema_version: 1,
          expires_at: Timestamp.fromMillis(Date.now() - 1),
          chunk_count: 1,
        }),
      }),
    });

    await expect(
      __testing.readLeaguePlayersDirectoryCache(
        "league_players__season-1__global__ALL"
      )
    ).resolves.toBeNull();
    expect(mockGetAll).not.toHaveBeenCalled();
  });

  it("getCachedLeaguePlayersDirectory faz fallback se cache falha", async () => {
    const logger = jest.requireMock("firebase-functions").logger;
    const cacheRef = {
      path: "cache_leaderboard/league_players__all_seasons__global__ALL",
      get: jest.fn().mockRejectedValue(new Error("cache read failed")),
      collection: jest.fn(() => ({
        doc: jest.fn((id: string) => ({path: `chunks/${id}`})),
      })),
    };
    const usersQuery = {
      where: jest.fn(() => usersQuery),
      orderBy: jest.fn(() => usersQuery),
      limit: jest.fn(() => usersQuery),
      get: jest.fn()
        .mockResolvedValueOnce({
          empty: false,
          size: 1,
          docs: [{
            id: "u1",
            data: () => ({
              name: "Ana Liga",
              is_searchable: true,
              experience_points: 320,
            }),
          }],
        })
        .mockResolvedValueOnce({
          empty: true,
          size: 0,
          docs: [],
        }),
    };
    mockCollection.mockImplementation((name: string) => {
      if (name === "cache_leaderboard") return {doc: () => cacheRef};
      if (name === "users") return usersQuery;
      return {doc: mockDoc};
    });
    mockBatchCommit.mockRejectedValueOnce(new Error("cache write failed"));

    const players = await __testing.getCachedLeaguePlayersDirectory(
      null,
      null,
      "ALL"
    );

    expect(players).toEqual([
      expect.objectContaining({
        userId: "u1",
        userName: "Ana Liga",
        experiencePoints: 320,
        points: 0,
      }),
    ]);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it("buildLeaguePlayersDirectory junta membros, perfis publicos e melhor participacao", async () => {
    const seasonQuery = {
      where: jest.fn(() => seasonQuery),
      orderBy: jest.fn(() => seasonQuery),
      limit: jest.fn(() => seasonQuery),
      get: jest.fn().mockResolvedValue({
        docs: [
          {
            id: "p-low",
            data: () => ({
              user_id: "u1",
              season_id: "season-1",
              group_id: "group-1",
              points: 10,
              games_played: 2,
              wins: 1,
            }),
          },
          {
            id: "p-high",
            data: () => ({
              user_id: "u1",
              season_id: "season-1",
              group_id: "group-1",
              points: 35,
              games_played: 4,
              wins: 3,
              goals_scored: 5,
              assists: 2,
              mvp_count: 1,
              division: "SILVER",
              league_rating: 42,
            }),
          },
        ],
      }),
    };
    const membersRef = {
      get: jest.fn().mockResolvedValue({
        docs: [
          {id: "member-doc", data: () => ({status: "ACTIVE", user_id: "u1"})},
          {id: "inactive", data: () => ({status: "PENDING", user_id: "u2"})},
        ],
      }),
    };
    const usersQuery = {
      where: jest.fn(() => usersQuery),
      get: jest.fn().mockResolvedValue({
        docs: [{
          id: "u1",
          data: () => ({
            display_name: "Carlos Campo",
            photo_url: "https://img.test/u1.jpg",
            is_searchable: true,
            experience_points: 150,
            favorite_team: "Palmeiras",
          }),
        }],
      }),
    };
    const groupDoc = {
      collection: jest.fn(() => membersRef),
    };
    mockCollection.mockImplementation((name: string) => {
      if (name === "season_participation") return seasonQuery;
      if (name === "groups") return {doc: jest.fn(() => groupDoc)};
      if (name === "users") return usersQuery;
      return {doc: mockDoc};
    });

    const players = await __testing.buildLeaguePlayersDirectory(
      "season-1",
      "group-1",
      "ALL"
    );

    expect(players).toEqual([
      expect.objectContaining({
        id: "p-high",
        userId: "u1",
        userName: "Carlos Campo",
        userPhoto: "https://img.test/u1.jpg",
        favoriteTeam: "Palmeiras",
        level: 1,
        points: 35,
        gamesPlayed: 4,
        wins: 3,
        goals: 5,
        assists: 2,
        mvpCount: 1,
        division: "SILVER",
        leagueRating: 42,
        experiencePoints: 150,
        canReceiveInvites: true,
      }),
    ]);
  });

  // FIX #3900: o #3879 passou a filtrar por `group_ids array-contains` sem
  // backfill. Docs gravados antes daquele deploy so tem o escalar `group_id`
  // e sao excluidos de array-contains, o que zerava o ranking do grupo.
  describe("uniao group_ids/group_id (#3900)", () => {
    const GROUP_ID = "group-1";

    /**
     * Query de season_participation que responde conforme o filtro de grupo
     * aplicado, para distinguir a consulta nova da legada.
     */
    const makeSeasonQuery = (
      byFilter: {migrated?: unknown[]; legacy?: unknown[]}
    ) => {
      const build = (filters: string[]): any => ({
        where: jest.fn((field: string, _op: string, value: string) =>
          build([...filters, `${field}:${value}`])),
        orderBy: jest.fn(() => build(filters)),
        limit: jest.fn(() => build(filters)),
        get: jest.fn(async () => {
          if (filters.includes(`group_ids:${GROUP_ID}`)) {
            return {docs: byFilter.migrated ?? []};
          }
          if (filters.includes(`group_id:${GROUP_ID}`)) {
            return {docs: byFilter.legacy ?? []};
          }
          return {docs: []};
        }),
      });
      return build([]);
    };

    const wireCollections = (seasonQuery: unknown, memberIds: string[]) => {
      const membersRef = {
        get: jest.fn().mockResolvedValue({
          docs: memberIds.map((uid) => ({
            id: `member-${uid}`,
            data: () => ({status: "ACTIVE", user_id: uid}),
          })),
        }),
      };
      const usersQuery = {
        where: jest.fn(() => usersQuery),
        get: jest.fn().mockResolvedValue({
          docs: memberIds.map((uid) => ({
            id: uid,
            data: () => ({
              display_name: `Jogador ${uid}`,
              is_searchable: true,
              experience_points: 150,
            }),
          })),
        }),
      };
      mockCollection.mockImplementation((name: string) => {
        if (name === "season_participation") return seasonQuery;
        if (name === "groups") {
          return {doc: jest.fn(() => ({collection: jest.fn(() => membersRef)}))};
        }
        if (name === "users") return usersQuery;
        return {doc: mockDoc};
      });
    };

    const participation = (id: string, userId: string, points: number, extra = {}) => ({
      id,
      data: () => ({
        user_id: userId,
        season_id: "season-1",
        group_id: GROUP_ID,
        points,
        games_played: 4,
        wins: 3,
        ...extra,
      }),
    });

    it("doc legado (so group_id) aparece com estatisticas reais", async () => {
      wireCollections(
        makeSeasonQuery({migrated: [], legacy: [participation("p1", "u1", 20)]}),
        ["u1"]
      );

      const players = await __testing.buildLeaguePlayersDirectory(
        "season-1",
        GROUP_ID,
        "ALL"
      );

      expect(players).toEqual([
        expect.objectContaining({userId: "u1", points: 20, wins: 3}),
      ]);
    });

    it("estado misto: legado e migrado convivem sem duplicar usuario", async () => {
      // O fluxo novo grava group_id E group_ids, entao o doc migrado casa nas
      // duas consultas — a deduplicacao por id de documento e obrigatoria.
      const migratedDoc = participation("p-u1", "u1", 30, {group_ids: [GROUP_ID]});
      wireCollections(
        makeSeasonQuery({
          migrated: [migratedDoc],
          legacy: [migratedDoc, participation("p-u2", "u2", 15)],
        }),
        ["u1", "u2"]
      );

      const players = await __testing.buildLeaguePlayersDirectory(
        "season-1",
        GROUP_ID,
        "ALL"
      );

      expect(players).toHaveLength(2);
      expect(players).toEqual(expect.arrayContaining([
        expect.objectContaining({userId: "u1", points: 30}),
        expect.objectContaining({userId: "u2", points: 15}),
      ]));
    });

    it("loga warn quando ha membros ativos e nenhuma participacao", async () => {
      const logger = jest.requireMock("firebase-functions").logger;
      (logger.warn as jest.Mock).mockClear();
      wireCollections(makeSeasonQuery({migrated: [], legacy: []}), ["u1"]);

      await __testing.buildLeaguePlayersDirectory("season-1", GROUP_ID, "ALL");

      expect(logger.warn).toHaveBeenCalledWith(
        "[LEAGUE_PLAYERS] Grupo sem participacoes na temporada",
        expect.objectContaining({groupId: GROUP_ID, memberCount: 1})
      );
    });
  });

  it("toPublicLeagueUser devolve somente a whitelist esportiva", () => {
    const nowMs = Date.parse("2026-07-14T12:00:00.000Z");
    const result = __testing.toPublicLeagueUser({
      name: "Ana Segura",
      photo_url: "https://img.test/ana.jpg",
      is_searchable: true,
      email: "ana@example.com",
      phone: "+5511999999999",
      birth_date: "1990-01-01",
      fcm_token: "secret-token",
      preferred_position: "MEIA",
      striker_rating: 3.2,
      auto_mid_rating: 4.1,
      auto_rating_samples: 12,
      looking_for_game_today: true,
      looking_for_game_today_until: new Date(nowMs + 60_000),
      last_game_date: new Date(nowMs - 7 * 24 * 60 * 60 * 1000),
    }, nowMs);

    expect(result).toEqual(expect.objectContaining({
      name: "Ana Segura",
      photoUrl: "https://img.test/ana.jpg",
      preferredPosition: "MEIA",
      strikerRating: 3.2,
      autoMidRating: 4.1,
      autoRatingSamples: 12,
      lookingForGameToday: true,
      hasRecentPresence: true,
    }));
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("birthDate");
    expect(result).not.toHaveProperty("fcmToken");
    expect(result).not.toHaveProperty("lookingForGameTodayUntil");
    expect(result).not.toHaveProperty("lastGameDate");
  });

  it.each([
    {is_searchable: false},
    {is_searchable: true, deleted_at: new Date()},
    {is_searchable: true, status: "DELETED"},
    {is_searchable: true, is_active: false},
  ])("toPublicLeagueUser rejeita perfil privado ou removido %#", (data) => {
    expect(__testing.toPublicLeagueUser({name: "Oculto", ...data})).toBeNull();
  });

  it("sanitizeUserIds deduplica IDs e rejeita payload não-array", () => {
    expect(Array.from(__testing.sanitizeUserIds(["u1", "u1", "u2"]) ?? []))
      .toEqual(["u1", "u2"]);
    expect(() => __testing.sanitizeUserIds("u1")).toThrow();
  });
});

describe("invalidateLeaderboardOnParticipation (#3883)", () => {
  const invalidate = invalidateLeaderboardOnParticipation as unknown as (
    event: unknown
  ) => Promise<void>;

  // Doc do cache de diretório público da Liga (#3358): carrega `kind`.
  const directoryDoc = {
    data: () => ({
      kind: "league_players_directory",
      season_id: "season-1",
    }),
    ref: {path: "cache_leaderboard/league_players__season-1__global__ALL"},
  };

  // Doc do cache de rankings (getLeaderboardCached): agora carrega `kind`
  // "ranking" (#4045) para o filtro server-side da invalidação.
  const rankingDoc = {
    data: () => ({kind: "ranking", season_id: "season-1", rankings: []}),
    ref: {path: "cache_leaderboard/season-1_ALL_100"},
  };

  const eventForSeason = (seasonId: string | undefined) => ({
    data: {
      before: undefined,
      after: {data: () => ({season_id: seasonId})},
    },
  });

  const mockWhereGet = (docs: unknown[]) => {
    // Simula o filtro server-side `where("kind","==","ranking")`: o diretório
    // (kind == "league_players_directory") nunca é retornado pela query.
    const filtered = docs.filter(
      (doc) => (doc as {data: () => Record<string, unknown>}).data()?.kind ===
        "ranking"
    );
    const get = jest.fn().mockResolvedValue({
      empty: filtered.length === 0,
      size: filtered.length,
      docs: filtered,
    });
    const chainable = (): any => ({
      where: jest.fn(() => chainable()),
      limit: jest.fn().mockReturnThis(),
      startAfter: jest.fn().mockReturnThis(),
      get,
    });
    mockCollection.mockImplementation(() => chainable());
    return get;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchCommit.mockResolvedValue(undefined);
  });

  it("preserva o cache de diretório e deleta só o cache de rankings", async () => {
    mockWhereGet([directoryDoc, rankingDoc]);

    await invalidate(eventForSeason("season-1"));

    // Só o doc de rankings é deletado.
    expect(mockBatchDelete).toHaveBeenCalledTimes(1);
    expect(mockBatchDelete).toHaveBeenCalledWith(rankingDoc.ref);
    // Diretório NUNCA é tocado (regressão do #3358 evitada).
    expect(mockBatchDelete).not.toHaveBeenCalledWith(directoryDoc.ref);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("não deleta nada quando só existe cache de diretório", async () => {
    mockWhereGet([directoryDoc]);

    await invalidate(eventForSeason("season-1"));

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("early-return quando o snapshot está vazio (idempotente)", async () => {
    const get = mockWhereGet([]);

    await invalidate(eventForSeason("season-1"));

    expect(get).toHaveBeenCalledTimes(1);
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });

  it("ignora eventos sem season_id", async () => {
    const get = mockWhereGet([rankingDoc]);

    await invalidate(eventForSeason(undefined));

    // Nem chega a consultar o cache.
    expect(get).not.toHaveBeenCalled();
    expect(mockBatchDelete).not.toHaveBeenCalled();
  });
});

// Cobertura complementar #3879: branch de FAILED_PRECONDITION (indice ausente)
// em getCachedLeaguePlayersDirectory (linhas exigidas pelo diff-coverage gate).
describe("getCachedLeaguePlayersDirectory — erro de indice ausente (#3879)", () => {
  const makeFailingCacheRef = () => ({
    path: "cache_leaderboard/league_players__all_seasons__global__ALL",
    get: jest.fn().mockRejectedValue(new Error("cache read failed")),
    collection: jest.fn(() => ({
      doc: jest.fn((id: string) => ({path: `chunks/${id}`})),
    })),
  });

  it("loga erro distinto de configuracao quando a query exige indice e propaga", async () => {
    const logger = jest.requireMock("firebase-functions").logger;
    (logger.error as jest.Mock).mockClear();
    const missingIndexError = Object.assign(
      new Error("The query requires an index. You can create it here: ..."),
      {code: 9}
    );
    const usersQuery = {
      where: jest.fn(() => usersQuery),
      orderBy: jest.fn(() => usersQuery),
      limit: jest.fn(() => usersQuery),
      get: jest.fn().mockRejectedValue(missingIndexError),
    };
    const cacheRef = makeFailingCacheRef();
    mockCollection.mockImplementation((name: string) => {
      if (name === "cache_leaderboard") return {doc: () => cacheRef};
      if (name === "users") return usersQuery;
      return {doc: mockDoc};
    });

    await expect(__testing.getCachedLeaguePlayersDirectory(null, null, "ALL"))
      .rejects.toBe(missingIndexError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Indice composto ausente"),
      expect.objectContaining({genderKey: "ALL"})
    );
  });

  it("propaga erro transitorio sem log de indice ausente", async () => {
    const logger = jest.requireMock("firebase-functions").logger;
    (logger.error as jest.Mock).mockClear();
    const transientError = new Error("deadline exceeded");
    const usersQuery = {
      where: jest.fn(() => usersQuery),
      orderBy: jest.fn(() => usersQuery),
      limit: jest.fn(() => usersQuery),
      get: jest.fn().mockRejectedValue(transientError),
    };
    const cacheRef = makeFailingCacheRef();
    mockCollection.mockImplementation((name: string) => {
      if (name === "cache_leaderboard") return {doc: () => cacheRef};
      if (name === "users") return usersQuery;
      return {doc: mockDoc};
    });

    await expect(__testing.getCachedLeaguePlayersDirectory(null, null, "ALL"))
      .rejects.toBe(transientError);
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.stringContaining("Indice composto ausente"),
      expect.anything()
    );
  });
});
